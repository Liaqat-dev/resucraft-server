import express from 'express';
import rateLimit from 'express-rate-limit';
import {
    signup,
    login,
    logout,
    logoutAll,
    googleAuth,
    profile,
    verifyEmail,
    resendCode,
    forgotPassword,
    resetPassword,
    changeUserPassword,
    refresh,
    getSessions,
    revokeSession,
    getStats,
    getActivity,
    updateAccountInfo,
    getProfileCompletion,
    getUserBasicInfo
} from '#controllers/authController.js';
import { protect, requireVerified } from '#middlewares/authMiddleware.js';
import { uploadProfilePic } from '#middlewares/upload.js';
import { AUTH_CONSTANTS } from '#constants/authConstants.js';

const router = express.Router();

// Rate limiters
const loginLimiter = rateLimit({
    windowMs: AUTH_CONSTANTS.RATE_LIMIT.LOGIN.WINDOW_MS,
    max: AUTH_CONSTANTS.RATE_LIMIT.LOGIN.MAX_REQUESTS,
    message: { message: 'Too many login attempts. Try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

const emailLimiter = rateLimit({
    windowMs: AUTH_CONSTANTS.RATE_LIMIT.EMAIL.WINDOW_MS,
    max: AUTH_CONSTANTS.RATE_LIMIT.EMAIL.MAX_REQUESTS,
    message: { message: 'Too many email requests. Try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

const verificationLimiter = rateLimit({
    windowMs: AUTH_CONSTANTS.RATE_LIMIT.VERIFICATION.WINDOW_MS,
    max: AUTH_CONSTANTS.RATE_LIMIT.VERIFICATION.MAX_REQUESTS,
    message: { message: 'Too many verification attempts. Try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

const strictLimiter = rateLimit({
    windowMs: AUTH_CONSTANTS.RATE_LIMIT.STRICT.WINDOW_MS,
    max: AUTH_CONSTANTS.RATE_LIMIT.STRICT.MAX_REQUESTS,
    message: { message: 'Too many attempts. Try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

// ============================================
// PUBLIC ROUTES (No Authentication Required)
// ============================================

// Authentication
router.post('/signup', loginLimiter, signup);
router.post('/login', loginLimiter, login);
router.post('/google', loginLimiter, googleAuth);

// Email Verification
router.post('/verify-email', verificationLimiter, verifyEmail);
router.post('/resend-code', emailLimiter, resendCode);

// Password Reset
router.post('/forgot-password', emailLimiter, forgotPassword);
router.post('/reset-password/:token', strictLimiter, resetPassword);

// Token Refresh
router.post('/refresh', refresh);

// User Info (Public)
router.get('/user/:userId', getUserBasicInfo);

// ============================================
// PROTECTED ROUTES (Authentication Required)
// ============================================

// User Profile
router.get('/profile', protect, profile);
router.get('/profile-completion', protect, requireVerified, getProfileCompletion);

//accountInfo userName and password
router.put('/update-account-info', protect, requireVerified, uploadProfilePic.single('profilePic'), updateAccountInfo);

// Password Management
router.post('/change-password', protect, requireVerified, changeUserPassword);

// Session Management
router.post('/logout', protect, logout);
router.post('/logout-all', protect, logoutAll);
router.get('/sessions', protect, getSessions);
router.delete('/sessions/:sessionId', protect, revokeSession);

// Activity & Statistics
router.get('/stats', protect, getStats);
router.get('/activity', protect, getActivity);


export default router;