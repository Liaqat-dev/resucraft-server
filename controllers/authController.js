import {
    registerUser,
    loginUser,
    verifyUserEmail,
    resendVerificationCode,
    forgotPasswordService,
    resetPasswordService,
    getUserProfile,
    getProfilePic,
    changePassword
} from '#services/authService.js';
import { googleAuthService } from '#services/googleAuthService.js';
import {
    createSession,
    destroySession,
    destroyAllUserSessions,
    getUserSessions,
    revokeSessionById,
    refreshAccessToken,
    getSessionStats
} from '#services/sessionService.js';
import {
    logLogin,
    logLogout,
    getUserActivity,
    detectSuspiciousActivity,
    getAuthStats
} from '#services/auditService.js';
import catchAsync from '#utils/catchAsync.js';
import { AUTH_CONSTANTS } from '#constants/authConstants.js';
import {AppError} from "#middlewares/errorHandler.js";

/**
 * Register a new user
 */
export const signup = catchAsync(async (req, res) => {
    const data = await registerUser(req.body, req);
    res.status(201).json(data);
});

/**
 * Resend verification code
 */
export const resendCode = catchAsync(async (req, res) => {
    const { email } = req.body;
    const data = await resendVerificationCode(email, req);
    res.json(data);
});

/**
 * Verify email with code
 */
export const verifyEmail = catchAsync(async (req, res) => {
    const data = await verifyUserEmail(req.body, req);
    res.json(data);
});

/**
 * Login user
 */
export const login = catchAsync(async (req, res) => {
    const { emailOrUsername, password } = req.body;

    const data = await loginUser(emailOrUsername, password, req);

    // Check if 2FA is needed
    if (data.needs2FA) {
        return res.status(200).json(data);
    }

    // Check if verification is needed
    if (data.needsVerification) {
        return res.status(200).json(data);
    }

    // ✅ CLEAR ALL OLD COOKIES FIRST
    res.clearCookie('token', { path: '/' });
    res.clearCookie('refreshToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/api/auth/refresh' });

    // Create session
    const { accessToken, refreshToken } = await createSession({
        userId: data._id,
        req
    });

    // ✅ Set ONLY refresh token in HttpOnly cookie
    res.cookie('refreshToken', refreshToken, AUTH_CONSTANTS.REFRESH_TOKEN_COOKIE_OPTIONS);

    // Log successful login
    await logLogin(data._id, req);

    const profilePic = await getProfilePic(data._id);

    // ✅ Send access token in response body
    return res.json({
        accessToken,
        user: {
            _id: data._id,
            name: data.name,
            username: data.username,
            email: data.email,
            isVerified: data.isVerified,
            provider: data.provider || 'local',
            twoFactorEnabled: data.twoFactorEnabled || false,
            profilePic
        }
    });
});
/**
 * Google OAuth authentication
 */
export const googleAuth = catchAsync(async (req, res) => {
    const { accessToken: googleAccessToken } = req.body;

    const user = await googleAuthService(googleAccessToken, req);

    // Create session
    const { accessToken, refreshToken } = await createSession({
        userId: user._id,
        req
    });

    // ❌ REMOVE THIS LINE
    // res.cookie('token', accessToken, AUTH_CONSTANTS.COOKIE_OPTIONS);

    // ✅ ONLY refresh token in cookie
    res.cookie('refreshToken', refreshToken, AUTH_CONSTANTS.REFRESH_TOKEN_COOKIE_OPTIONS);

    // Log successful login
    await logLogin(user._id, req);

    const profilePic = await getProfilePic(user._id);

    // ✅ Send access token in response body
    return res.json({
        accessToken,  // Client stores in memory
        user: {
            _id: user._id,
            name: user.name,
            username: user.username,
            email: user.email,
            isVerified: user.isVerified,
            provider: 'google',
            profilePic
        }
    });
});
/**
 * Get user profilePics
 */
export const profile = catchAsync(async (req, res) => {
    const user = await getUserProfile(req.user.id);
    res.json(user);
});

/**
 * Refresh access token
 */
/**
 * Refresh access token
 */
