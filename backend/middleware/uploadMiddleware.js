const multer = require('multer');

// Memory storage
const storage = multer.memoryStorage();

// File filter (PDF, JPG, JPEG, PNG)
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error('Invalid file type. Only PDF, JPG, JPEG, and PNG files are allowed.');
    error.code = 'INVALID_FILE_TYPE';
    cb(error, false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter,
});

// Middleware wrapper for handling Multer errors cleanly
const handleSingleUpload = (fieldName) => {
  return (req, res, next) => {
    const uploadSingle = upload.single(fieldName);

    uploadSingle(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            status: 'fail',
            message: 'File size exceeds maximum allowed limit of 5 MB',
          });
        }
        if (err.code === 'INVALID_FILE_TYPE' || err.message.includes('Invalid file type')) {
          return res.status(400).json({
            status: 'fail',
            message: err.message,
          });
        }
        return res.status(400).json({
          status: 'fail',
          message: err.message || 'File upload error',
        });
      }
      next();
    });
  };
};

module.exports = {
  upload,
  handleSingleUpload,
};
