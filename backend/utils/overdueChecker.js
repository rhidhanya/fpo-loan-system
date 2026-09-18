const Repayment = require('../models/Repayment');

/**
 * Checks for unpaid/partial installments whose dueDate has passed and marks them OVERDUE
 * @param {string} [loanId] - Optional specific loan ID filter
 * @returns {Promise<number>} Count of updated overdue repayments
 */
const checkAndUpdateOverdueRepayments = async (loanId = null) => {
  try {
    const query = {
      paymentStatus: { $in: ['PENDING', 'PARTIAL'] },
      dueDate: { $lt: new Date() },
    };

    if (loanId) {
      query.loan = loanId;
    }

    const result = await Repayment.updateMany(query, {
      $set: { paymentStatus: 'OVERDUE' },
    });

    return result.modifiedCount || 0;
  } catch (error) {
    console.error('Error updating overdue repayments:', error.message);
    return 0;
  }
};

module.exports = checkAndUpdateOverdueRepayments;