export const refresh = catchAsync(async (req, res) => {
    console.log('\n🍪 ========== REFRESH REQUEST ==========');
    console.log('All cookies received:', Object.keys(req.cookies));

    // ✅ Check which refresh token we're getting
    const allRefreshTokens = [];
    for (const [key, value] of Object.entries(req.cookies)) {
        if (key === 'refreshToken') {
            allRefreshTokens.push(value.substring(0, 30) + '...');
        }
    }
    console.log('RefreshToken cookies found:', allRefreshTokens.length);

    // Get refresh token from cookie
    const refreshToken = req.cookies.refreshToken;

    console.log('refreshToken exists:', !!refreshToken);

    if (refreshToken) {
        console.log('refreshToken preview:', refreshToken.substring(0, 30) + '...');
    }

    if (!refreshToken) {
        console.error('❌ No refresh token in cookies');
        throw new AppError('Refresh token not found', 401);
    }

    const {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
    } = await refreshAccessToken(refreshToken, req);

    console.log('✅ Tokens refreshed, updating cookie...');

    // ✅ Clear any old cookies first
    res.clearCookie('token', { path: '/' });
    res.clearCookie('refreshToken', { path: '/api/auth/refresh' });

    // ✅ Set new refresh token cookie
    res.cookie('refreshToken', newRefreshToken, AUTH_CONSTANTS.REFRESH_TOKEN_COOKIE_OPTIONS);

    console.log('✅ Cookie set, sending response');
    console.log('========== REFRESH COMPLETE ==========\n');

    // ✅ Send access token in response body only
    res.json({
        accessToken: newAccessToken,
        message: 'Token refreshed successfully'
    });
});
/**
 * Logout from current device
 */
export const logout = catchAsync(async (req, res) => {
    let token = null;

    // Get token from Authorization header (primary method)
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    }

    // Fallback: Check cookie (if exists for some reason)
    if (!token && req.cookies && req.cookies.token) {
        token = req.cookies.token;
    }

    if (token) {
        await destroySession(token);
    }

    // Log logout
    if (req.user) {
        await logLogout(req.user._id, req, false);
    }

    // Clear cookies
    res.clearCookie('refreshToken', AUTH_CONSTANTS.REFRESH_TOKEN_COOKIE_OPTIONS);

    res.json({ message: 'Logged out successfully' });
});

/**
 * Logout from all devices
 */
export const logoutAll = catchAsync(async (req, res) => {
    const userId = req.user._id;

    const count = await destroyAllUserSessions(userId);

    // Log logout from all devices
    await logLogout(userId, req, true);

    // Clear cookies
    res.clearCookie('refreshToken', AUTH_CONSTANTS.REFRESH_TOKEN_COOKIE_OPTIONS);

    res.json({
        message: 'Logged out from all devices successfully',
        sessionsEnded: count
    });
});

/**
 * Get all active sessions
 */
export const getSessions = catchAsync(async (req, res) => {
    const userId = req.user._id;
    const currentToken = req.cookies.token ||
        (req.headers.authorization || '').replace('Bearer ', '');

    const sessions = await getUserSessions(userId, currentToken);

    res.json({
        sessions,
        total: sessions.length,
        maxAllowed: AUTH_CONSTANTS.MAX_SESSIONS_PER_USER
    });
});

/**
 * Revoke a specific session
 */
export const revokeSession = catchAsync(async (req, res) => {
    const userId = req.user._id;
    const { sessionId } = req.params;

    await revokeSessionById(userId, sessionId);

    res.json({
        message: 'Session revoked successfully'
    });
});

/**
 * Get session statistics
 */
export const getStats = catchAsync(async (req, res) => {
    const userId = req.user._id;

    const sessionStats = await getSessionStats(userId);
    const authStats = await getAuthStats(userId, 30);
    const suspicious = await detectSuspiciousActivity(userId);

    res.json({
        sessions: sessionStats,
        authentication: authStats,
        security: {
            suspiciousActivity: suspicious.suspiciousActivity,
            details: suspicious.details
        }
    });
});

/**
 * Get user activity log
 */
export const getActivity = catchAsync(async (req, res) => {
    const userId = req.user._id;
    const limit = parseInt(req.query.limit) || 50;

    const activity = await getUserActivity(userId, limit);

    res.json({
        activity,
        total: activity.length
    });
});

/**
 * Forgot password - send reset email
 */
export const forgotPassword = catchAsync(async (req, res) => {
    const { email } = req.body;
    await forgotPasswordService(email, req);

    res.json({
        message: 'If that email exists, a reset link has been sent.'
    });
});

/**
 * Reset password with token
 */
export const resetPassword = catchAsync(async (req, res) => {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;

    const data = await resetPasswordService(token, password, confirmPassword, req);

    res.json(data);
});

/**
 * Change password (for logged-in users)
 */
export const changeUserPassword = catchAsync(async (req, res) => {
    const userId = req.user._id;
    const { currentPassword, newPassword } = req.body;

    const data = await changePassword(userId, currentPassword, newPassword, req);

    res.json(data);
});