import User from '#models/User.js';
import PersonalInfo from '#models/personalInfo.js';
import { AppError } from '#middlewares/errorHandler.js';
import { AUTH_CONSTANTS, ERROR_MESSAGES } from '#constants/authConstants.js';
import { validatePasswordStrength, generateVerificationCode, generateSecureToken } from '#utils/passwordUtils.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '#services/emailService.js';
import { logRegistration, logFailedLogin, logEmailVerified, logPasswordResetRequest, logPasswordResetComplete, logAccountLocked } from '#services/auditService.js';

/**
 * Register a new user
 */
export const registerUser = async (userData, req) => {
    const { name, username, email, password, provider = 'local' } = userData;

    // Validate required fields
    if (!name || !email || !username) {
        throw new AppError('Name, email, and username are required', 400);
    }

    // Validate password for local auth
    if (provider === 'local') {
        if (!password) {
            throw new AppError('Password is required', 400);
        }

        const passwordValidation = validatePasswordStrength(password);
        if (!passwordValidation.isValid) {
            throw new AppError(
                'Password does not meet security requirements',
                400,
                { password: passwordValidation.errors }
            );
        }
    }

    // Check if user already exists
    const existingUser = await User.findOne({
        $or: [{ email }, { username }]
    });

    if (existingUser) {
        if (existingUser.email === email) {
            throw new AppError(ERROR_MESSAGES.EMAIL_IN_USE, 409);
        }
        if (existingUser.username === username) {
            throw new AppError(ERROR_MESSAGES.USERNAME_IN_USE, 409);
        }
    }

    // Generate verification code
    const verificationCode = generateVerificationCode();
    const verificationCodeExpires = new Date(
        Date.now() + AUTH_CONSTANTS.VERIFICATION_CODE_EXPIRY
    );

    // Create user
    const user = await User.create({
        name,
        username: username.toLowerCase(),
        email: email.toLowerCase(),
        password,
        provider,
        verificationCode,
        verificationCodeExpires,
        isVerified: provider !== 'local' // Auto-verify OAuth users
    });

    // Send verification email for local users
    if (provider === 'local') {
        await sendVerificationEmail(email, verificationCode);
    }

    // Log registration
    await logRegistration(user._id, req, provider);

    return {
        message: provider === 'local'
            ? 'Registration successful. Please check your email for verification code.'
            : 'Registration successful',
        email: user.email,
        needsVerification: provider === 'local'
    };
};

/**
 * Verify user email
 */
export const verifyUserEmail = async (data, req) => {
    const { email, code } = data;

    if (!email || !code) {
        throw new AppError('Email and verification code are required', 400);
    }

    const user = await User.findOne({ email: email.toLowerCase() })
        .select('+verificationCode +verificationCodeExpires');

    if (!user) {
        throw new AppError(ERROR_MESSAGES.USER_NOT_FOUND, 404);
    }

    if (user.isVerified) {
        throw new AppError('Email is already verified', 400);
    }

    if (!user.verificationCode || !user.verificationCodeExpires) {
        throw new AppError('No verification code found. Please request a new one.', 400);
    }

    if (user.verificationCodeExpires < new Date()) {
        throw new AppError(ERROR_MESSAGES.VERIFICATION_CODE_EXPIRED, 400);
    }

    if (user.verificationCode !== code) {
        throw new AppError(ERROR_MESSAGES.INVALID_VERIFICATION_CODE, 400);
    }

    // Verify user
    user.isVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    await user.save();

    // Log email verification
    await logEmailVerified(user._id, req);

    return {
        message: 'Email verified successfully. You can now log in.',
        isVerified: true
    };
};

/**
 * Resend verification code
 */
export const resendVerificationCode = async (email, req) => {
    if (!email) {
        throw new AppError('Email is required', 400);
    }

    const user = await User.findOne({ email: email.toLowerCase() })
        .select('+verificationCodeExpires');

    if (!user) {
        // Don't reveal if email exists
        return {
            message: 'If that email exists and is not verified, a new code has been sent.'
        };
    }

    if (user.isVerified) {
        throw new AppError('Email is already verified', 400);
    }

    // Generate new code
    const verificationCode = generateVerificationCode();
    const verificationCodeExpires = new Date(
        Date.now() + AUTH_CONSTANTS.VERIFICATION_CODE_EXPIRY
    );

    user.verificationCode = verificationCode;
    user.verificationCodeExpires = verificationCodeExpires;
    await user.save();

    // Send email
    await sendVerificationEmail(email, verificationCode);

    return {
        message: 'Verification code sent successfully.',
        expiresIn: AUTH_CONSTANTS.VERIFICATION_CODE_EXPIRY / (1000 * 60) + ' minutes'
    };
};

/**
 * Login user
 */
