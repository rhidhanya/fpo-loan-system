process.env.NODE_ENV = 'test';
require('dotenv').config();

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

async function runPhase3VerificationSuite() {
  console.log('\n==================================================');
  console.log('  STARTING PHASE 3 LOAN WORKFLOW VERIFICATION SUITE ');
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
      console.error(` ✖ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  }

  try {
    // 1. Initialize MongoMemoryServer
    const { MongoMemoryServer } = require('mongodb-memory-server');
    console.log('Initializing isolated In-Memory MongoDB Server...');
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    process.env.MONGO_URI = mongoUri;
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'fpo_loan_system_super_secret_jwt_key_2026';
    process.env.JWT_EXPIRE = '7d';

    await mongoose.connect(mongoUri);
    console.log('Connected to In-Memory MongoDB.\n');

    const User = require('./models/User');
    const Loan = require('./models/Loan');
    const app = require('./server');

    const TEST_PORT = 5098;
    const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

    await new Promise((resolve) => {
      server = app.listen(TEST_PORT, () => {
        console.log(`Test server running on ${BASE_URL}\n`);
        resolve();
      });
    });

    // Setup Test Users
    console.log('--- Registering Test Users (2 Farmers, 1 FPO Admin) ---');

    // Register Farmer 1
    const f1Res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Farmer One',
        email: 'farmer1@example.com',
        password: 'Password@123',
        phone: '9800000001',
        role: 'FARMER',
      }),
    });
    const f1Data = await f1Res.json();
    const tokenFarmer1 = f1Data.token;
    const farmer1Id = f1Data.data.user._id;

    // Register Farmer 2
    const f2Res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Farmer Two',
        email: 'farmer2@example.com',
        password: 'Password@123',
        phone: '9800000002',
        role: 'FARMER',
      }),
    });
    const f2Data = await f2Res.json();
    const tokenFarmer2 = f2Data.token;
    const farmer2Id = f2Data.data.user._id;

    // Register FPO Admin
    const adminRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Admin FPO',
        email: 'adminfpo@example.com',
        password: 'Password@123',
        phone: '9900000001',
        role: 'FPO_ADMIN',
        adminSecretKey: process.env.ADMIN_SECRET_KEY || 'fpo_admin_secret_key_2026',
        fpoName: 'Green Farmer FPO',
      }),
    });
    const adminData = await adminRes.json();
    const tokenAdmin = adminData.token;
    const adminId = adminData.data.user._id;

    console.log('✔ Test users registered successfully.\n');

    // --------------------------------------------------
    // TEST 1 & 2: FARMER creates loan application & Auto Association
    // --------------------------------------------------
    const fakeFarmerId = new mongoose.Types.ObjectId().toString();
    const createLoan1Res = await fetch(`${BASE_URL}/api/loans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenFarmer1}`,
      },
      body: JSON.stringify({
        loanAmount: 75000,
        purpose: 'Wheat seed and organic fertilizer purchase',
        interestRate: 8.5,
        tenureMonths: 12,
        repaymentFrequency: 'MONTHLY',
        farmer: fakeFarmerId, // Client attempt to override farmer ID (should be ignored)
      }),
    });
    const createLoan1Data = await createLoan1Res.json();
    const loan1 = createLoan1Data.data?.loan;

    assert(
      createLoan1Res.status === 201 && loan1 && loan1.status === 'SUBMITTED',
      'Test 1: FARMER Loan Submission',
      `HTTP 201 Created, Status: '${loan1?.status}'`
    );

    assert(
      loan1?.farmer === farmer1Id && loan1?.farmer !== fakeFarmerId,
      'Test 2: Auto Association & Client Override Prevention',
      `Associated farmer ID (${loan1?.farmer}) matches logged-in farmer (${farmer1Id})`
    );

    // --------------------------------------------------
    // TEST 3: FARMER retrieves own loans (GET /api/loans/my)
    // --------------------------------------------------
    const myLoansRes = await fetch(`${BASE_URL}/api/loans/my`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenFarmer1}` },
    });
    const myLoansData = await myLoansRes.json();
    assert(
      myLoansRes.status === 200 && myLoansData.results === 1 && myLoansData.data.loans[0]._id === loan1._id,
      'Test 3: FARMER GET /api/loans/my',
      `Returned 1 loan belonging to Farmer 1`
    );

    // --------------------------------------------------
    // TEST 4: IDOR Protection (Farmer 2 accessing Farmer 1 loan)
    // --------------------------------------------------
    const idorRes = await fetch(`${BASE_URL}/api/loans/${loan1._id}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenFarmer2}` },
    });
    const idorData = await idorRes.json();
    assert(
      idorRes.status === 403 && idorData.status === 'fail',
      'Test 4: IDOR Protection',
      `Farmer 2 denied access to Farmer 1 loan (HTTP ${idorRes.status})`
    );

    // --------------------------------------------------
    // TEST 5: FARMER denied admin actions (PUT /api/loans/:id/under-review)
    // --------------------------------------------------
    const farmerAdminActionRes = await fetch(`${BASE_URL}/api/loans/${loan1._id}/under-review`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenFarmer1}` },
    });
    assert(
      farmerAdminActionRes.status === 403,
      'Test 5: FARMER Denied Admin Action',
      `HTTP ${farmerAdminActionRes.status} Forbidden`
    );

    // --------------------------------------------------
    // TEST 6: FPO_ADMIN lists loans with filter (GET /api/loans)
    // --------------------------------------------------
    const adminListRes = await fetch(`${BASE_URL}/api/loans?status=SUBMITTED`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    const adminListData = await adminListRes.json();
    assert(
      adminListRes.status === 200 && adminListData.results >= 1,
      'Test 6: FPO_ADMIN List Loans with Status Filter',
      `HTTP ${adminListRes.status}, Found ${adminListData.results} SUBMITTED loan(s)`
    );

    // --------------------------------------------------
    // TEST 7: Transition SUBMITTED -> UNDER_REVIEW
    // --------------------------------------------------
    const underReviewRes = await fetch(`${BASE_URL}/api/loans/${loan1._id}/under-review`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    const underReviewData = await underReviewRes.json();
    assert(
      underReviewRes.status === 200 && underReviewData.data.loan.status === 'UNDER_REVIEW',
      'Test 7: State Transition SUBMITTED -> UNDER_REVIEW',
      `New status: '${underReviewData.data?.loan?.status}'`
    );

    // --------------------------------------------------
    // TEST 8 & 9: Transition UNDER_REVIEW -> APPROVED & approvedBy Check
    // --------------------------------------------------
    const approveRes = await fetch(`${BASE_URL}/api/loans/${loan1._id}/approve`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdmin}`,
      },
      body: JSON.stringify({
        interestRate: 8.0,
        remarks: 'Documents verified and approved by admin',
      }),
    });
    const approveData = await approveRes.json();
    const approvedLoan = approveData.data?.loan;

    assert(
      approveRes.status === 200 && approvedLoan?.status === 'APPROVED',
      'Test 8: State Transition UNDER_REVIEW -> APPROVED',
      `New status: '${approvedLoan?.status}'`
    );

    assert(
      approvedLoan?.approvedBy === adminId,
      'Test 9: approvedBy Admin ID Stored',
      `approvedBy (${approvedLoan?.approvedBy}) matches admin (${adminId})`
    );

    // --------------------------------------------------
    // TEST 10: Rejection Workflow (Create Loan 2 -> Under Review -> Rejected)
    // --------------------------------------------------
    const createLoan2Res = await fetch(`${BASE_URL}/api/loans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenFarmer2}`,
      },
      body: JSON.stringify({
        loanAmount: 150000,
        purpose: 'Equipment purchase',
        tenureMonths: 24,
      }),
    });
    const loan2 = (await createLoan2Res.json()).data.loan;

    // Move Loan 2 to UNDER_REVIEW
    await fetch(`${BASE_URL}/api/loans/${loan2._id}/under-review`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });

    // Reject Loan 2
    const rejectRes = await fetch(`${BASE_URL}/api/loans/${loan2._id}/reject`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdmin}`,
      },
      body: JSON.stringify({
        remarks: 'Land records incomplete. Rejected.',
      }),
    });
    const rejectData = await rejectRes.json();
    const rejectedLoan = rejectData.data?.loan;

    assert(
      rejectRes.status === 200 && rejectedLoan?.status === 'REJECTED' && rejectedLoan?.remarks === 'Land records incomplete. Rejected.',
      'Test 10: State Transition UNDER_REVIEW -> REJECTED with Remarks',
      `Status: '${rejectedLoan?.status}', Remarks: '${rejectedLoan?.remarks}'`
    );

    // --------------------------------------------------
    // TEST 11: Transition APPROVED -> DISBURSED
    // --------------------------------------------------
    const disburseRes = await fetch(`${BASE_URL}/api/loans/${loan1._id}/disburse`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdmin}`,
      },
      body: JSON.stringify({
        disbursedAmount: 75000,
      }),
    });
    const disburseData = await disburseRes.json();
    const disbursedLoan = disburseData.data?.loan;

    assert(
      disburseRes.status === 200 && disbursedLoan?.status === 'DISBURSED' && disbursedLoan?.disbursedDate,
      'Test 11: State Transition APPROVED -> DISBURSED',
      `Status: '${disbursedLoan?.status}', Disbursed Amount: ${disbursedLoan?.disbursedAmount}`
    );

    // --------------------------------------------------
    // TEST 12: Invalid Direct State Transition Rejection
    // --------------------------------------------------
    // Create Loan 3 (SUBMITTED) and attempt direct disburse
    const createLoan3Res = await fetch(`${BASE_URL}/api/loans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenFarmer1}`,
      },
      body: JSON.stringify({
        loanAmount: 20000,
        purpose: 'Pesticide purchase',
        tenureMonths: 6,
      }),
    });
    const loan3 = (await createLoan3Res.json()).data.loan;

    const invalidTransitionRes = await fetch(`${BASE_URL}/api/loans/${loan3._id}/disburse`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    const invalidTransitionData = await invalidTransitionRes.json();

    assert(
      invalidTransitionRes.status === 400 && invalidTransitionData.status === 'fail',
      'Test 12: Invalid State Transition Rejection (SUBMITTED -> DISBURSED)',
      `HTTP ${invalidTransitionRes.status}: "${invalidTransitionData.message}"`
    );

    // --------------------------------------------------
    // TEST 13: Disbursement of REJECTED Loan Prevention
    // --------------------------------------------------
    const rejectDisburseRes = await fetch(`${BASE_URL}/api/loans/${loan2._id}/disburse`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    const rejectDisburseData = await rejectDisburseRes.json();

    assert(
      rejectDisburseRes.status === 400 && rejectDisburseData.status === 'fail',
      'Test 13: REJECTED Loan Disbursement Prevention',
      `HTTP ${rejectDisburseRes.status}: "${rejectDisburseData.message}"`
    );

    // --------------------------------------------------
    // TEST 14: Unauthenticated Request Rejection
    // --------------------------------------------------
    const unauthRes = await fetch(`${BASE_URL}/api/loans`, { method: 'GET' });
    assert(
      unauthRes.status === 401,
      'Test 14: Unauthenticated Request Rejection',
      `HTTP ${unauthRes.status} Unauthorized`
    );

    // --------------------------------------------------
    // TEST 15: Invalid Malformed ObjectId Handling
    // --------------------------------------------------
    const malformedIdRes = await fetch(`${BASE_URL}/api/loans/invalid-id-xyz123`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    const malformedIdData = await malformedIdRes.json();
    assert(
      malformedIdRes.status === 400 && malformedIdData.message.includes('Invalid loan ID format'),
      'Test 15: Malformed ObjectId Validation',
      `HTTP ${malformedIdRes.status}: "${malformedIdData.message}"`
    );

    // --------------------------------------------------
    // TEST 16: Non-existent Valid ObjectId Handling
    // --------------------------------------------------
    const nonExistentId = new mongoose.Types.ObjectId().toString();
    const notFoundRes = await fetch(`${BASE_URL}/api/loans/${nonExistentId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    const notFoundData = await notFoundRes.json();
    assert(
      notFoundRes.status === 404 && notFoundData.message.includes('not found'),
      'Test 16: Non-existent Loan ID 404 Handling',
      `HTTP ${notFoundRes.status}: "${notFoundData.message}"`
    );

  } catch (err) {
    console.error('✖ Exception during test execution:', err);
    failed++;
  } finally {
    if (server) server.close();
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();

    console.log('\n==================================================');
    console.log(`  PHASE 3 VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('==================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  }
}

runPhase3VerificationSuite();
