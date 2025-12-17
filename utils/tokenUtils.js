import jwt from 'jsonwebtoken';
import { AUTH_CONSTANTS } from '#constants/authConstants.js';

const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_SECRET || process.env.JWT_SECRET + '_refresh';

/**
 * Generates an access token
 */
export const generateAccessToken = (userId) => {
    if (!JWT_SECRET) {
        throw new Error('JWT_SECRET is not defined in environment variables');
    }

    return jwt.sign(
        { id: userId, type: 'access' },
        JWT_SECRET,
        { expiresIn: AUTH_CONSTANTS.JWT_EXPIRY }
    );
};

/**
 * Generates a refresh token
 */
export const generateRefreshToken = (userId) => {
    if (!REFRESH_SECRET) {
        throw new Error('REFRESH_SECRET is not defined in environment variables');
    }

    return jwt.sign(
        { id: userId, type: 'refresh' },
        REFRESH_SECRET,
        { expiresIn: AUTH_CONSTANTS.REFRESH_TOKEN_EXPIRY }
    );
};

/**
 * Generates both access and refresh tokens
 */
export const generateTokenPair = (userId) => {
    return {
        accessToken: generateAccessToken(userId),
        refreshToken: generateRefreshToken(userId)
    };
};

/**
 * Verifies an access token
 */
export const verifyAccessToken = (token) => {
    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        if (decoded.type !== 'access') {
            throw new Error('Invalid token type');
        }

        return decoded;
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            throw new Error('Access token has expired');
        }
        if (error.name === 'JsonWebTokenError') {
            throw new Error('Invalid access token');
        }
        throw error;
    }
};

/**
 * Verifies a refresh token
 */
export const verifyRefreshToken = (token) => {
    try {
        const decoded = jwt.verify(token, REFRESH_SECRET);

        if (decoded.type !== 'refresh') {
            throw new Error('Invalid token type');
        }

        return decoded;
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            throw new Error('Refresh token has expired');
        }
        if (error.name === 'JsonWebTokenError') {
            throw new Error('Invalid refresh token');
        }
        throw error;
    }
};

/**
 * Decodes a token without verification (useful for expired tokens)
 */
export const decodeToken = (token) => {
    try {
        return jwt.decode(token);
    } catch (error) {
        return null;
    }
};

/**
 * Checks if a token is expired
 */
export const isTokenExpired = (token) => {
    try {
        const decoded = decodeToken(token);
        if (!decoded || !decoded.exp) return true;

        return decoded.exp * 1000 < Date.now();
    } catch (error) {
        return true;
    }
};

/**
 * Gets token expiration date
 */
export const getTokenExpiration = (token) => {
    const decoded = decodeToken(token);
    if (!decoded || !decoded.exp) return null;

    return new Date(decoded.exp * 1000);
};

/**
 * Extracts token from Authorization header
 */
export const extractTokenFromHeader = (authHeader) => {
    if (!authHeader) return null;

    if (authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }

    return null;
};