export const loginUser = async (emailOrUsername, password, req) => {
    if (!emailOrUsername || !password) {
        throw new AppError('Email/username and password are required', 400);
    }

    // Find user
    const user = await User.findOne({
        $or: [
            { email: emailOrUsername.toLowerCase() },
            { username: emailOrUsername.toLowerCase() }
        ]
    }).select('+password +loginAttempts +lockUntil +twoFactorEnabled +twoFactorSecret');

    if (!user || user.provider !== 'local') {
        await logFailedLogin(emailOrUsername, req, ERROR_MESSAGES.INVALID_CREDENTIALS);
        throw new AppError(ERROR_MESSAGES.INVALID_CREDENTIALS, 401);
    }

    // Check if account is locked
    if (user.isLocked) {
        const lockTimeRemaining = Math.ceil((user.lockUntil - Date.now()) / 60000);
        await logFailedLogin(emailOrUsername, req, ERROR_MESSAGES.ACCOUNT_LOCKED);
        throw new AppError(
            `${ERROR_MESSAGES.ACCOUNT_LOCKED} Try again in ${lockTimeRemaining} minutes.`,
            423
        );
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
        await user.incLoginAttempts();

        // Check if account just got locked
        if (user.loginAttempts + 1 >= AUTH_CONSTANTS.MAX_LOGIN_ATTEMPTS) {
            await logAccountLocked(user._id, req);
        }

        await logFailedLogin(emailOrUsername, req, ERROR_MESSAGES.INVALID_CREDENTIALS);
        throw new AppError(ERROR_MESSAGES.INVALID_CREDENTIALS, 401);
    }

    // Check if email is verified
    if (!user.isVerified) {
        return {
            needsVerification: true,
            email: user.email,
            message: ERROR_MESSAGES.EMAIL_NOT_VERIFIED
        };
    }

    // Check if 2FA is enabled
    if (user.twoFactorEnabled) {
        return {
            needs2FA: true,
            userId: user._id,
            message: ERROR_MESSAGES.TWO_FACTOR_REQUIRED
        };
    }

    // Reset login attempts on successful login
    if (user.loginAttempts > 0 || user.lockUntil) {
        await user.resetLoginAttempts();
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    return user;
};

/**
 * Fetch profilePic URL from PersonalInfo for a given userId.
 * Returns null if no record exists yet.
 */
export const getProfilePic = async (userId) => {
    const info = await PersonalInfo.findOne({ userId }).select('profilePic').lean();
    return info?.profilePic || null;
};

/**
 * Get user profile (includes profilePic from PersonalInfo)
 */
export const getUserProfile = async (userId) => {
    const user = await User.findById(userId);

    if (!user) {
        throw new AppError(ERROR_MESSAGES.USER_NOT_FOUND, 404);
    }

    const profilePic = await getProfilePic(userId);

    return { ...user.toObject(), profilePic };
};

/**
 * Forgot password - send reset link
 */
export const forgotPasswordService = async (email, req) => {
    if (!email) {
        throw new AppError('Email is required', 400);
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    // Don't reveal if email exists
    if (!user) {
        return;
    }

    // Generate reset token
    const resetToken = generateSecureToken(32);
    const resetTokenExpires = new Date(Date.now() + AUTH_CONSTANTS.RESET_TOKEN_EXPIRY);

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetTokenExpires;
    await user.save();

    // Send reset email
    await sendPasswordResetEmail(email, resetToken);

    // Log password reset request
    await logPasswordResetRequest(user._id, req);
};

/**
 * Reset password using token
 */
export const resetPasswordService = async (token, password, confirmPassword, req) => {
    if (!token || !password || !confirmPassword) {
        throw new AppError('Token, password, and confirmation are required', 400);
    }

    if (password !== confirmPassword) {
        throw new AppError('Passwords do not match', 400);
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
        throw new AppError(
            'Password does not meet security requirements',
            400,
            { password: passwordValidation.errors }
        );
    }

    // Find user with valid token
    const user = await User.findOne({
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: new Date() }
    }).select('+password +passwordHistory');

    if (!user) {
        throw new AppError(ERROR_MESSAGES.INVALID_TOKEN, 400);
    }

    // Check if password was used recently
    const wasUsed = await user.wasPasswordUsedRecently(password);
    if (wasUsed) {
        throw new AppError(ERROR_MESSAGES.PASSWORD_REUSED, 400);
    }

    // Update password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();

    // Log password reset
    await logPasswordResetComplete(user._id, req);

    return {
        message: 'Password has been reset successfully. You can now log in.'
    };
};

/**
 * Change password (for logged-in users)
 */
export const changePassword = async (userId, currentPassword, newPassword, req) => {
    if (!currentPassword || !newPassword) {
        throw new AppError('Current password and new password are required', 400);
    }

    const user = await User.findById(userId).select('+password +passwordHistory');

    if (!user) {
        throw new AppError(ERROR_MESSAGES.USER_NOT_FOUND, 404);
    }

    // Verify current password
    const isValid = await user.comparePassword(currentPassword);
    if (!isValid) {
        throw new AppError('Current password is incorrect', 401);
    }

    // Validate new password
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.isValid) {
        throw new AppError(
            'Password does not meet security requirements',
            400,
            { password: passwordValidation.errors }
        );
    }

    // Check if password was used recently
    const wasUsed = await user.wasPasswordUsedRecently(newPassword);
    if (wasUsed) {
        throw new AppError(ERROR_MESSAGES.PASSWORD_REUSED, 400);
    }

    // Update password
    user.password = newPassword;
    await user.save();

    return {
        message: 'Password changed successfully'
    };
};