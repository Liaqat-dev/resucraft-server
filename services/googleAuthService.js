import User from '#models/User.js';
import { AppError } from '#middlewares/errorHandler.js';
import { logRegistration } from '#services/auditService.js';

/**
 * Authenticate or register user via Google OAuth
 */
export const googleAuthService = async (googleAccessToken, req) => {
    try {
        // Verify Google token and get user info
        const response = await fetch(
            `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${googleAccessToken}`
        );

        if (!response.ok) {
            throw new AppError('Invalid Google access token', 401);
        }

        const googleUser = await response.json();

        if (!googleUser.email || !googleUser.email_verified) {
            throw new AppError('Google email not verified', 400);
        }

        // Check if user exists
        let user = await User.findOne({ email: googleUser.email.toLowerCase() });

        if (user) {
            // User exists
            if (user.provider === 'local') {
                throw new AppError(
                    'An account with this email already exists. Please log in with email and password.',
                    409
                );
            }

            // Update last login
            user.lastLogin = new Date();
            await user.save();

            return user;
        }

        // Create new user
        const username = googleUser.email.split('@')[0].toLowerCase() +
            Math.random().toString(36).substring(2, 6);

        user = await User.create({
            name: googleUser.name || googleUser.email.split('@')[0],
            username,
            email: googleUser.email.toLowerCase(),
            provider: 'google',
            isVerified: true, // Google users are pre-verified
            profilePic: googleUser.picture || '',
            lastLogin: new Date()
        });

        // Log registration
        await logRegistration(user._id, req, 'google');

        return user;
    } catch (error) {
        if (error instanceof AppError) {
            throw error;
        }

        console.error('Google auth error:', error);
        throw new AppError('Failed to authenticate with Google', 500);
    }
};