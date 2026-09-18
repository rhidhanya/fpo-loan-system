const User = require('../models/User');
const generateToken = require('../utils/generateToken');

// @desc    Register new User (FARMER or FPO_ADMIN)
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
  try {
    const { name, email, password, phone, role, fpoName, fpoRegistrationNo, address } = req.body;

    // Validation
    if (!name || !email || !password || !phone) {
      return res.status(400).json({
        status: 'fail',
        message: 'Please provide name, email, password, and phone number',
      });
    }

    // Role check & Security Safeguard
    let userRole = 'FARMER';
    if (role && role.toUpperCase() === 'FPO_ADMIN') {
      const adminSecret = process.env.ADMIN_SECRET_KEY || 'fpo_admin_secret_key_2026';
      if (!req.body.adminSecretKey || req.body.adminSecretKey !== adminSecret) {
        return res.status(403).json({
          status: 'fail',
          message: 'Forbidden: Valid Admin Secret Key is required to register as FPO_ADMIN',
        });
      }
      userRole = 'FPO_ADMIN';
    }

    // Check if email exists
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({
        status: 'fail',
        message: 'User with this email address already exists',
      });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      phone,
      role: userRole,
      fpoName,
      fpoRegistrationNo,
      address,
    });

    // Generate JWT
    const token = generateToken(user._id, user.role);

    // Response user payload without password
    const userPayload = {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      fpoName: user.fpoName,
      fpoRegistrationNo: user.fpoRegistrationNo,
      address: user.address,
      kycVerified: user.kycVerified,
      status: user.status,
      createdAt: user.createdAt,
    };

    return res.status(201).json({
      status: 'success',
      token,
      data: {
        user: userPayload,
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Server error during registration',
    });
  }
};

// @desc    Authenticate User & get token
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        status: 'fail',
        message: 'Please provide email and password',
      });
    }

    // Find user by email and explicitly select password field
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
    if (!user) {
      return res.status(401).json({
        status: 'fail',
        message: 'Invalid email or password',
      });
    }

    // Match password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        status: 'fail',
        message: 'Invalid email or password',
      });
    }

    // Account status check
    if (user.status !== 'ACTIVE') {
      return res.status(401).json({
        status: 'fail',
        message: 'Account is inactive or suspended',
      });
    }

    // Generate JWT
    const token = generateToken(user._id, user.role);

    // Response user payload without password
    const userPayload = {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      fpoName: user.fpoName,
      fpoRegistrationNo: user.fpoRegistrationNo,
      address: user.address,
      kycVerified: user.kycVerified,
      status: user.status,
      createdAt: user.createdAt,
    };

    return res.status(200).json({
      status: 'success',
      token,
      data: {
        user: userPayload,
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Server error during login',
    });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    return res.status(200).json({
      status: 'success',
      data: {
        user: req.user,
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Server error fetching user profile',
    });
  }
};

module.exports = {
  register,
  login,
  getMe,
};
