import {
    changePassword,
    forgotPasswordService,
    getUserProfile,
    loginUser,
    registerUser,
    resendVerificationCode,
    resetPasswordService,
    verifyUserEmail
} from '#services/authService.js';
import PersonalInfo from '#models/personalInfo.js';
import Education from '#models/education.js';
import Experience from '#models/experience.js';
import Skill from '#models/skills.js';
import Project from '#models/project.js';
import Certificate from '#models/certificate.js';
import {googleAuthService} from '#services/googleAuthService.js';
import {
    createSession,
    destroyAllUserSessions,
    destroySession,
    getSessionStats,
    getUserSessions,
    refreshAccessToken,
    revokeSessionById
} from '#services/sessionService.js';
import {detectSuspiciousActivity, getAuthStats, getUserActivity, logLogin, logLogout} from '#services/auditService.js';
import {deleteFromImgbb, uploadToImgbb} from '#services/imgbb.js';
import User from '#models/User.js';
import catchAsync from '#utils/catchAsync.js';
import {AUTH_CONSTANTS} from '#constants/authConstants.js';
import {AppError} from "#middlewares/errorHandler.js";
import fs from 'fs';

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
    const {email} = req.body;
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
    const {emailOrUsername, password} = req.body;

    const data = await loginUser(emailOrUsername, password, req);

    // Check if 2FA is needed
    if (data.needs2FA) {
        return res.status(200).json(data);
    }

    // Check if verification is needed
    if (data.needsVerification) {
        return res.status(200).json(data);
    }

    //  CLEAR ALL OLD COOKIES FIRST
    res.clearCookie('token', {path: '/'});
    res.clearCookie('refreshToken', {path: '/'});
    res.clearCookie('refreshToken', {path: '/api/auth/refresh'});

    // Create session
    const {accessToken, refreshToken} = await createSession({
        userId: data._id,
        req
    });

    //  Set ONLY refresh token in HttpOnly cookie
    res.cookie('refreshToken', refreshToken, AUTH_CONSTANTS.REFRESH_TOKEN_COOKIE_OPTIONS);

    // Log successful login
    await logLogin(data._id, req);

    //  Send access token in response body
    return res.json({
        accessToken,
        _id: data._id,
        name: data.name,
        username: data.username,
        profilePic: data.profilePic,
        email: data.email,
        isVerified: data.isVerified,
        provider: data.provider || 'local',
        twoFactorEnabled: data.twoFactorEnabled || false,
        role: data.role,
        isSuspended: data.isSuspended || false,
    });
});
/**
 * Google OAuth authentication
 */
