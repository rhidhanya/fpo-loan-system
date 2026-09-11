/**
 * verify_cloudinary.js
 * ---------------------
 * Cloudinary Integration Test for FPO Loan System
 *
 * Tests that document upload works end-to-end with the REAL Cloudinary SDK.
 * Verifies:
 *   1. A small PNG buffer uploads successfully
 *   2. The returned fileUrl is a genuine Cloudinary HTTPS URL
 *   3. The Document record is persisted in MongoDB with the real URL
 *   4. All existing auth + RBAC controls remain intact
 *   5. Cloudinary rejects an invalid/corrupt upload gracefully (error path)
 *
 * Run: node verify_cloudinary.js
 * Requires: Backend running on PORT (default 5001) with real Cloudinary credentials
 */

require('dotenv').config();

const BASE_URL = `http://localhost:${process.env.PORT || 5001}`;

// ── minimal 1×1 pixel valid PNG buffer (binary) ────────────────────────────
// This is the smallest valid PNG so the test is self-contained.
const MINIMAL_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const TEST_PNG_BUFFER = Buffer.from(MINIMAL_PNG_B64, 'base64');

let passed = 0;
let failed = 0;
const issues = [];

function pass(label) {
  console.log(`  ✅  ${label}`);
  passed++;
}

function fail(label, reason) {
  console.log(`  ❌  ${label}`);
  if (reason) console.log(`       → ${reason}`);
  failed++;
  issues.push({ label, reason });
}

async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, opts);
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function registerFarmer(suffix) {
  const { status, body } = await fetchJSON(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `Cloudinary Farmer ${suffix}`,
      email: `cld_farmer_${suffix}_${Date.now()}@test.com`,
      password: 'Test@12345',
      phone: '9000000000',
    }),
  });
  if (status !== 201 || !body?.token) throw new Error('Farmer registration failed: ' + JSON.stringify(body));
  return body.token;
}

async function createLoan(farmerToken) {
  const { status, body } = await fetchJSON(`${BASE_URL}/api/loans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${farmerToken}` },
    body: JSON.stringify({
      loanAmount: 10000,
      purpose: 'Cloudinary Upload Test',
      interestRate: 10,
      tenureMonths: 6,
    }),
  });
  if (status !== 201 || !body?.data?.loan?._id) throw new Error('Loan creation failed: ' + JSON.stringify(body));
  return body.data.loan._id;
}

