import Session from '#models/Session.js';
import User from '#models/User.js';
import { AUTH_CONSTANTS, ERROR_MESSAGES, AUDIT_ACTIONS } from '#constants/authConstants.js';
import { AppError } from '#middlewares/errorHandler.js';
import {
    verifyAccessToken,
    verifyRefreshToken,
    generateTokenPair,
    generateAccessToken,
    generateRefreshToken
} from '#utils/tokenUtils.js';
import { generateDeviceId, parseUserAgent, getClientIp, formatSessionInfo } from '#utils/deviceUtils.js';
import { logAuthAction } from '#services/auditService.js';

/**
 * Creates a new session for a user
 */
export const createSession = async ({ userId, req, tokens = null }) => {
    if (!userId) {
        throw new AppError('UserId is required to create a session', 400);
    }

    // Get device information
    const userAgent = req.headers['user-agent'] || 'unknown';
    const ipAddress = getClientIp(req);
    const deviceId = generateDeviceId(userAgent, ipAddress);
    const deviceInfo = parseUserAgent(userAgent);

    console.log('Creating/updating session with IP:', ipAddress);
    console.log('Device ID:', deviceId);

    // ✅ Check if session already exists for this device
    const existingSession = await Session.findOne({
        user: userId,
        deviceId: deviceId,
        isActive: true
    });

    if (existingSession) {
        console.log('✅ Device recognized! Updating existing session:', existingSession._id);

        // Generate new tokens
        const { accessToken, refreshToken } = tokens || generateTokenPair(userId);

        // Update existing session
        existingSession.accessToken = accessToken;
        existingSession.refreshToken = refreshToken;
        existingSession.ipAddress = ipAddress || 'Unknown';
        existingSession.lastActivity = new Date();
        existingSession.expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

        // Update location if IP changed
        if (existingSession.ipAddress !== ipAddress) {
            const location = await getLocationFromIP(ipAddress);
            if (location) {
                existingSession.location = location;
            }
        }

        await existingSession.save();

        console.log('✅ Session updated:', {
            sessionId: existingSession._id,
            ipAddress: existingSession.ipAddress,
            deviceName: existingSession.deviceName,
            expiresAt: existingSession.expiresAt
        });

        return {
            session: existingSession,
            accessToken,
            refreshToken
        };
    }

    // No existing session - create new one
    console.log('🆕 New device detected, creating new session');

    // Generate tokens if not provided
    const { accessToken, refreshToken } = tokens || generateTokenPair(userId);

    // Check active sessions count
    const activeSessionsCount = await Session.getActiveSessionsCount(userId);

    if (activeSessionsCount >= AUTH_CONSTANTS.MAX_SESSIONS_PER_USER) {
        // Remove oldest session
        const oldestSession = await Session.findOne({
            user: userId,
            isActive: true
        }).sort({ lastActivity: 1 });

        if (oldestSession) {
            console.log('⚠️  Max sessions reached, removing oldest:', oldestSession._id);
            await oldestSession.revoke('Exceeded maximum sessions limit');
        }
    }

    // Set expiry far in the future
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year

    // Get location from IP
    const location = await getLocationFromIP(ipAddress);

    // Create session
    const session = await Session.create({
        user: userId,
        accessToken,
        refreshToken,
        deviceId,
        deviceName: deviceInfo.deviceName,
        userAgent,
        ipAddress: ipAddress || 'Unknown',
        location: location,
        expiresAt,
        lastActivity: new Date()
    });

    console.log('✅ New session created:', {
        sessionId: session._id,
        ipAddress: session.ipAddress,
        deviceName: session.deviceName,
        location: location,
        expiresAt: session.expiresAt
    });

    return {
        session,
        accessToken,
        refreshToken
    };
};

/**
 * Get location from IP address using ipapi.co
 */
const getLocationFromIP = async (ipAddress) => {
    // Skip for localhost/private IPs
    if (!ipAddress || ipAddress === 'Unknown' || ipAddress === '::1' ||
        ipAddress === '127.0.0.1' || ipAddress.startsWith('192.168.') ||
        ipAddress.startsWith('10.') || ipAddress.startsWith('172.')) {
        return null;
    }

    try {
        const response = await fetch(`https://ipapi.co/${ipAddress}/json/`, {
            headers: {
                'User-Agent': 'Mozilla/5.0'
            },
            signal: AbortSignal.timeout(5000) // 5 second timeout
        });

        if (!response.ok) {
            console.log('⚠️  IP geolocation failed:', response.status);
            return null;
        }

        const data = await response.json();

        if (data.error) {
            console.log('⚠️  IP geolocation error:', data.reason);
            return null;
        }

        return {
            country: data.country_name || null,
            city: data.city || null,
            coordinates: {
                lat: data.latitude || null,
                lng: data.longitude || null
            }
        };
    } catch (error) {
        console.log('⚠️  Location lookup failed:', error.message);
        return null;
    }
};

