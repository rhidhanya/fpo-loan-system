process.env.NODE_ENV = 'test';
require('dotenv').config();

const mongoose = require('mongoose');

// Helper to build multipart/form-data payloads in Node.js
function createMultipartPayload(fields = {}, file = null) {
  const boundary = `----WebKitFormBoundary${Date.now().toString(16)}`;
  const chunks = [];

  for (const [key, val] of Object.entries(fields)) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}\r\n`, 'utf8'));
  }

  if (file) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${file.fieldname}"; filename="${file.filename}"\r\nContent-Type: ${file.mimetype}\r\n\r\n`,
        'utf8'
      )
    );
    chunks.push(file.buffer);
    chunks.push(Buffer.from('\r\n', 'utf8'));
  }

  chunks.push(Buffer.from(`--${boundary}--\r\n`, 'utf8'));
  const body = Buffer.concat(chunks);

  return {
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': body.length.toString(),
    },
    body,
  };
}

async function runPhase4VerificationSuite() {
  console.log('\n==================================================');
  console.log('  STARTING PHASE 4 DOCUMENT MANAGEMENT SUITE    ');
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
    // 1. Initialize In-Memory Mongo
    const { MongoMemoryServer } = require('mongodb-memory-server');
    console.log('Initializing isolated In-Memory MongoDB Server...');
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    process.env.MONGO_URI = mongoUri;
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'fpo_loan_system_super_secret_jwt_key_2026';

    await mongoose.connect(mongoUri);
    console.log('Connected to In-Memory MongoDB.\n');

    const app = require('./server');

    const TEST_PORT = 5097;
    const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

    await new Promise((resolve) => {
      server = app.listen(TEST_PORT, () => {
        console.log(`Test server running on ${BASE_URL}\n`);
        resolve();
      });
    });

    // 2. Setup Test Environment (2 Farmers, 1 Admin, 2 Loans)
    console.log('--- Setting up Test Users & Loan Applications ---');

    // Register Farmer 1
    const f1Res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Farmer One',
        email: 'farmer1_p4@example.com',
        password: 'Password@123',
        phone: '9800000011',
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
        email: 'farmer2_p4@example.com',
        password: 'Password@123',
        phone: '9800000012',
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
        name: 'Admin FPO P4',
        email: 'admin_p4@example.com',
        password: 'Password@123',
        phone: '9900000011',
        role: 'FPO_ADMIN',
        adminSecretKey: process.env.ADMIN_SECRET_KEY || 'fpo_admin_secret_key_2026',
      }),
    });
    const adminData = await adminRes.json();
    const tokenAdmin = adminData.token;
    const adminId = adminData.data.user._id;

    // Farmer 1 creates Loan 1
    const loan1Res = await fetch(`${BASE_URL}/api/loans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenFarmer1}` },
      body: JSON.stringify({ loanAmount: 50000, purpose: 'Fertilizers', tenureMonths: 12 }),
    });
    const loan1Id = (await loan1Res.json()).data.loan._id;

    // Farmer 2 creates Loan 2
    const loan2Res = await fetch(`${BASE_URL}/api/loans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenFarmer2}` },
      body: JSON.stringify({ loanAmount: 100000, purpose: 'Tractor Expansion', tenureMonths: 24 }),
    });
    const loan2Id = (await loan2Res.json()).data.loan._id;

    console.log('✔ Users and Loans initialized successfully.\n');

    // --------------------------------------------------
    // TEST 1, 2, & 3: FARMER uploads valid PDF document
    // --------------------------------------------------
    const minimalPdf =
      '%PDF-1.4\n' +
      '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
      '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
      '3 0 obj<</Type/Page/MediaBox[0 0 3 3]/Parent 2 0 R/Resources<<>>>>endobj\n' +
      'xref\n' +
      '0 4\n' +
      '0000000000 65535 f\n' +
      '0000000009 00000 n\n' +
      '0000000052 00000 n\n' +
      '0000000101 00000 n\n' +
      'trailer<</Size 4/Root 1 0 R>>\n' +
      'startxref\n' +
      '178\n' +
      '%%EOF';
    const pdfBuffer = Buffer.from(minimalPdf, 'utf8');
    const upload1 = createMultipartPayload(
      { loan: loan1Id, documentType: 'LAND_RECORD', documentName: 'land_7_12.pdf' },
      { fieldname: 'file', filename: 'land_7_12.pdf', mimetype: 'application/pdf', buffer: pdfBuffer }
    );

    const docUpload1Res = await fetch(`${BASE_URL}/api/documents/upload`, {
      method: 'POST',
      headers: { ...upload1.headers, Authorization: `Bearer ${tokenFarmer1}` },
      body: upload1.body,
    });
    const docUpload1Data = await docUpload1Res.json();
    const doc1 = docUpload1Data.data?.document;

    assert(
      docUpload1Res.status === 201 && doc1 && doc1.fileUrl.startsWith('https://res.cloudinary.com'),
      'Test 1: FARMER Upload Valid PDF to Cloudinary',
      `HTTP 201 Created, Cloudinary URL generated`
    );

    assert(
      doc1?.user === farmer1Id,
      'Test 2: Document Associated with Authenticated Farmer',
      `User ID (${doc1?.user}) matches farmer1Id (${farmer1Id})`
    );

    assert(
      doc1?.loan === loan1Id,
      'Test 3: Document Associated with Correct Loan',
      `Loan ID (${doc1?.loan}) matches loan1Id (${loan1Id})`
    );

    // --------------------------------------------------
    // TEST 4: Farmer cannot upload document to another farmer's loan
    // --------------------------------------------------
    const uploadCross = createMultipartPayload(
      { loan: loan2Id, documentType: 'ID_PROOF', documentName: 'aadhaar.jpg' },
      { fieldname: 'file', filename: 'aadhaar.jpg', mimetype: 'image/jpeg', buffer: Buffer.from('fake jpg', 'utf8') }
    );

    const crossUploadRes = await fetch(`${BASE_URL}/api/documents/upload`, {
      method: 'POST',
      headers: { ...uploadCross.headers, Authorization: `Bearer ${tokenFarmer1}` },
      body: uploadCross.body,
    });
    const crossUploadData = await crossUploadRes.json();

    assert(
      crossUploadRes.status === 403 && crossUploadData.status === 'fail',
      'Test 4: Farmer Cannot Upload to Another Farmer Loan',
      `HTTP ${crossUploadRes.status} Forbidden`
    );

    // --------------------------------------------------
    // TEST 5: Farmer retrieves own documents (GET /api/documents/my)
    // --------------------------------------------------
    const myDocsRes = await fetch(`${BASE_URL}/api/documents/my`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenFarmer1}` },
    });
    const myDocsData = await myDocsRes.json();

    assert(
      myDocsRes.status === 200 && myDocsData.results === 1 && myDocsData.data.documents[0]._id === doc1._id,
      'Test 5: Farmer GET /api/documents/my',
      `Returned 1 document belonging to Farmer 1`
    );

    // --------------------------------------------------
    // TEST 6: Farmer cannot retrieve another farmer's loan documents
    // --------------------------------------------------
    const crossLoanDocRes = await fetch(`${BASE_URL}/api/documents/loan/${loan2Id}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenFarmer1}` },
    });
    assert(
      crossLoanDocRes.status === 403,
      'Test 6: Farmer Cannot Access Another Farmer Loan Documents',
      `HTTP ${crossLoanDocRes.status} Forbidden`
    );

    // --------------------------------------------------
    // TEST 7: FPO_ADMIN can retrieve any loan documents
    // --------------------------------------------------
    const adminLoanDocRes = await fetch(`${BASE_URL}/api/documents/loan/${loan1Id}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    const adminLoanDocData = await adminLoanDocRes.json();
    assert(
      adminLoanDocRes.status === 200 && adminLoanDocData.results === 1,
      'Test 7: FPO_ADMIN Can Retrieve Loan Documents',
      `HTTP 200 OK, Found ${adminLoanDocData.results} document(s)`
    );

    // --------------------------------------------------
    // TEST 8, 9 & 10: FPO_ADMIN verifies document & verifiedBy/verifiedAt checked
    // --------------------------------------------------
    const verifyRes = await fetch(`${BASE_URL}/api/documents/${doc1._id}/verify`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    const verifyData = await verifyRes.json();
    const verifiedDoc = verifyData.data?.document;

    assert(
      verifyRes.status === 200 && verifiedDoc?.status === 'VERIFIED',
      'Test 8: FPO_ADMIN Verify Document (PENDING -> VERIFIED)',
      `HTTP 200 OK, Status: '${verifiedDoc?.status}'`
    );

    assert(
      verifiedDoc?.verifiedBy === adminId,
      'Test 9: verifiedBy Admin ID Stored',
      `verifiedBy (${verifiedDoc?.verifiedBy}) matches adminId (${adminId})`
    );

    assert(
      !!verifiedDoc?.verifiedAt,
      'Test 10: verifiedAt Timestamp Stored',
      `verifiedAt: ${verifiedDoc?.verifiedAt}`
    );

    // --------------------------------------------------
    // TEST 11 & 12: Farmer 2 uploads Document -> Admin Rejects with Reason
    // --------------------------------------------------
    const upload2 = createMultipartPayload(
      { loan: loan2Id, documentType: 'BANK_STATEMENT', documentName: 'statement.pdf' },
      { fieldname: 'file', filename: 'statement.pdf', mimetype: 'application/pdf', buffer: pdfBuffer }
    );
    const docUpload2Res = await fetch(`${BASE_URL}/api/documents/upload`, {
      method: 'POST',
      headers: { ...upload2.headers, Authorization: `Bearer ${tokenFarmer2}` },
      body: upload2.body,
    });
    const doc2 = (await docUpload2Res.json()).data.document;

    const rejectDocRes = await fetch(`${BASE_URL}/api/documents/${doc2._id}/reject`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdmin}` },
      body: JSON.stringify({ rejectionReason: 'Bank statement is older than 6 months.' }),
    });
    const rejectDocData = await rejectDocRes.json();
    const rejectedDoc = rejectDocData.data?.document;

    assert(
      rejectDocRes.status === 200 && rejectedDoc?.status === 'REJECTED',
      'Test 11: FPO_ADMIN Reject Document',
      `HTTP 200 OK, Status: '${rejectedDoc?.status}'`
    );

    assert(
      rejectedDoc?.rejectionReason === 'Bank statement is older than 6 months.',
      'Test 12: rejectionReason Stored Correctly',
      `Reason: "${rejectedDoc?.rejectionReason}"`
    );

    // --------------------------------------------------
    // TEST 13 & 14: FARMER cannot verify or reject documents
    // --------------------------------------------------
    const farmerVerifyAttemptRes = await fetch(`${BASE_URL}/api/documents/${doc2._id}/verify`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenFarmer1}` },
    });
    assert(
      farmerVerifyAttemptRes.status === 403,
      'Test 13: FARMER Denied Document Verify',
      `HTTP ${farmerVerifyAttemptRes.status} Forbidden`
    );

    const farmerRejectAttemptRes = await fetch(`${BASE_URL}/api/documents/${doc2._id}/reject`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenFarmer1}` },
      body: JSON.stringify({ rejectionReason: 'Illegal attempt' }),
    });
    assert(
      farmerRejectAttemptRes.status === 403,
      'Test 14: FARMER Denied Document Reject',
      `HTTP ${farmerRejectAttemptRes.status} Forbidden`
    );

    // --------------------------------------------------
    // TEST 15: Unauthenticated request rejection
    // --------------------------------------------------
    const unauthDocRes = await fetch(`${BASE_URL}/api/documents/my`, { method: 'GET' });
    assert(
      unauthDocRes.status === 401,
      'Test 15: Unauthenticated Request Rejection',
      `HTTP ${unauthDocRes.status} Unauthorized`
    );

    // --------------------------------------------------
    // TEST 16: Invalid Loan / Document ObjectId Handling
    // --------------------------------------------------
    const invalidDocIdRes = await fetch(`${BASE_URL}/api/documents/invalid-id-999/verify`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    assert(
      invalidDocIdRes.status === 400,
      'Test 16: Invalid Document ObjectId Validation',
      `HTTP ${invalidDocIdRes.status} Bad Request`
    );

    // --------------------------------------------------
    // TEST 17: Unsupported file type rejection (.exe file)
    // --------------------------------------------------
    const exeBuffer = Buffer.from('binary executable content', 'utf8');
    const exeUpload = createMultipartPayload(
      { loan: loan1Id, documentType: 'OTHER', documentName: 'malware.exe' },
      { fieldname: 'file', filename: 'malware.exe', mimetype: 'application/x-msdownload', buffer: exeBuffer }
    );
    const exeUploadRes = await fetch(`${BASE_URL}/api/documents/upload`, {
      method: 'POST',
      headers: { ...exeUpload.headers, Authorization: `Bearer ${tokenFarmer1}` },
      body: exeUpload.body,
    });
    const exeUploadData = await exeUploadRes.json();

    assert(
      exeUploadRes.status === 400 && exeUploadData.message.includes('Invalid file type'),
      'Test 17: Unsupported File Type Rejection (.exe)',
      `HTTP ${exeUploadRes.status}: "${exeUploadData.message}"`
    );

    // --------------------------------------------------
    // TEST 18: File exceeding size limit (> 5 MB) rejection
    // --------------------------------------------------
    const oversizeBuffer = Buffer.alloc(5.5 * 1024 * 1024); // 5.5 MB
    const oversizeUpload = createMultipartPayload(
      { loan: loan1Id, documentType: 'OTHER', documentName: 'large_scanned_map.pdf' },
      { fieldname: 'file', filename: 'large_map.pdf', mimetype: 'application/pdf', buffer: oversizeBuffer }
    );
    const oversizeRes = await fetch(`${BASE_URL}/api/documents/upload`, {
      method: 'POST',
      headers: { ...oversizeUpload.headers, Authorization: `Bearer ${tokenFarmer1}` },
      body: oversizeUpload.body,
    });
    const oversizeData = await oversizeRes.json();

    assert(
      oversizeRes.status === 400 && oversizeData.message.includes('exceeds maximum allowed limit'),
      'Test 18: File Exceeding 5 MB Limit Rejection',
      `HTTP ${oversizeRes.status}: "${oversizeData.message}"`
    );

  } catch (err) {
    console.error('✖ Exception during test execution:', err);
    failed++;
  } finally {
    if (server) server.close();
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();

    console.log('\n==================================================');
    console.log(`  PHASE 4 VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('==================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  }
}

runPhase4VerificationSuite();