export const googleAuth = catchAsync(async (req, res) => {
    const {accessToken: googleAccessToken} = req.body;

    const user = await googleAuthService(googleAccessToken, req);

    // Create session
    const {accessToken, refreshToken} = await createSession({
        userId: user._id,
        req
    });


    res.cookie('refreshToken', refreshToken, AUTH_CONSTANTS.REFRESH_TOKEN_COOKIE_OPTIONS);

    // Log successful login
    await logLogin(user._id, req);

    const profilePic = await getProfilePic(user._id);

    return res.json({
        accessToken,  // Client stores in memory
        user: {
            _id: user._id,
            name: user.name,
            username: user.username,
            email: user.email,
            isVerified: user.isVerified,
            provider: 'google',
            profilePic,
            role: user.role,
            isSuspended: user.isSuspended || false,
            twoFactorEnabled: user.twoFactorEnabled || false,
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
export const refresh = catchAsync(async (req, res) => {

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

    res.clearCookie('token', {path: '/'});
    res.clearCookie('refreshToken', {path: '/api/auth/refresh'});

    res.cookie('refreshToken', newRefreshToken, AUTH_CONSTANTS.REFRESH_TOKEN_COOKIE_OPTIONS);

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

    res.json({message: 'Logged out successfully'});
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
    const {sessionId} = req.params;

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
    const {email} = req.body;
    await forgotPasswordService(email, req);

    res.json({
        message: 'If that email exists, a reset link has been sent.'
    });
});

/**
 * Reset password with token
 */
export const resetPassword = catchAsync(async (req, res) => {
    const {token} = req.params;
    const {password, confirmPassword} = req.body;

    const data = await resetPasswordService(token, password, confirmPassword, req);

    res.json(data);
});

/**
 * Change password (for logged-in users)
 */
export const changeUserPassword = catchAsync(async (req, res) => {
    const userId = req.user._id;
    const {currentPassword, newPassword} = req.body;

    const data = await changePassword(userId, currentPassword, newPassword, req);

    res.json(data);
});

/**
 * Update account info (username and/or profile picture)
 */
export const updateAccountInfo = catchAsync(async (req, res) => {
    const userId = req.user._id;
    const {username} = req.body;

    const user = await User.findById(userId);
    if (!user) throw new AppError('User not found', 404);

    if (username !== undefined) {
        const trimmed = username.toLowerCase().trim();
        if (trimmed !== user.username) {
            const taken = await User.findOne({username: trimmed, _id: {$ne: userId}});
            if (taken) throw new AppError('Username is already taken', 400);
            user.username = trimmed;
        }
    }

    if (req.file) {
        if (user.profilePic?.deleteUrl) {
            await deleteFromImgbb(user.profilePic.deleteUrl);
        }

        const buffer = fs.readFileSync(req.file.path);
        const uploaded = await uploadToImgbb(buffer, req.file.filename);
        fs.unlinkSync(req.file.path);

        user.profilePic = uploaded;
    }

    await user.save({validateModifiedOnly: true});

    res.json({
        message: 'Account info updated successfully',
        user: {
            _id: user._id,
            username: user.username,
            email: user.email,
            profilePic: user.profilePic
        }
    });
});

/**
 * Get profile completion score for the current user.
 * Computes weights server-side so mobile / other clients can consume this too.
 *
 * GET /auth/profile-completion
 * Returns: { percentage, sections, isReady }
 *   isReady = percentage >= 70  (default threshold)
 */
export const getProfileCompletion = catchAsync(async (req, res) => {
    const userId = req.user._id;
    const authUser = req.user; // populated by protect middleware

    // Run all collection queries in parallel
    const [personalInfo, educationCount, experienceCount, skillsCount, projectsCount, certificatesCount] =
        await Promise.all([
            PersonalInfo.findOne({userId}).lean(),
            Education.countDocuments({user: userId}),
            Experience.countDocuments({user: userId}),
            Skill.countDocuments({user: userId}),
            Project.countDocuments({user: userId}),
            Certificate.countDocuments({user: userId}),
        ]);

    // ── Evaluate each section ────────────────────────────────────────────────
    const sections = [
        {
            id: 'profilePic',
            label: 'Profile Picture',
            weight: 3,
            isComplete: Boolean(authUser.profilePic?.url),
            isOptional: false,
            hint: 'Upload a profile photo',
        },
        {
            id: 'identity',
            label: 'Name & Profession',
            weight: 5,
            isComplete: Boolean(
                personalInfo?.firstName && personalInfo?.lastName && personalInfo?.profession
            ),
            isOptional: false,
            hint: 'Add your first name, last name and profession',
        },
        {
            id: 'contact',
            label: 'Contact Details',
            weight: 9,
            isComplete: Boolean(personalInfo?.phone && personalInfo?.address && personalInfo?.email),
            isOptional: false,
            hint: 'Add your phone number and address',
        },
        {
            id: 'bio',
            label: 'Bio',
            weight: 2,
            isComplete: Boolean(personalInfo?.bio && personalInfo.bio.trim().length >= 20),
            isOptional: false,
            hint: 'Write a short bio (at least 20 characters)',
        },
        {
            id: 'education',
            label: 'Education',
            weight: 20,
            isComplete: educationCount >= 1,
            isOptional: false,
            hint: 'Add at least one education entry',
        },
        {
            id: 'skills',
            label: 'Skills',
            weight: 15,
            isComplete: skillsCount >= 3,
            isOptional: false,
            hint: 'Add at least 3 skills',
        },
        {
            id: 'experience',
            label: 'Experience',
            weight: 15,
            isComplete: experienceCount >= 1,
            isOptional: false,
            hint: 'Add at least one work experience',
        },
        {
            id: 'socials',
            label: 'Social Links',
            weight: 5,
            isComplete: Boolean(personalInfo?.github || personalInfo?.linkedin),
            isOptional: true,
            hint: 'Add your GitHub or LinkedIn profile',
        },
        {
            id: 'projects',
            label: 'Projects',
            weight: 5,
            isComplete: projectsCount >= 1,
            isOptional: true,
            hint: 'Add at least one project',
        },
        {
            id: 'certificates',
            label: 'Certificates',
            weight: 5,
            isComplete: certificatesCount >= 1,
            isOptional: true,
            hint: 'Add at least one certificate',
        },
    ].map((s) => ({...s, earned: s.isComplete ? s.weight : 0}));

    const percentage = sections.reduce((sum, s) => sum + s.earned, 0);

    res.json({
        percentage,
        isReady: percentage >= 60,
        completedCount: sections.filter((s) => s.isComplete).length,
        totalCount: sections.length,
        sections,
    });
});