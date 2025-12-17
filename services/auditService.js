import AuditLog from '#models/AuditLog.js';
import { AUDIT_ACTIONS } from '#constants/authConstants.js';
import { getClientIp } from '#utils/deviceUtils.js';

/**
 * Logs an authentication action
 */
export const logAuthAction = async ({
                                        userId = null,
                                        action,
                                        success = true,
                                        req,
                                        metadata = {},
                                        errorMessage = null
                                    }) => {
    try {
        const ipAddress = getClientIp(req);
        const userAgent = req.headers['user-agent'] || 'unknown';

        await AuditLog.logAction({
            userId,
            action,
            success,
            ipAddress,
            userAgent,
            metadata,
            errorMessage
        });
    } catch (error) {
        console.error('Failed to log audit action:', error);
    }
};

/**
 * Logs a successful login
 */
export const logLogin = async (userId, req, metadata = {}) => {
    await logAuthAction({
        userId,
        action: AUDIT_ACTIONS.LOGIN,
        success: true,
        req,
        metadata
    });
};

/**
 * Logs a failed login attempt
 */
export const logFailedLogin = async (identifier, req, reason) => {
    await logAuthAction({
        userId: null,
        action: AUDIT_ACTIONS.FAILED_LOGIN,
        success: false,
        req,
        metadata: { identifier },
        errorMessage: reason
    });
};

/**
 * Logs a logout
 */
export const logLogout = async (userId, req, allDevices = false) => {
    await logAuthAction({
        userId,
        action: allDevices ? AUDIT_ACTIONS.LOGOUT_ALL : AUDIT_ACTIONS.LOGOUT,
        success: true,
        req,
        metadata: { allDevices }
    });
};

/**
 * Logs user registration
 */
export const logRegistration = async (userId, req, provider = 'local') => {
    await logAuthAction({
        userId,
        action: AUDIT_ACTIONS.REGISTER,
        success: true,
        req,
        metadata: { provider }
    });
};

/**
 * Logs email verification
 */
export const logEmailVerified = async (userId, req) => {
    await logAuthAction({
        userId,
        action: AUDIT_ACTIONS.EMAIL_VERIFIED,
        success: true,
        req
    });
};

/**
 * Logs password change
 */
export const logPasswordChange = async (userId, req) => {
    await logAuthAction({
        userId,
        action: AUDIT_ACTIONS.PASSWORD_CHANGED,
        success: true,
        req
    });
};

/**
 * Logs password reset request
 */
export const logPasswordResetRequest = async (userId, req) => {
    await logAuthAction({
        userId,
        action: AUDIT_ACTIONS.PASSWORD_RESET_REQUESTED,
        success: true,
        req
    });
};

/**
 * Logs password reset completion
 */
export const logPasswordResetComplete = async (userId, req) => {
    await logAuthAction({
        userId,
        action: AUDIT_ACTIONS.PASSWORD_RESET_COMPLETED,
        success: true,
        req
    });
};

/**
 * Logs account lock
 */
export const logAccountLocked = async (userId, req) => {
    await logAuthAction({
        userId,
        action: AUDIT_ACTIONS.ACCOUNT_LOCKED,
        success: true,
        req
    });
};

/**
 * Logs account unlock
 */
export const logAccountUnlocked = async (userId, req) => {
    await logAuthAction({
        userId,
        action: AUDIT_ACTIONS.ACCOUNT_UNLOCKED,
        success: true,
        req
    });
};

/**
 * Logs 2FA enable
 */
export const log2FAEnabled = async (userId, req) => {
    await logAuthAction({
        userId,
        action: AUDIT_ACTIONS.TWO_FACTOR_ENABLED,
        success: true,
        req
    });
};

/**
 * Logs 2FA disable
 */
export const log2FADisabled = async (userId, req) => {
    await logAuthAction({
        userId,
        action: AUDIT_ACTIONS.TWO_FACTOR_DISABLED,
        success: true,
        req
    });
};

/**
 * Logs session revocation
 */
export const logSessionRevoked = async (userId, req, sessionId) => {
    await logAuthAction({
        userId,
        action: AUDIT_ACTIONS.SESSION_REVOKED,
        success: true,
        req,
        metadata: { sessionId }
    });
};

/**
 * Logs suspicious activity detection
 */
export const logSuspiciousActivity = async (userId, req, details) => {
    await logAuthAction({
        userId,
        action: AUDIT_ACTIONS.SUSPICIOUS_ACTIVITY,
        success: true,
        req,
        metadata: details
    });
};

/**
 * Gets user activity logs
 */
export const getUserActivity = async (userId, limit = 50) => {
    return await AuditLog.getUserActivity(userId, limit);
};

/**
 * Detects suspicious activity for a user
 */
export const detectSuspiciousActivity = async (userId) => {
    const result = await AuditLog.detectSuspiciousActivity(userId);

    if (result.suspiciousActivity) {
        // You could send alerts, notifications, etc. here
        console.warn(`Suspicious activity detected for user ${userId}:`, result.details);
    }

    return result;
};

/**
 * Gets authentication statistics
 */
export const getAuthStats = async (userId, days = 30) => {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [logins, failedLogins, passwordChanges] = await Promise.all([
        AuditLog.countDocuments({
            user: userId,
            action: AUDIT_ACTIONS.LOGIN,
            timestamp: { $gte: startDate }
        }),
        AuditLog.countDocuments({
            user: userId,
            action: AUDIT_ACTIONS.FAILED_LOGIN,
            timestamp: { $gte: startDate }
        }),
        AuditLog.countDocuments({
            user: userId,
            action: AUDIT_ACTIONS.PASSWORD_CHANGED,
            timestamp: { $gte: startDate }
        })
    ]);

    return {
        logins,
        failedLogins,
        passwordChanges,
        period: `Last ${days} days`
    };
};