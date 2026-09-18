const express = require('express');
const router = express.Router();
const {
  createLoan,
  getMyLoans,
  getAllLoans,
  getLoanById,
  markUnderReview,
  approveLoan,
  rejectLoan,
  disburseLoan,
} = require('../controllers/loanController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// Farmer Routes
router.post('/', protect, authorize('FARMER'), createLoan);
router.get('/my', protect, authorize('FARMER'), getMyLoans);

// FPO Admin Routes
router.get('/', protect, authorize('FPO_ADMIN'), getAllLoans);
router.put('/:id/under-review', protect, authorize('FPO_ADMIN'), markUnderReview);
router.put('/:id/approve', protect, authorize('FPO_ADMIN'), approveLoan);
router.put('/:id/reject', protect, authorize('FPO_ADMIN'), rejectLoan);
router.put('/:id/disburse', protect, authorize('FPO_ADMIN'), disburseLoan);

// Shared Route (FARMER can access own, FPO_ADMIN can access any)
router.get('/:id', protect, authorize('FARMER', 'FPO_ADMIN'), getLoanById);

module.exports = router;
