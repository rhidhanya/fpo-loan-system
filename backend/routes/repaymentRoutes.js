const express = require('express');
const router = express.Router();
const {
  getMyRepayments,
  getLoanRepayments,
  getAllRepayments,
  markRepaymentPaid,
} = require('../controllers/repaymentController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// Farmer Routes
router.get('/my', protect, authorize('FARMER'), getMyRepayments);

// Shared Routes (Farmer can view own loan repayments, Admin can view any)
router.get('/loan/:loanId', protect, authorize('FARMER', 'FPO_ADMIN'), getLoanRepayments);

// Admin Routes
router.get('/', protect, authorize('FPO_ADMIN'), getAllRepayments);
router.put('/:id/pay', protect, authorize('FPO_ADMIN'), markRepaymentPaid);

module.exports = router;
