export const ROLES = {
    USER: 'user',
    MODERATOR: 'moderator',
    ADMIN: 'admin',
};

export const AUTH_CONSTANTS = {
    // JWT Configuration
    JWT_EXPIRY: '15m',                    // Access token: 15 minutes
    REFRESH_TOKEN_EXPIRY: '30d',          // Refresh token: 30 days (long-lived)
    // NO SESSION_EXPIRY - Sessions never expire as long as tokens keep refreshing

    // Security Limits
    MAX_LOGIN_ATTEMPTS: 5,
    LOCK_TIME: 60 * 60 * 1000, // 1 hour
    MAX_SESSIONS_PER_USER: 5, // Maximum concurrent sessions

    // Password Requirements
    PASSWORD_MIN_LENGTH: 8,
    PASSWORD_MIN_LOWERCASE: 1,
    PASSWORD_MIN_UPPERCASE: 1,
    PASSWORD_MIN_NUMBERS: 1,
    PASSWORD_MIN_SYMBOLS: 1,
    // Verification & Reset
    VERIFICATION_CODE_EXPIRY: 24 * 60 * 60 * 1000, // 24 hours
    VERIFICATION_CODE_LENGTH: 6,
    RESET_TOKEN_EXPIRY: 60 * 60 * 1000, // 1 hour

    // Rate Limiting
    RATE_LIMIT: {
        LOGIN: {
            WINDOW_MS: 15 * 60 * 1000,
            MAX_REQUESTS: 5
        },
        EMAIL: {
            WINDOW_MS: 15 * 60 * 1000,
            MAX_REQUESTS: 3
        },
        VERIFICATION: {
            WINDOW_MS: 15 * 60 * 1000,
            MAX_REQUESTS: 3
        },
        STRICT: {
            WINDOW_MS: 15 * 60 * 1000,
            MAX_REQUESTS: 3
        }
    },

    REFRESH_TOKEN_COOKIE_OPTIONS: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        path: '/'
    },
};

export const AUDIT_ACTIONS = {
    LOGIN: 'login',
    LOGOUT: 'logout',
    LOGOUT_ALL: 'logout_all',
    REGISTER: 'register',
    EMAIL_VERIFIED: 'email_verified',
    PASSWORD_CHANGED: 'password_changed',
    PASSWORD_RESET_REQUESTED: 'password_reset_requested',
    PASSWORD_RESET_COMPLETED: 'password_reset_completed',
    FAILED_LOGIN: 'failed_login',
    ACCOUNT_LOCKED: 'account_locked',
    ACCOUNT_UNLOCKED: 'account_unlocked',
    TWO_FACTOR_ENABLED: '2fa_enabled',
    TWO_FACTOR_DISABLED: '2fa_disabled',
    SESSION_REVOKED: 'session_revoked',
    SUSPICIOUS_ACTIVITY: 'suspicious_activity',
    TOKEN_REFRESHED: 'token_refreshed'
};

export const ERROR_MESSAGES = {
    INVALID_CREDENTIALS: 'Invalid email/username or password',
    ACCOUNT_LOCKED: 'Account is locked due to multiple failed login attempts. Try again later.',
    EMAIL_NOT_VERIFIED: 'Please verify your email address before logging in',
    USER_NOT_FOUND: 'User not found',
    EMAIL_IN_USE: 'Email is already in use',
    USERNAME_IN_USE: 'Username is already in use',
    WEAK_PASSWORD: 'Password does not meet security requirements',
    INVALID_TOKEN: 'Invalid or expired token',
    SESSION_EXPIRED: 'Session has expired. Please log in again.',
    TWO_FACTOR_REQUIRED: 'Two-factor authentication code required',
    INVALID_2FA_CODE: 'Invalid two-factor authentication code',
    MAX_SESSIONS_REACHED: 'Maximum number of active sessions reached',
    VERIFICATION_CODE_EXPIRED: 'Verification code has expired',
    INVALID_VERIFICATION_CODE: 'Invalid verification code'
};