/**
 * Validates a session by access token
 */
export const validateSession = async (accessToken) => {
    if (!accessToken) {
        throw new AppError(ERROR_MESSAGES.INVALID_TOKEN, 401);
    }

    // Verify token
    let decoded;
    try {
        decoded = verifyAccessToken(accessToken);
    } catch (error) {
        // If access token is expired, throw specific error
        throw new AppError(error.message, 401);
    }

    // Find session
    const session = await Session.findOne({
        accessToken,
        isActive: true
    });

    if (!session) {
        throw new AppError(ERROR_MESSAGES.SESSION_EXPIRED, 401);
    }

    // ✅ Don't check session.expiresAt here - it's managed by refresh logic

    // Get user
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
        throw new AppError(ERROR_MESSAGES.USER_NOT_FOUND, 404);
    }

    // Check suspension
    if (user.isSuspended) {
        throw new AppError(
            user.suspendedReason
                ? `Account suspended: ${user.suspendedReason}`
                : 'Your account has been suspended. Please contact support.',
            403
        );
    }

    // Update last activity
    await session.updateActivity();

    return { user, session };
};

/**
 * Refreshes access token using refresh token
 * This extends the session indefinitely as long as user keeps refreshing
 */
export const refreshAccessToken = async (refreshToken, req) => {
    console.log('\n🔄 ========== TOKEN REFRESH START ==========');
    console.log('Refresh token received:', refreshToken ? refreshToken.substring(0, 20) + '...' : 'MISSING');

    if (!refreshToken) {
        console.error('❌ No refresh token provided');
        throw new AppError('Refresh token is required', 400);
    }

    // Verify refresh token
    let decoded;
    try {
        decoded = verifyRefreshToken(refreshToken);
        console.log('✅ Refresh token verified');
        console.log('   - User ID:', decoded.id);
        console.log('   - Token type:', decoded.type);
    } catch (error) {
        console.error('❌ Refresh token verification failed:', error.message);
        throw new AppError(error.message, 401);
    }

    // Find session by refresh token
    console.log('🔍 Searching for session with refresh token...');
    const session = await Session.findOne({
        refreshToken,
        isActive: true
    });

    console.log('Session query result:', session ? 'FOUND' : 'NOT FOUND');

    if (!session) {
        console.error('❌ Session not found with this refresh token');
        console.log('   Token claims user ID:', decoded.id);

        // Check if session exists with different user
        const sessionByToken = await Session.findOne({ refreshToken });
        if (sessionByToken) {
            console.error('⚠️⚠️⚠️ SESSION EXISTS BUT USER ID MISMATCH!');
            console.log('   Session user ID:', sessionByToken.user);
            console.log('   Token user ID:', decoded.id);
            console.log('   Session is active:', sessionByToken.isActive);
            throw new AppError('Token/Session user mismatch. Please log in again.', 401);
        }

        const allUserSessions = await Session.find({ user: decoded.id });
        console.log('   Total sessions for decoded user:', allUserSessions.length);

        if (allUserSessions.length > 0) {
            console.log('   User has sessions but refresh token does not match any:');
            allUserSessions.forEach((s, i) => {
                console.log(`   Session ${i + 1}:`, {
                    id: s._id,
                    isActive: s.isActive,
                    refreshTokenMatch: s.refreshToken === refreshToken,
                    refreshTokenPreview: s.refreshToken.substring(0, 30) + '...',
                    createdAt: s.createdAt,
                    expiresAt: s.expiresAt
                });
            });
        }

        throw new AppError('Session not found. Please log in again.', 401);
    }

    // Verify session belongs to the user in the token
    if (session.user.toString() !== decoded.id.toString()) {
        console.error('❌ Session user ID does not match token user ID');
        console.log('   Session user:', session.user);
        console.log('   Token user:', decoded.id);
        throw new AppError('Invalid session. Please log in again.', 401);
    }

    console.log('✅ Session found:');
    console.log('   - Session ID:', session._id);
    console.log('   - User ID:', session.user);
    console.log('   - Is Active:', session.isActive);
    console.log('   - Expires At:', session.expiresAt);
    console.log('   - Current Time:', new Date());
    console.log('   - Is Expired:', session.expiresAt < new Date());
    console.log('   - Last Activity:', session.lastActivity);

    // Generate NEW tokens
    const newAccessToken = generateAccessToken(decoded.id);
    const newRefreshToken = generateRefreshToken(decoded.id);

    console.log('✅ New tokens generated');
    console.log('   - New Access Token:', newAccessToken.substring(0, 20) + '...');
    console.log('   - New Refresh Token:', newRefreshToken.substring(0, 20) + '...');

    // Update session with new tokens
    const ipAddress = getClientIp(req);
    const oldAccessToken = session.accessToken;
    const oldRefreshToken = session.refreshToken;

    session.accessToken = newAccessToken;
    session.refreshToken = newRefreshToken;
    session.lastActivity = new Date();
    session.ipAddress = ipAddress || session.ipAddress;
    session.expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    console.log('💾 Saving session updates...');
    console.log('   - Old Access Token:', oldAccessToken.substring(0, 20) + '...');
    console.log('   - New Access Token:', session.accessToken.substring(0, 20) + '...');
    console.log('   - Old Refresh Token:', oldRefreshToken.substring(0, 20) + '...');
    console.log('   - New Refresh Token:', session.refreshToken.substring(0, 20) + '...');

    await session.save();

    console.log('✅ Session saved successfully');
    console.log('   - New Expires At:', session.expiresAt);

    // Log token refresh
    try {
        await logAuthAction({
            userId: decoded.id,
            action: AUDIT_ACTIONS.TOKEN_REFRESHED,
            success: true,
            req,
            metadata: { sessionId: session._id }
        });
        console.log('✅ Token refresh logged to audit');
    } catch (logError) {
        console.error('⚠️  Failed to log token refresh:', logError.message);
    }

    console.log('🎉 ========== TOKEN REFRESH SUCCESS ==========\n');

    return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        session
    };
};

