process.env.NODE_ENV = 'test';
require('dotenv').config();

const mongoose = require('mongoose');

async function runPhase5VerificationSuite() {
  console.log('\n==================================================');
  console.log('  STARTING PHASE 5 REPAYMENT & EMI VERIFICATION   ');
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
    const calculateEMI = require('./utils/emiCalculator');
    const checkAndUpdateOverdueRepayments = require('./utils/overdueChecker');

    // --------------------------------------------------
    // TEST 1, 2, 3: Direct EMI Math Unit Verification
    // --------------------------------------------------
    const emiNormal = calculateEMI(100000, 12, 12);
    assert(
      emiNormal === 8884.88,
      'Test 1: EMI Calculation Normal Interest (100k @ 12% for 12m)',
      `Calculated EMI: ${emiNormal} (expected 8884.88)`
    );

    const emiZero = calculateEMI(100000, 0, 10);
    assert(
      emiZero === 10000,
      'Test 2: EMI Calculation 0% Interest (100k @ 0% for 10m)',
      `Calculated EMI: ${emiZero} (expected 10000.00)`
    );

    const emiInvalid1 = calculateEMI(-5000, 12, 12);
    const emiInvalid2 = calculateEMI(100000, 12, 0);
    assert(
      emiInvalid1 === 0 && emiInvalid2 === 0,
      'Test 3: Invalid EMI Input Handling',
      `Handled negative principal/tenure safely`
    );

    // 1. Initialize In-Memory MongoDB Server
    const { MongoMemoryServer } = require('mongodb-memory-server');
    console.log('\nInitializing isolated In-Memory MongoDB Server...');
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    process.env.MONGO_URI = mongoUri;
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'fpo_loan_system_super_secret_jwt_key_2026';

    await mongoose.connect(mongoUri);
    console.log('Connected to In-Memory MongoDB.\n');

    const app = require('./server');
    const Repayment = require('./models/Repayment');
    const Loan = require('./models/Loan');

    const TEST_PORT = 5096;
    const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

    await new Promise((resolve) => {
      server = app.listen(TEST_PORT, () => {
        console.log(`Test server running on ${BASE_URL}\n`);
        resolve();
      });
    });

    // 2. Setup Test Environment Users (Farmer 1, Farmer 2, Admin)
    console.log('--- Registering Test Users & Creating Loan Applications ---');

    // Register Farmer 1
    const f1Res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Farmer P5 A', email: 'farmer_p5_a@example.com', password: 'Password@123', phone: '9855500001', role: 'FARMER' }),
    });
    const f1Data = await f1Res.json();
    const tokenFarmer1 = f1Data.token;
    const farmer1Id = f1Data.data.user._id;

    // Register Farmer 2
    const f2Res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Farmer P5 B', email: 'farmer_p5_b@example.com', password: 'Password@123', phone: '9855500002', role: 'FARMER' }),
    });
    const f2Data = await f2Res.json();
    const tokenFarmer2 = f2Data.token;

    // Register Admin
    const adminRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Admin P5',
        email: 'admin_p5@example.com',
        password: 'Password@123',
        phone: '9955500001',
        role: 'FPO_ADMIN',
        adminSecretKey: process.env.ADMIN_SECRET_KEY || 'fpo_admin_secret_key_2026',
      }),
    });
    const adminData = await adminRes.json();
    const tokenAdmin = adminData.token;

    // Farmer 1 creates Loan 1 (12,000, 0% interest, 3 months tenure for simple verification)
    const loan1Res = await fetch(`${BASE_URL}/api/loans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenFarmer1}` },
      body: JSON.stringify({ loanAmount: 12000, purpose: 'Crop Irrigation', interestRate: 0, tenureMonths: 3 }),
    });
    const loan1Id = (await loan1Res.json()).data.loan._id;

    // Put Loan 1 UNDER_REVIEW -> APPROVED
    await fetch(`${BASE_URL}/api/loans/${loan1Id}/under-review`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    await fetch(`${BASE_URL}/api/loans/${loan1Id}/approve`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });

    // --------------------------------------------------
    // TEST 4: APPROVED loan does NOT generate repayment schedule
    // --------------------------------------------------
    const approvedRepaymentsCount = await Repayment.countDocuments({ loan: loan1Id });
    assert(
      approvedRepaymentsCount === 0,
      'Test 4: APPROVED Loan Does NOT Generate Repayment Schedule',
      `Repayment count before disbursement: ${approvedRepaymentsCount}`
    );

    // --------------------------------------------------
    // TEST 5, 6, 7, 8, 9: DISBURSED Loan Generates Repayment Schedule
    // --------------------------------------------------
    const disburseRes = await fetch(`${BASE_URL}/api/loans/${loan1Id}/disburse`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdmin}` },
      body: JSON.stringify({ disbursedAmount: 12000 }),
    });
    const disburseData = await disburseRes.json();
    const generatedRepayments = disburseData.data?.repayments;

    assert(
      disburseRes.status === 200 && generatedRepayments && generatedRepayments.length === 3,
      'Test 5 & 6: DISBURSED Loan Automatically Generates Schedule',
      `HTTP 200 OK, Generated ${generatedRepayments?.length} installments`
    );

    const isSequential = generatedRepayments.every((r, idx) => r.installmentNumber === idx + 1);
    assert(
      isSequential,
      'Test 7: Sequential Installment Numbers (1, 2, 3)',
      'Installment numbers match 1 to tenureMonths'
    );

    const allAmountsCorrect = generatedRepayments.every((r) => r.amountDue === 4000);
    assert(
      allAmountsCorrect,
      'Test 8: Amount Due Calculated Correctly (12,000 / 3 = 4,000)',
      'All 3 installments have amountDue = 4000'
    );

    const allInitialPending = generatedRepayments.every((r) => r.paymentStatus === 'PENDING' && r.amountPaid === 0);
    assert(
      allInitialPending,
      'Test 9: Initial Payment Status is PENDING with amountPaid = 0',
      'All installments start PENDING'
    );

    const inst1 = generatedRepayments[0];
    const inst2 = generatedRepayments[1];
    const inst3 = generatedRepayments[2];

    // --------------------------------------------------
    // TEST 10: Farmer can retrieve own repayment schedule (GET /api/repayments/my)
    // --------------------------------------------------
    const myRepaymentsRes = await fetch(`${BASE_URL}/api/repayments/my`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenFarmer1}` },
    });
    const myRepaymentsData = await myRepaymentsRes.json();
    assert(
      myRepaymentsRes.status === 200 && myRepaymentsData.results === 3,
      'Test 10: Farmer GET /api/repayments/my',
      `HTTP 200 OK, Retrieved ${myRepaymentsData.results} installments`
    );

    // --------------------------------------------------
    // TEST 11: Farmer cannot retrieve another farmer's repayment schedule
    // --------------------------------------------------
    const idorRepayRes = await fetch(`${BASE_URL}/api/repayments/loan/${loan1Id}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenFarmer2}` },
    });
    assert(
      idorRepayRes.status === 403,
      'Test 11: IDOR Protection on Repayments',
      `Farmer 2 denied access to Farmer 1 repayments (HTTP ${idorRepayRes.status})`
    );

    // --------------------------------------------------
    // TEST 12: Admin can retrieve repayment records
    // --------------------------------------------------
    const adminRepayRes = await fetch(`${BASE_URL}/api/repayments?loan=${loan1Id}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    const adminRepayData = await adminRepayRes.json();
    assert(
      adminRepayRes.status === 200 && adminRepayData.results === 3,
      'Test 12: Admin GET /api/repayments',
      `HTTP 200 OK, Retrieved ${adminRepayData.results} records`
    );

    // --------------------------------------------------
    // TEST 13: Farmer cannot mark repayment as paid
    // --------------------------------------------------
    const farmerPayAttemptRes = await fetch(`${BASE_URL}/api/repayments/${inst1._id}/pay`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenFarmer1}` },
      body: JSON.stringify({ amountPaid: 4000 }),
    });
    assert(
      farmerPayAttemptRes.status === 403,
      'Test 13: Farmer Denied Marking Repayment Paid',
      `HTTP ${farmerPayAttemptRes.status} Forbidden`
    );

    // --------------------------------------------------
    // TEST 17: Partial Payment (Installment 1 -> 2000 of 4000)
    // --------------------------------------------------
    const partialPayRes = await fetch(`${BASE_URL}/api/repayments/${inst1._id}/pay`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdmin}` },
      body: JSON.stringify({ amountPaid: 2000, paymentMethod: 'UPI', remarks: 'Half payment' }),
    });
    const partialPayData = await partialPayRes.json();
    const partialInst = partialPayData.data?.repayment;

    assert(
      partialPayRes.status === 200 && partialInst?.paymentStatus === 'PARTIAL' && partialInst?.amountPaid === 2000,
      'Test 17: Partial Payment Recorded (Status: PARTIAL)',
      `HTTP 200 OK, Amount Paid: ${partialInst?.amountPaid}, Status: '${partialInst?.paymentStatus}'`
    );

    // --------------------------------------------------
    // TEST 14, 15, 16, 18: Full Payment (Installment 1 completed -> PAID)
    // --------------------------------------------------
    const fullPay1Res = await fetch(`${BASE_URL}/api/repayments/${inst1._id}/pay`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdmin}` },
      body: JSON.stringify({ amountPaid: 4000, paymentMethod: 'BANK_TRANSFER', transactionReference: 'TXN12345678' }),
    });
    const fullPay1Data = await fullPay1Res.json();
    const paidInst1 = fullPay1Data.data?.repayment;

    assert(
      fullPay1Res.status === 200 && paidInst1?.paymentStatus === 'PAID' && paidInst1?.amountPaid === 4000,
      'Test 14 & 18: Full Payment Recorded (Status: PAID)',
      `HTTP 200 OK, Status: '${paidInst1?.paymentStatus}'`
    );

    assert(
      !!paidInst1?.paidDate,
      'Test 15: Paid Date Timestamp Stored',
      `paidDate: ${paidInst1?.paidDate}`
    );

    assert(
      paidInst1?.paymentMethod === 'BANK_TRANSFER' && paidInst1?.transactionReference === 'TXN12345678',
      'Test 16: Payment Method & Transaction Reference Stored',
      `Method: ${paidInst1?.paymentMethod}, Txn: ${paidInst1?.transactionReference}`
    );

    // --------------------------------------------------
    // TEST 19: Negative Payment Amount Rejection
    // --------------------------------------------------
    const negPayRes = await fetch(`${BASE_URL}/api/repayments/${inst2._id}/pay`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdmin}` },
      body: JSON.stringify({ amountPaid: -100 }),
    });
    assert(
      negPayRes.status === 400,
      'Test 19: Negative Payment Amount Rejection',
      `HTTP ${negPayRes.status} Bad Request`
    );

    // --------------------------------------------------
    // TEST 20: Payment Exceeding Amount Due Rejection
    // --------------------------------------------------
    const excessPayRes = await fetch(`${BASE_URL}/api/repayments/${inst2._id}/pay`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdmin}` },
      body: JSON.stringify({ amountPaid: 999999 }),
    });
    assert(
      excessPayRes.status === 400,
      'Test 20: Payment Exceeding Amount Due Rejection',
      `HTTP ${excessPayRes.status} Bad Request`
    );

    // --------------------------------------------------
    // TEST 21: Already PAID Installment Cannot Be Modified
    // --------------------------------------------------
    const rePayRes = await fetch(`${BASE_URL}/api/repayments/${inst1._id}/pay`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdmin}` },
      body: JSON.stringify({ amountPaid: 4000 }),
    });
    const rePayData = await rePayRes.json();
    assert(
      rePayRes.status === 400 && rePayData.message.includes('already fully PAID'),
      'Test 21: Already PAID Installment Cannot Be Modified',
      `HTTP ${rePayRes.status}: "${rePayData.message}"`
    );

    // --------------------------------------------------
    // TEST 22 & 23: Overdue Detection & Paid Installment Immunity
    // --------------------------------------------------
    // Manually set Installment 2 dueDate to 5 days in past
    await Repayment.findByIdAndUpdate(inst2._id, { dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) });

    await checkAndUpdateOverdueRepayments(loan1Id);

    const updatedInst1 = await Repayment.findById(inst1._id);
    const updatedInst2 = await Repayment.findById(inst2._id);

    assert(
      updatedInst2.paymentStatus === 'OVERDUE',
      'Test 22: Past Due Unpaid Installment Marked OVERDUE',
      `Installment 2 status updated to '${updatedInst2.paymentStatus}'`
    );

    assert(
      updatedInst1.paymentStatus === 'PAID',
      'Test 23: Paid Installment Never Marked OVERDUE',
      `Installment 1 retained status '${updatedInst1.paymentStatus}'`
    );

    // --------------------------------------------------
    // TEST 24 & 25: Loan Remains DISBURSED Until ALL Installments PAID -> Then CLOSED
    // --------------------------------------------------
    let currentLoan1 = await Loan.findById(loan1Id);
    assert(
      currentLoan1.status === 'DISBURSED',
      'Test 24: Loan Remains DISBURSED While Repayments Unpaid',
      `Loan status: '${currentLoan1.status}'`
    );

    // Pay Installment 2 and Installment 3
    await fetch(`${BASE_URL}/api/repayments/${inst2._id}/pay`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdmin}` },
      body: JSON.stringify({ amountPaid: 4000, paymentMethod: 'CASH' }),
    });

    const finalPayRes = await fetch(`${BASE_URL}/api/repayments/${inst3._id}/pay`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdmin}` },
      body: JSON.stringify({ amountPaid: 4000, paymentMethod: 'CHEQUE' }),
    });
    const finalPayData = await finalPayRes.json();

    currentLoan1 = await Loan.findById(loan1Id);

    assert(
      finalPayData.loanClosed === true && currentLoan1.status === 'CLOSED',
      'Test 25: Loan Status Changes DISBURSED -> CLOSED When All Paid',
      `Final Loan Status: '${currentLoan1.status}'`
    );

    // --------------------------------------------------
    // TEST 26: Repayment Schedule Cannot Be Generated Twice
    // --------------------------------------------------
    const duplicateGenSchedule = await require('./controllers/repaymentController').generateRepaymentSchedule(currentLoan1);
    assert(
      duplicateGenSchedule.length === 3,
      'Test 26: Repayment Schedule Duplicate Prevention',
      `Returns existing 3 installments without creating duplicates`
    );

    // --------------------------------------------------
    // TEST 27: Unauthenticated Request Rejection
    // --------------------------------------------------
    const unauthRepayRes = await fetch(`${BASE_URL}/api/repayments/my`, { method: 'GET' });
    assert(
      unauthRepayRes.status === 401,
      'Test 27: Unauthenticated Request Rejection',
      `HTTP ${unauthRepayRes.status} Unauthorized`
    );

    // --------------------------------------------------
    // TEST 28: Invalid ObjectId Handling
    // --------------------------------------------------
    const invalidRepayIdRes = await fetch(`${BASE_URL}/api/repayments/invalid-id-abc/pay`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    assert(
      invalidRepayIdRes.status === 400,
      'Test 28: Invalid ObjectId Validation',
      `HTTP ${invalidRepayIdRes.status} Bad Request`
    );

  } catch (err) {
    console.error('✖ Exception during test execution:', err);
    failed++;
  } finally {
    if (server) server.close();
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();

    console.log('\n==================================================');
    console.log(`  PHASE 5 VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('==================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  }
}

runPhase5VerificationSuite();
