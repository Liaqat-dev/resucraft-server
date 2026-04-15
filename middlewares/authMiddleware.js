import { AppError } from '#middlewares/errorHandler.js';
import { validateSession } from '#services/sessionService.js';
import { extractTokenFromHeader } from '#utils/tokenUtils.js';
import { ERROR_MESSAGES } from '#constants/authConstants.js';

/**
 * Protect routes - require authentication
 */
export const protect = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization || req.headers.Authorization;
        const token = extractTokenFromHeader(authHeader);

        if (!token) {
            throw new AppError('Not authorized. Please log in.', 401);
        }

        // Validate session and get user
        const { user, session } = await validateSession(token);

        // Attach user and session to request
        req.user = user;
        req.session = session;

        next();
    } catch (error) {
        next(error);
    }
};

/**
 * Require email verification
 */
export const requireVerified = async (req, res, next) => {
    try {
        if (!req.user) {
            throw new AppError('Not authorized', 401);
        }

        if (!req.user.isVerified) {
            throw new AppError(ERROR_MESSAGES.EMAIL_NOT_VERIFIED, 403);
        }

        next();
    } catch (error) {
        next(error);
    }
};

/**
 * Optional authentication - doesn't fail if no token
 */
export const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization || req.headers.Authorization;
        const token = extractTokenFromHeader(authHeader);

        if (token) {
            try {
                const { user, session } = await validateSession(token);
                req.user = user;
                req.session = session;
            } catch (error) {
                // Silently fail - optional auth
                req.user = null;
                req.session = null;
            }
        }

        next();
    } catch (error) {
        next(error);
    }
};

/**
 * Restrict access to users with specific roles
 * Usage: requireRole('admin') or requireRole('admin', 'moderator')
 */
export const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new AppError('Not authorized', 401));
        }

        if (!roles.includes(req.user.role)) {
            return next(
                new AppError('You do not have permission to perform this action', 403)
            );
        }

        next();
    };
};

/**
 * Restrict to specific providers (e.g., only local or only google)
 */
export const restrictToProvider = (...providers) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new AppError('Not authorized', 401));
        }

        if (!providers.includes(req.user.provider)) {
            return next(
                new AppError(
                    `This action is only available for ${providers.join(' or ')} users`,
                    403
                )
            );
        }

        next();
    };
};

/**
 * Check if user owns the resource
 */
export const checkOwnership = (getUserIdFromRequest) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new AppError('Not authorized', 401));
        }

        const resourceUserId = getUserIdFromRequest(req);

        if (resourceUserId.toString() !== req.user._id.toString()) {
            return next(
                new AppError('You do not have permission to access this resource', 403)
            );
        }

        next();
    };
};