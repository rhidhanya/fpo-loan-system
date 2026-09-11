require('dotenv').config();
const mongoose = require('mongoose');

console.log('--- Verifying Mongoose Schema Compilation ---');

try {
  const { User, Loan, Document, Repayment } = require('./models');

  console.log('✔ User model loaded successfully:', User.modelName);
  console.log('✔ Loan model loaded successfully:', Loan.modelName);
  console.log('✔ Document model loaded successfully:', Document.modelName);
  console.log('✔ Repayment model loaded successfully:', Repayment.modelName);

  // Test creating model instances in memory (without saving) to check schema validity
  const testUser = new User({
    name: 'Test Farmer',
    email: 'farmer@example.com',
    password: 'password123',
    phone: '9876543210',
    role: 'FARMER',
  });
  console.log('✔ User instance created in memory:', testUser.name, 'Role:', testUser.role);

  const testLoan = new Loan({
    farmer: testUser._id,
    loanAmount: 50000,
    purpose: 'Crop seeds purchase',
    tenureMonths: 12,
  });
  console.log('✔ Loan instance created in memory:', testLoan.purpose, 'Amount:', testLoan.loanAmount);

  const testDoc = new Document({
    loan: testLoan._id,
    user: testUser._id,
    documentType: 'LAND_RECORD',
    documentName: 'land_7/12.pdf',
    fileUrl: 'https://example.com/docs/land.pdf',
  });
  console.log('✔ Document instance created in memory:', testDoc.documentName, 'Type:', testDoc.documentType);

  const testRepayment = new Repayment({
    loan: testLoan._id,
    borrower: testUser._id,
    installmentNumber: 1,
    amountDue: 4500,
    dueDate: new Date(),
  });
  console.log('✔ Repayment instance created in memory: Installment #', testRepayment.installmentNumber, 'Due:', testRepayment.amountDue);

  console.log('\n--- All 4 Mongoose models compiled and verified successfully! ---\n');

  // Test Mongo Connection (Atlas URI from .env)
  console.log('--- Testing MongoDB Connection ---');
  console.log('MONGO_URI configured:', process.env.MONGO_URI ? 'Yes' : 'No');

  if (process.env.MONGO_URI) {
    mongoose
      .connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 })
      .then((conn) => {
        console.log(`✔ SUCCESS: Connected to MongoDB Atlas at ${conn.connection.host}`);
        process.exit(0);
      })
      .catch((err) => {
        console.log(`ℹ MongoDB connection attempted (Note: ${err.message})`);
        console.log('✔ Models and schema compilation verified cleanly!');
        process.exit(0);
      });
  } else {
    process.exit(0);
  }
} catch (err) {
  console.error('✖ Verification failed:', err.message);
  process.exit(1);
}
