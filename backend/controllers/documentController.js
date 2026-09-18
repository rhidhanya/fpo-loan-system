const mongoose = require('mongoose');
const Document = require('../models/Document');
const Loan = require('../models/Loan');
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary');

const VALID_DOC_TYPES = [
  'ID_PROOF',
  'ADDRESS_PROOF',
  'LAND_RECORD',
  'FPO_MEMBERSHIP',
  'BANK_STATEMENT',
  'FINANCIAL_REPORT',
  'OTHER',
];

// @desc    Upload document for a loan application
// @route   POST /api/documents/upload
// @access  Private (FARMER only)
const uploadDocument = async (req, res) => {
  try {
    const { loan, documentType, documentName } = req.body || {};

    if (!req.file) {
      return res.status(400).json({
        status: 'fail',
        message: 'Please upload a document file',
      });
    }

    if (!loan || !mongoose.Types.ObjectId.isValid(loan)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Valid loan ID is required',
      });
    }

    if (!documentType || !VALID_DOC_TYPES.includes(documentType)) {
      return res.status(400).json({
        status: 'fail',
        message: `Invalid document type. Allowed types: ${VALID_DOC_TYPES.join(', ')}`,
      });
    }

    // Verify loan exists and belongs to the authenticated farmer
    const loanDoc = await Loan.findById(loan);
    if (!loanDoc) {
      return res.status(404).json({
        status: 'fail',
        message: 'Loan application not found',
      });
    }

    if (loanDoc.farmer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: 'fail',
        message: "Forbidden: You cannot upload documents to another farmer's loan application",
      });
    }

    // ── Step 1: Upload to Cloudinary ──────────────────────────────────────────
    // If the Cloudinary upload fails, abort immediately — no DB record is created.
    let cloudinaryResult;
    try {
      cloudinaryResult = await uploadToCloudinary(req.file.buffer, {
        folder: 'fpo_loan_documents',
      });
    } catch (uploadError) {
      console.error('[Cloudinary] Upload failed:', uploadError.message);
      return res.status(502).json({
        status: 'error',
        message: 'Document upload to storage failed. Please try again.',
      });
    }

    // ── Step 2: Save document metadata in MongoDB ─────────────────────────────
    // If MongoDB save fails after a successful upload, delete the Cloudinary
    // resource to avoid leaving orphaned files in storage.
    let document;
    try {
      document = await Document.create({
        loan: loanDoc._id,
        user: req.user._id,
        documentType,
        documentName: documentName ? documentName.trim() : req.file.originalname,
        fileUrl: cloudinaryResult.secure_url,
        fileType: req.file.mimetype,
        status: 'PENDING',
      });
    } catch (dbError) {
      // Best-effort Cloudinary cleanup to prevent orphaned files
      if (cloudinaryResult && cloudinaryResult.public_id) {
        const resourceType = req.file.mimetype.startsWith('image/') ? 'image' : 'raw';
        await deleteFromCloudinary(cloudinaryResult.public_id, resourceType);
      }
      return res.status(500).json({
        status: 'error',
        message: dbError.message || 'Failed to save document record. Uploaded file has been cleaned up.',
      });
    }

    return res.status(201).json({
      status: 'success',
      message: 'Document uploaded successfully',
      data: {
        document,
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Server error uploading document',
    });
  }
};

// @desc    Get documents belonging to the authenticated farmer
// @route   GET /api/documents/my
// @access  Private (FARMER only)
const getMyDocuments = async (req, res) => {
  try {
    const documents = await Document.find({ user: req.user._id })
      .populate('loan', 'purpose loanAmount status')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      status: 'success',
      results: documents.length,
      data: {
        documents,
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Server error fetching your documents',
    });
  }
};

// @desc    Get documents for a specific loan (Farmer accesses own loan, Admin accesses any)
// @route   GET /api/documents/loan/:loanId
// @access  Private (FARMER & FPO_ADMIN)
const getLoanDocuments = async (req, res) => {
  try {
    const { loanId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(loanId)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid loan ID format',
      });
    }

    const loan = await Loan.findById(loanId);
    if (!loan) {
      return res.status(404).json({
        status: 'fail',
        message: 'Loan application not found',
      });
    }

    // IDOR Check for Farmers
    if (req.user.role === 'FARMER' && loan.farmer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: 'fail',
        message: "Forbidden: You do not have permission to view documents for this loan",
      });
    }

    const documents = await Document.find({ loan: loanId })
      .populate('user', 'name email phone')
      .populate('verifiedBy', 'name email phone')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      status: 'success',
      results: documents.length,
      data: {
        documents,
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Server error fetching loan documents',
    });
  }
};

// @desc    Get all documents for admin review with status filter
// @route   GET /api/documents
// @access  Private (FPO_ADMIN only)
const getAllDocuments = async (req, res) => {
  try {
    const { status } = req.query;

    const query = {};
    if (status) {
      const upperStatus = status.toUpperCase();
      if (!['PENDING', 'VERIFIED', 'REJECTED'].includes(upperStatus)) {
        return res.status(400).json({
          status: 'fail',
          message: `Invalid document status filter '${status}'`,
        });
      }
      query.status = upperStatus;
    }

    const documents = await Document.find(query)
      .populate('user', 'name email phone fpoName')
      .populate('loan', 'purpose status loanAmount')
      .populate('verifiedBy', 'name email phone')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      status: 'success',
      results: documents.length,
      data: {
        documents,
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Server error fetching all documents',
    });
  }
};

// @desc    Verify a document: PENDING -> VERIFIED
// @route   PUT /api/documents/:id/verify
// @access  Private (FPO_ADMIN only)
const verifyDocument = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid document ID format',
      });
    }

    const document = await Document.findById(id);
    if (!document) {
      return res.status(404).json({
        status: 'fail',
        message: 'Document not found',
      });
    }

    document.status = 'VERIFIED';
    document.verifiedAt = new Date();
    document.verifiedBy = req.user._id;

    await document.save();

    return res.status(200).json({
      status: 'success',
      message: 'Document verified successfully',
      data: {
        document,
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Server error verifying document',
    });
  }
};

// @desc    Reject a document: PENDING -> REJECTED
// @route   PUT /api/documents/:id/reject
// @access  Private (FPO_ADMIN only)
const rejectDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid document ID format',
      });
    }

    if (!rejectionReason || !rejectionReason.trim()) {
      return res.status(400).json({
        status: 'fail',
        message: 'Rejection reason is required',
      });
    }

    const document = await Document.findById(id);
    if (!document) {
      return res.status(404).json({
        status: 'fail',
        message: 'Document not found',
      });
    }

    document.status = 'REJECTED';
    document.verifiedAt = new Date();
    document.verifiedBy = req.user._id;
    document.rejectionReason = rejectionReason.trim();

    await document.save();

    return res.status(200).json({
      status: 'success',
      message: 'Document rejected',
      data: {
        document,
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Server error rejecting document',
    });
  }
};

module.exports = {
  uploadDocument,
  getMyDocuments,
  getLoanDocuments,
  getAllDocuments,
  verifyDocument,
  rejectDocument,
};