/**
 * Destroys a session by token
 */
export const destroySession = async (accessToken) => {
    if (!accessToken) return;

    const session = await Session.findOne({ accessToken });
    if (session) {
        await session.revoke('User logged out');
    }
};

/**
 * Destroys all sessions for a user
 */
export const destroyAllUserSessions = async (userId, exceptSessionId = null) => {
    const query = {
        user: userId,
        isActive: true
    };

    if (exceptSessionId) {
        query._id = { $ne: exceptSessionId };
    }

    const sessions = await Session.find(query);

    await Promise.all(
        sessions.map(session => session.revoke('User logged out from all devices'))
    );

    return sessions.length;
};

/**
 * Gets all active sessions for a user
 */
export const getUserSessions = async (userId, currentAccessToken = null) => {
    const sessions = await Session.getUserActiveSessions(userId);

    return sessions.map(session => {
        const info = formatSessionInfo(session);

        // Mark current session
        if (currentAccessToken && session.accessToken === currentAccessToken) {
            info.isCurrent = true;
        }

        return info;
    });
};

/**
 * Revokes a specific session by session ID
 */
export const revokeSessionById = async (userId, sessionId) => {
    const session = await Session.findOne({
        _id: sessionId,
        user: userId,
        isActive: true
    });

    if (!session) {
        throw new AppError('Session not found', 404);
    }

    await session.revoke('Session revoked by user');
    return session;
};

/**
 * Cleans up expired sessions (can be run as a cron job)
 */
export const cleanupExpiredSessions = async () => {
    const result = await Session.cleanExpiredSessions();
    console.log(`Cleaned up ${result.deletedCount} expired sessions`);
    return result;
};

/**
 * Gets session statistics for a user
 */
export const getSessionStats = async (userId) => {
    const activeSessions = await Session.getActiveSessionsCount(userId);
    const allSessions = await Session.countDocuments({ user: userId });
    const recentActivity = await Session.findOne({
        user: userId,
        isActive: true
    }).sort({ lastActivity: -1 });

    return {
        activeSessions,
        totalSessions: allSessions,
        maxAllowed: AUTH_CONSTANTS.MAX_SESSIONS_PER_USER,
        lastActivity: recentActivity?.lastActivity || null
    };
};