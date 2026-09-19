process.env.NODE_ENV = 'test';
require('dotenv').config();

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

async function runAuditVerificationSuite() {
  console.log('\n==================================================');
  console.log('      AUDIT LOG & EVENT VERIFICATION SUITE       ');
  console.log('==================================================\n');

  let mongoServer;
  let server;
  let passed = 0;
  let failed = 0;

  function assert(condition, testName, detail = '') {
    if (condition) {
      console.log(` ✔ PASS: ${testName} ${detail ? `(${detail})` : ''}`);
      passed++;
    } else {
      console.error(` ✘ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  }

  try {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    process.env.MONGO_URI = mongoUri;
    process.env.JWT_SECRET = 'fpo_loan_system_audit_secret_2026';
    process.env.JWT_EXPIRE = '7d';

    await mongoose.connect(mongoUri);

    const User = require('./models/User');
    const Loan = require('./models/Loan');
    const Document = require('./models/Document');
    const Repayment = require('./models/Repayment');
    const AuditLog = require('./models/AuditLog');
    const app = require('./server');

    const TEST_PORT = 5095;
    const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

    await new Promise((resolve) => {
      server = app.listen(TEST_PORT, () => {
        resolve();
      });
    });

    // 1. Create Admin and Farmer
    const admin = await User.create({
      name: 'Admin User',
      email: 'admin_audit@fpo.com',
      phone: '9876543210',
      password: 'password123',
      role: 'FPO_ADMIN',
    });
    const farmer = await User.create({
      name: 'Farmer Audit',
      email: 'farmer_audit@fpo.com',
      phone: '9876543211',
      password: 'password123',
      role: 'FARMER',
    });

    const adminToken = jwt.sign({ id: admin._id, role: admin.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const farmerToken = jwt.sign({ id: farmer._id, role: farmer.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // Test 1: Farmer is denied access to GET /api/audit-logs (403)
    const res1 = await fetch(`${BASE_URL}/api/audit-logs`, {
      headers: { Authorization: `Bearer ${farmerToken}` },
    });
    assert(res1.status === 403, 'FARMER denied access to /api/audit-logs (HTTP 403)');

    // Test 2: Admin can access GET /api/audit-logs (200)
    const res2 = await fetch(`${BASE_URL}/api/audit-logs`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data2 = await res2.json();
    assert(res2.status === 200 && data2.data.auditLogs.length === 0, 'FPO_ADMIN granted access (HTTP 200, empty list initially)');

    // Test 3: Create a loan and approve it -> audit log recorded
    const loan = await Loan.create({
      farmer: farmer._id,
      loanAmount: 50000,
      tenureMonths: 6,
      purpose: 'Crop Seeds',
      status: 'UNDER_REVIEW',
    });

    const resApprove = await fetch(`${BASE_URL}/api/loans/${loan._id}/approve`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ interestRate: 10 }),
    });
    assert(resApprove.status === 200, 'Admin approved loan (HTTP 200)');

    const resLogs1 = await fetch(`${BASE_URL}/api/audit-logs?action=LOAN_APPROVED`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const dataLogs1 = await resLogs1.json();
    assert(
      resLogs1.status === 200 &&
      dataLogs1.data.auditLogs.length === 1 &&
      dataLogs1.data.auditLogs[0].action === 'LOAN_APPROVED',
      'Audit log recorded for LOAN_APPROVED'
    );

    // Test 4: Disburse loan -> audit log recorded
    const resDisburse = await fetch(`${BASE_URL}/api/loans/${loan._id}/disburse`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ disbursementDate: new Date() }),
    });
    assert(resDisburse.status === 200, 'Admin disbursed loan (HTTP 200)');

    const resLogs2 = await fetch(`${BASE_URL}/api/audit-logs?action=LOAN_DISBURSED`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const dataLogs2 = await resLogs2.json();
    assert(
      resLogs2.status === 200 &&
      dataLogs2.data.auditLogs.length === 1 &&
      dataLogs2.data.auditLogs[0].action === 'LOAN_DISBURSED',
      'Audit log recorded for LOAN_DISBURSED'
    );

    // Test 5: Verify document -> audit log recorded
    const doc = await Document.create({
      user: farmer._id,
      loan: loan._id,
      documentType: 'ID_PROOF',
      documentName: 'Aadhaar Card.pdf',
      fileUrl: 'https://example.com/aadhaar.pdf',
      status: 'PENDING',
    });

    const resVerifyDoc = await fetch(`${BASE_URL}/api/documents/${doc._id}/verify`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(resVerifyDoc.status === 200, 'Admin verified document (HTTP 200)');

    const resLogs3 = await fetch(`${BASE_URL}/api/audit-logs?action=DOCUMENT_VERIFIED`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const dataLogs3 = await resLogs3.json();
    assert(
      resLogs3.status === 200 &&
      dataLogs3.data.auditLogs.length === 1 &&
      dataLogs3.data.auditLogs[0].action === 'DOCUMENT_VERIFIED',
      'Audit log recorded for DOCUMENT_VERIFIED'
    );

    // Test 6: Total audit count should now be 3
    const resLogsAll = await fetch(`${BASE_URL}/api/audit-logs`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const dataLogsAll = await resLogsAll.json();
    assert(dataLogsAll.totalCount === 3, 'Total audit logs count equals 3');

  } finally {
    if (server) await new Promise((res) => server.close(res));
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  }

  console.log('\n==================================================');
  console.log(`  AUDIT LOG SUITE: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================\n');

  if (failed > 0) process.exit(1);
}

runAuditVerificationSuite().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
