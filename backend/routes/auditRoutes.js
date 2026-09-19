const express = require('express');
const router = express.Router();
const { getAllAuditLogs } = require('../controllers/auditController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// Read-only — no write/update/delete endpoints exposed
router.get('/', protect, authorize('FPO_ADMIN'), getAllAuditLogs);

module.exports = router;
