import crypto from 'crypto';

/**
 * Generates a unique device ID based on user agent and other factors
 * ✅ FIXED: Don't include IP in device ID (IP can change, device stays same)
 */
export const generateDeviceId = (userAgent) => {
    const hash = crypto.createHash('sha256');
    // Only use user agent for device fingerprint
    hash.update(userAgent);
    return hash.digest('hex');
};

/**
 * Parses user agent to extract device information
 */
export const parseUserAgent = (userAgent) => {
    if (!userAgent) {
        return {
            deviceName: 'Unknown Device',
            browser: 'Unknown',
            os: 'Unknown',
            deviceType: 'Unknown'
        };
    }

    let deviceName = 'Unknown Device';
    let browser = 'Unknown';
    let os = 'Unknown';
    let deviceType = 'desktop';

    // Detect OS
    if (/Windows/i.test(userAgent)) {
        os = 'Windows';
        if (/Windows NT 10/i.test(userAgent)) os = 'Windows 10/11';
        else if (/Windows NT 6.3/i.test(userAgent)) os = 'Windows 8.1';
        else if (/Windows NT 6.2/i.test(userAgent)) os = 'Windows 8';
    } else if (/Mac OS X/i.test(userAgent)) {
        os = 'macOS';
    } else if (/Linux/i.test(userAgent)) {
        os = 'Linux';
    } else if (/Android/i.test(userAgent)) {
        os = 'Android';
        deviceType = 'mobile';
    } else if (/iPhone|iPad|iPod/i.test(userAgent)) {
        os = userAgent.includes('iPad') ? 'iPadOS' : 'iOS';
        deviceType = userAgent.includes('iPad') ? 'tablet' : 'mobile';
    }

    // Detect Browser
    if (/Chrome/i.test(userAgent) && !/Edg/i.test(userAgent)) {
        browser = 'Chrome';
    } else if (/Safari/i.test(userAgent) && !/Chrome/i.test(userAgent)) {
        browser = 'Safari';
    } else if (/Firefox/i.test(userAgent)) {
        browser = 'Firefox';
    } else if (/Edg/i.test(userAgent)) {
        browser = 'Edge';
    } else if (/Opera|OPR/i.test(userAgent)) {
        browser = 'Opera';
    } else if (/Postman/i.test(userAgent)) {
        browser = 'Postman';
    }

    // Detect device type
    if (/Mobile/i.test(userAgent) && deviceType === 'desktop') {
        deviceType = 'mobile';
    } else if (/Tablet|iPad/i.test(userAgent)) {
        deviceType = 'tablet';
    }

    // Create device name
    if (deviceType === 'mobile') {
        deviceName = `${os} Mobile (${browser})`;
    } else if (deviceType === 'tablet') {
        deviceName = `${os} Tablet (${browser})`;
    } else {
        deviceName = `${os} Desktop (${browser})`;
    }

    return {
        deviceName,
        browser,
        os,
        deviceType
    };
};

/**
 * Extracts REAL IP address from request (handles proxies, nginx, cloudflare, etc.)
 */
export const getClientIp = (req) => {
    // Priority order for IP extraction

    // 1. Check Cloudflare header
    if (req.headers['cf-connecting-ip']) {
        return req.headers['cf-connecting-ip'];
    }

    // 2. Check X-Forwarded-For (most common with proxies/load balancers)
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        // X-Forwarded-For can contain multiple IPs: "client, proxy1, proxy2"
        // The first one is the real client IP
        const ips = forwarded.split(',').map(ip => ip.trim());
        return ips[0];
    }

    // 3. Check X-Real-IP (nginx)
    if (req.headers['x-real-ip']) {
        return req.headers['x-real-ip'];
    }

    // 4. Check X-Client-IP
    if (req.headers['x-client-ip']) {
        return req.headers['x-client-ip'];
    }

    // 5. Check X-Cluster-Client-IP
    if (req.headers['x-cluster-client-ip']) {
        return req.headers['x-cluster-client-ip'];
    }

    // 6. Fall back to connection remote address
    const remoteAddress = req.connection?.remoteAddress ||
        req.socket?.remoteAddress ||
        req.connection?.socket?.remoteAddress;

    if (remoteAddress) {
        // Remove IPv6 prefix if present (::ffff:192.168.1.1 -> 192.168.1.1)
        return remoteAddress.replace(/^::ffff:/, '');
    }

    return 'Unknown';
};

/**
 * Checks if two devices are the same
 */
export const isSameDevice = (deviceId1, deviceId2) => {
    return deviceId1 === deviceId2;
};

/**
 * Formats session information for display
 */
export const formatSessionInfo = (session) => {
    const deviceInfo = parseUserAgent(session.userAgent);

    return {
        sessionId: session._id,
        deviceId: session.deviceId,
        deviceName: session.deviceName || deviceInfo.deviceName,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        deviceType: deviceInfo.deviceType,
        ipAddress: session.ipAddress,
        location: session.location,
        lastActivity: session.lastActivity,
        createdAt: session.createdAt,
        isCurrent: false // Will be set by the caller
    };
};