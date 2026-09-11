/**
 * Reusable EMI Calculator
 * Formula: EMI = P * r * (1 + r)^n / ((1 + r)^n - 1)
 * Where P = principal, r = monthly interest rate, n = tenure in months
 *
 * @param {number} principal - Disbursed loan amount / principal
 * @param {number} annualInterestRate - Annual interest rate percentage (e.g. 12 for 12%)
 * @param {number} tenureMonths - Loan tenure in months
 * @returns {number} Calculated EMI rounded to 2 decimal places
 */
const calculateEMI = (principal, annualInterestRate = 0, tenureMonths) => {
  const p = Number(principal);
  const rate = Number(annualInterestRate) || 0;
  const n = Number(tenureMonths);

  if (isNaN(p) || p <= 0 || isNaN(n) || n <= 0) {
    return 0;
  }

  // 0% interest rate
  if (rate <= 0) {
    return Math.round((p / n) * 100) / 100;
  }

  // Monthly interest rate
  const r = rate / (12 * 100);

  const rateFactor = Math.pow(1 + r, n);
  const emi = (p * r * rateFactor) / (rateFactor - 1);

  return Math.round(emi * 100) / 100;
};

module.exports = calculateEMI;