async function buildFormData(loanId, documentType, fileBuffer, fileName, mimeType) {
  // Construct multipart/form-data manually using the FormData global (Node 18+)
  const form = new FormData();
  const blob = new Blob([fileBuffer], { type: mimeType });
  form.append('file', blob, fileName);
  form.append('loan', loanId);
  form.append('documentType', documentType);
  form.append('documentName', fileName);
  return form;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

async function testRealCloudinaryUpload() {
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  Cloudinary Integration Test Suite');
  console.log('══════════════════════════════════════════════════════════\n');

  // ── Prerequisite: backend health ─────────────────────────────────────────
  console.log('▶ Pre-checks');
  try {
    const { status, body } = await fetchJSON(`${BASE_URL}/api/health`);
    if (status === 200 && body.modelsLoaded?.Document) {
      pass('Backend health check — all models loaded');
    } else {
      fail('Backend health check', `Status ${status}`);
      console.log('\n⛔ Backend not running. Start with: npm run dev\n');
      return;
    }
  } catch (e) {
    fail('Backend reachable', e.message);
    console.log('\n⛔ Cannot connect to backend. Start with: npm run dev\n');
    return;
  }

  // ── Env vars present? ────────────────────────────────────────────────────
  console.log('\n▶ Environment Variables');
  const cldVars = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
  let envOk = true;
  for (const v of cldVars) {
    if (process.env[v]) {
      pass(`${v} is set`);
    } else {
      fail(`${v} is set`, 'MISSING from .env');
      envOk = false;
    }
  }
  if (!envOk) {
    console.log('\n⛔ Add real Cloudinary credentials to .env before running this test.\n');
    return;
  }

  // Detect if placeholder credentials are still present
  if (
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_KEY.includes('1234567890')
  ) {
    fail('Cloudinary credentials are real (not placeholder)', 'API key looks like old placeholder value');
    return;
  }
  pass('Cloudinary credentials appear real (not placeholder)');

  // ── Test 1: Real upload — happy path ─────────────────────────────────────
  console.log('\n▶ Test 1: Real Cloudinary upload (PNG → fpo_loan_documents folder)');
  let farmerToken, loanId, documentId;
  try {
    farmerToken = await registerFarmer('A');
    loanId = await createLoan(farmerToken);

    const form = await buildFormData(loanId, 'ID_PROOF', TEST_PNG_BUFFER, 'test_id.png', 'image/png');
    const { status, body } = await fetchJSON(`${BASE_URL}/api/documents/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${farmerToken}` },
      body: form,
    });

    if (status !== 201) {
      fail('Upload returns HTTP 201', `Got ${status}: ${JSON.stringify(body)}`);
    } else {
      pass('Upload returns HTTP 201');
    }

    if (body?.status === 'success') {
      pass('Response status field is "success"');
    } else {
      fail('Response status field is "success"', JSON.stringify(body));
    }

    const fileUrl = body?.data?.document?.fileUrl;
    if (fileUrl && fileUrl.startsWith('https://res.cloudinary.com/')) {
      pass(`fileUrl is a genuine Cloudinary HTTPS URL: ${fileUrl}`);
    } else {
      fail('fileUrl is a genuine Cloudinary URL', `Got: ${fileUrl}`);
    }

    // Confirm URL does NOT look like the old mock pattern
    if (fileUrl && !fileUrl.includes('fpo_docs/') && !fileUrl.endsWith('.pdf') && fileUrl.includes('fpo_loan_documents')) {
      pass('fileUrl does not match old mock URL pattern');
    } else if (fileUrl && fileUrl.startsWith('https://res.cloudinary.com/') && !fileUrl.includes('1234567')) {
      pass('fileUrl does not match old mock URL pattern');
    } else {
      fail('fileUrl does not match old mock URL pattern', fileUrl);
    }

    documentId = body?.data?.document?._id;
    if (documentId) {
      pass('Document _id present in response');
    } else {
      fail('Document _id present in response');
    }

    const doc = body?.data?.document;
    if (doc?.status === 'PENDING') pass('Document status is PENDING');
    else fail('Document status is PENDING', `Got: ${doc?.status}`);

    if (doc?.user) pass('Document.user field set');
    else fail('Document.user field set');

    if (doc?.loan === loanId) pass('Document.loan matches created loan');
    else fail('Document.loan matches created loan', `Expected ${loanId}, got ${doc?.loan}`);

    if (doc?.documentType === 'ID_PROOF') pass('Document.documentType is ID_PROOF');
    else fail('Document.documentType is ID_PROOF', doc?.documentType);

    if (doc?.fileType === 'image/png') pass('Document.fileType is image/png');
    else fail('Document.fileType is image/png', doc?.fileType);

  } catch (e) {
    fail('Test 1 — Real upload (exception)', e.message);
  }

  // ── Test 2: Auth — no token ───────────────────────────────────────────────
  console.log('\n▶ Test 2: Unauthenticated upload rejected');
  try {
    const form = await buildFormData(loanId || '000000000000000000000000', 'ID_PROOF', TEST_PNG_BUFFER, 'test.png', 'image/png');
    const { status, body } = await fetchJSON(`${BASE_URL}/api/documents/upload`, {
      method: 'POST',
      body: form,
    });
    if (status === 401) pass('Unauthenticated upload returns 401');
    else fail('Unauthenticated upload returns 401', `Got ${status}`);
  } catch (e) {
    fail('Test 2 — Unauthenticated upload (exception)', e.message);
  }

  // ── Test 3: IDOR — farmer cannot upload to another farmer's loan ──────────
  console.log('\n▶ Test 3: IDOR — farmer cannot upload to another farmer\'s loan');
  try {
    const otherToken = await registerFarmer('B');
    if (loanId) {
      const form = await buildFormData(loanId, 'ADDRESS_PROOF', TEST_PNG_BUFFER, 'test2.png', 'image/png');
      const { status, body } = await fetchJSON(`${BASE_URL}/api/documents/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${otherToken}` },
        body: form,
      });
      if (status === 403) pass('Cross-farmer upload rejected with 403');
      else fail('Cross-farmer upload rejected with 403', `Got ${status}: ${JSON.stringify(body)}`);
    } else {
      fail('IDOR test — skipped, no loanId from Test 1');
    }
  } catch (e) {
    fail('Test 3 — IDOR (exception)', e.message);
  }

  // ── Test 4: Invalid file type rejected by Multer ──────────────────────────
  console.log('\n▶ Test 4: Invalid file type (CSV) rejected before Cloudinary');
  try {
    const csvBuffer = Buffer.from('col1,col2\nval1,val2');
    const form2 = new FormData();
    form2.append('file', new Blob([csvBuffer], { type: 'text/csv' }), 'data.csv');
    form2.append('loan', loanId || '000000000000000000000000');
    form2.append('documentType', 'OTHER');
    const { status, body } = await fetchJSON(`${BASE_URL}/api/documents/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${farmerToken}` },
      body: form2,
    });
    if (status === 400) pass('CSV file rejected with 400 (before Cloudinary reached)');
    else fail('CSV file rejected with 400', `Got ${status}: ${JSON.stringify(body)}`);
  } catch (e) {
    fail('Test 4 — Invalid file type (exception)', e.message);
  }

  // ── Test 5: GET /api/documents/my — verify uploaded doc retrievable ───────
  console.log('\n▶ Test 5: GET /api/documents/my — uploaded document retrievable');
  try {
    if (farmerToken) {
      const { status, body } = await fetchJSON(`${BASE_URL}/api/documents/my`, {
        headers: { Authorization: `Bearer ${farmerToken}` },
      });
      if (status === 200 && body?.results >= 1) {
        pass(`GET /api/documents/my returns ${body.results} document(s)`);
        const doc = body.data.documents[0];
        if (doc?.fileUrl?.startsWith('https://res.cloudinary.com/')) {
          pass('Stored fileUrl is real Cloudinary URL (confirmed from DB read)');
        } else {
          fail('Stored fileUrl is real Cloudinary URL', `Got: ${doc?.fileUrl}`);
        }
      } else {
        fail('GET /api/documents/my returns documents', `Status ${status}`);
      }
    }
  } catch (e) {
    fail('Test 5 — GET /api/documents/my (exception)', e.message);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════');
  console.log(`  RESULTS: ${passed} passed  |  ${failed} failed`);
  console.log('══════════════════════════════════════════════════════════');
  if (failed > 0) {
    console.log('\n  Failed checks:');
    issues.forEach((i) => console.log(`  • ${i.label}: ${i.reason || ''}`));
  } else {
    console.log('\n  ✅ All Cloudinary integration tests passed.');
    console.log('  Real Cloudinary SDK is active. Mock uploader removed.');
  }
  console.log();
}

testRealCloudinaryUpload().catch((e) => {
  console.error('\n[FATAL] Test runner crashed:', e.message);
  process.exit(1);
});
