process.env.NODE_ENV = 'test';
require('dotenv').config();

const http = require('http');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

async function runGoogleAuthVerification() {
  console.log('\n========================================================');
  console.log('      GOOGLE AUTHENTICATION & SECURITY TEST SUITE       ');
  console.log('========================================================\n');

  let mongoServer;
  let server;
  let passed = 0;
  let failed = 0;

  function assert(condition, testName, detail = '') {
    if (condition) {
      console.log(` ✔ PASS: ${testName} ${detail ? `(${detail})` : ''}`);
      passed++;
    } else {
      console.error(` ✖ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  }

  try {
    // 1. In-Memory Mongo
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    process.env.MONGO_URI = mongoUri;
    process.env.JWT_SECRET = 'test_jwt_secret_google_auth_2026';
    process.env.JWT_EXPIRE = '7d';
    process.env.GOOGLE_CLIENT_ID = 'test-google-client-id-12345.apps.googleusercontent.com';

    await mongoose.connect(mongoUri);

    const User = require('./models/User');
    const { OAuth2Client } = require('google-auth-library');

    // Create Express app
    const express = require('express');
    const cors = require('cors');
    const authRoutes = require('./routes/authRoutes');

    const app = express();
    app.use(cors());
    app.use(express.json());
    app.use('/api/auth', authRoutes);

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(5199, resolve));
    const BASE_URL = 'http://127.0.0.1:5199/api/auth';

    // Helper for HTTP requests
    const makeRequest = (path, method = 'GET', body = null, token = null) => {
      return new Promise((resolve, reject) => {
        const url = new URL(`${BASE_URL}${path}`);
        const options = {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname,
          method,
          headers: {
            'Content-Type': 'application/json',
          },
        };
        if (token) {
          options.headers['Authorization'] = `Bearer ${token}`;
        }
        const req = http.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              resolve({ status: res.statusCode, body: JSON.parse(data) });
            } catch {
              resolve({ status: res.statusCode, body: data });
            }
          });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
      });
    };

    // Test 1: Missing Token -> 400
    const resMissing = await makeRequest('/google', 'POST', {});
    assert(
      resMissing.status === 400 && resMissing.body.status === 'fail',
      'Missing Google ID token rejected with 400'
    );

    // Test 2: Invalid / Unverifiable Token -> 401
    const resInvalid = await makeRequest('/google', 'POST', { token: 'invalid.token.structure' });
    assert(
      resInvalid.status === 401 && resInvalid.body.status === 'fail',
      'Invalid / fake Google token rejected with 401'
    );

    // Setup mock Google tokens
    let mockPayload = null;
    let shouldVerifyFail = false;

    const originalVerifyIdToken = OAuth2Client.prototype.verifyIdToken;
    OAuth2Client.prototype.verifyIdToken = async function (options) {
      if (shouldVerifyFail) {
        throw new Error('Token verification failed: token signature invalid or expired');
      }
      if (options.idToken === 'expired.token') {
        throw new Error('Token used too late');
      }
      if (options.audience !== process.env.GOOGLE_CLIENT_ID) {
        throw new Error('Token audience does not match client ID');
      }
      return {
        getPayload: () => mockPayload,
      };
    };

    // Test 3: Expired Google Token -> 401
    const resExpired = await makeRequest('/google', 'POST', { token: 'expired.token' });
    assert(
      resExpired.status === 401 && resExpired.body.message.includes('Invalid or expired'),
      'Expired Google token rejected with 401'
    );

    // Test 4: New user creation via Google (Default role FARMER)
    mockPayload = {
      sub: 'google-sub-10001',
      email: 'newfarmer@gmail.com',
      email_verified: true,
      name: 'Ramesh Patel',
    };

    const resNewUser = await makeRequest('/google', 'POST', { token: 'valid.token.farmer' });
    assert(resNewUser.status === 200, 'New Google user authentication returns 200');
    assert(resNewUser.body.token && typeof resNewUser.body.token === 'string', 'Application JWT generated');
    assert(resNewUser.body.data.user.role === 'FARMER', 'New user role is strictly FARMER');
    assert(resNewUser.body.data.user.email === 'newfarmer@gmail.com', 'User email stored correctly');

    const farmerJwt = resNewUser.body.token;

    // Check in database
    const savedFarmer = await User.findOne({ googleId: 'google-sub-10001' });
    assert(savedFarmer !== null, 'New user stored in MongoDB with googleId');
    assert(savedFarmer && savedFarmer.role === 'FARMER', 'MongoDB record role is FARMER');

    // Test 5: Role privilege escalation prevention
    // Attempting to pass role: 'FPO_ADMIN' in Google request body
    mockPayload = {
      sub: 'google-sub-10002',
      email: 'attacker@gmail.com',
      email_verified: true,
      name: 'Attacker Attempt',
    };

    const resAttacker = await makeRequest('/google', 'POST', {
      token: 'valid.token.attacker',
      role: 'FPO_ADMIN',
    });
    assert(resAttacker.status === 200, 'Request processed');
    assert(
      resAttacker.body.data.user.role === 'FARMER',
      'Role tampering prevented: new user cannot set role to FPO_ADMIN'
    );

    const savedAttacker = await User.findOne({ googleId: 'google-sub-10002' });
    assert(savedAttacker.role === 'FARMER', 'Database record role remains FARMER despite attack attempt');

    // Test 6: Account Linking for existing FPO_ADMIN by email
    // Pre-create an FPO_ADMIN via normal email/password
    const existingAdmin = await User.create({
      name: 'Admin Sarpanch',
      email: 'admin@fpo.org',
      password: 'SecurePassword123!',
      phone: '9876543210',
      role: 'FPO_ADMIN',
      status: 'ACTIVE',
    });

    mockPayload = {
      sub: 'google-sub-admin-99999',
      email: 'admin@fpo.org',
      email_verified: true,
      name: 'Admin Sarpanch Google',
    };

    const resLinkAdmin = await makeRequest('/google', 'POST', { token: 'valid.token.admin' });
    assert(resLinkAdmin.status === 200, 'Google login for existing email succeeds');
    assert(
      resLinkAdmin.body.data.user.role === 'FPO_ADMIN',
      'Existing FPO_ADMIN role preserved on Google login'
    );

    const adminJwt = resLinkAdmin.body.token;

    // Verify no duplicate account was created
    const countAdmins = await User.countDocuments({ email: 'admin@fpo.org' });
    assert(countAdmins === 1, 'No duplicate user created; single linked account exists');

    const updatedAdmin = await User.findById(existingAdmin._id);
    assert(
      updatedAdmin.googleId === 'google-sub-admin-99999',
      'Existing account safely linked with googleId'
    );
    assert(updatedAdmin.role === 'FPO_ADMIN', 'Existing account role is still FPO_ADMIN');

    // Test 7: Protected Route /api/auth/me with Google-issued JWT
    const resMeFarmer = await makeRequest('/me', 'GET', null, farmerJwt);
    assert(resMeFarmer.status === 200, 'GET /api/auth/me works with Farmer Google-issued JWT');
    assert(resMeFarmer.body.data.user.email === 'newfarmer@gmail.com', 'Profile matches farmer');

    const resMeAdmin = await makeRequest('/me', 'GET', null, adminJwt);
    assert(resMeAdmin.status === 200, 'GET /api/auth/me works with Admin Google-issued JWT');
    assert(resMeAdmin.body.data.user.email === 'admin@fpo.org', 'Profile matches admin');

    // Test 8: RBAC Verification
    // Admin route: admin can access, farmer is forbidden
    const resAdminRouteByAdmin = await makeRequest('/admin-only', 'GET', null, adminJwt);
    assert(resAdminRouteByAdmin.status === 200, 'FPO_ADMIN granted access to /admin-only');

    const resAdminRouteByFarmer = await makeRequest('/admin-only', 'GET', null, farmerJwt);
    assert(resAdminRouteByFarmer.status === 403, 'FARMER denied access to /admin-only (403 Forbidden)');

    // Farmer route: farmer can access, admin is forbidden
    const resFarmerRouteByFarmer = await makeRequest('/farmer-only', 'GET', null, farmerJwt);
    assert(resFarmerRouteByFarmer.status === 200, 'FARMER granted access to /farmer-only');

    // Restore original verifyIdToken
    OAuth2Client.prototype.verifyIdToken = originalVerifyIdToken;

    console.log('\n========================================================');
    console.log(`  GOOGLE AUTH VERIFICATION: ${passed} PASSED, ${failed} FAILED`);
    console.log('========================================================\n');

    server.close();
    await mongoose.disconnect();
    await mongoServer.stop();

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (error) {
    console.error('Test execution error:', error);
    if (server) server.close();
    if (mongoServer) await mongoServer.stop();
    process.exit(1);
  }
}

runGoogleAuthVerification();
