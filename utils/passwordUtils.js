import { AUTH_CONSTANTS } from "#constants/authConstants.js";

/**
 * Validates password strength based on security requirements
 */
export const validatePasswordStrength = (password) => {
    const errors = [];

    if (!password || typeof password !== 'string') {
        return { isValid: false, errors: ['Password is required'] };
    }

    const trimmed = password.trim();

    // Length check
    if (trimmed.length < AUTH_CONSTANTS.PASSWORD_MIN_LENGTH) {
        errors.push(`Password must be at least ${AUTH_CONSTANTS.PASSWORD_MIN_LENGTH} characters long`);
    }

    // Lowercase check
    const lowercaseCount = (trimmed.match(/[a-z]/g) || []).length;
    if (lowercaseCount < AUTH_CONSTANTS.PASSWORD_MIN_LOWERCASE) {
        errors.push(`Password must contain at least ${AUTH_CONSTANTS.PASSWORD_MIN_LOWERCASE} lowercase letter`);
    }

    // Uppercase check
    const uppercaseCount = (trimmed.match(/[A-Z]/g) || []).length;
    if (uppercaseCount < AUTH_CONSTANTS.PASSWORD_MIN_UPPERCASE) {
        errors.push(`Password must contain at least ${AUTH_CONSTANTS.PASSWORD_MIN_UPPERCASE} uppercase letter`);
    }

    // Number check
    const numberCount = (trimmed.match(/[0-9]/g) || []).length;
    if (numberCount < AUTH_CONSTANTS.PASSWORD_MIN_NUMBERS) {
        errors.push(`Password must contain at least ${AUTH_CONSTANTS.PASSWORD_MIN_NUMBERS} number`);
    }

    // Symbol check
    const symbolCount = (trimmed.match(/[!@#$%^&*(),.?":{}|<>]/g) || []).length;
    if (symbolCount < AUTH_CONSTANTS.PASSWORD_MIN_SYMBOLS) {
        errors.push(`Password must contain at least ${AUTH_CONSTANTS.PASSWORD_MIN_SYMBOLS} special character`);
    }

    // Common password patterns check
    const commonPatterns = [
        /^password/i,
        /^12345/,
        /^qwerty/i,
        /^admin/i,
        /^letmein/i,
        /^welcome/i
    ];

    for (const pattern of commonPatterns) {
        if (pattern.test(trimmed)) {
            errors.push('Password contains common patterns. Please choose a more unique password');
            break;
        }
    }

    // Sequential characters check
    if (/(.)\1{2,}/.test(trimmed)) {
        errors.push('Password contains too many repeating characters');
    }

    return {
        isValid: errors.length === 0,
        errors,
        strength: calculatePasswordStrength(trimmed)
    };
};

/**
 * Calculates password strength score (0-100)
 */
const calculatePasswordStrength = (password) => {
    let score = 0;

    // Length bonus
    score += Math.min(password.length * 4, 40);

    // Character variety bonus
    if (/[a-z]/.test(password)) score += 10;
    if (/[A-Z]/.test(password)) score += 10;
    if (/[0-9]/.test(password)) score += 10;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 15;

    // Additional character types
    if (/[^a-zA-Z0-9!@#$%^&*(),.?":{}|<>]/.test(password)) score += 10;

    // Variety bonus
    const uniqueChars = new Set(password.split('')).size;
    score += Math.min(uniqueChars * 2, 15);

    return Math.min(score, 100);
};

/**
 * Generates a random verification code
 */
export const generateVerificationCode = (length = AUTH_CONSTANTS.VERIFICATION_CODE_LENGTH) => {
    const digits = '0123456789';
    let code = '';

    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * digits.length);
        code += digits[randomIndex];
    }

    return code;
};

/**
 * Generates a secure random token
 */
export const generateSecureToken = (length = 32) => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';

    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        token += characters[randomIndex];
    }

    return token;
};

/**
 * Generates backup codes for 2FA
 */
export const generateBackupCodes = (count = 10) => {
    const codes = [];

    for (let i = 0; i < count; i++) {
        const code = generateSecureToken(8).match(/.{1,4}/g).join('-');
        codes.push(code);
    }

    return codes;
};