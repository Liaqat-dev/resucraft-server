import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            index: true
        },

        action: {
            type: String,
            required: true,
            index: true
        },

        success: {
            type: Boolean,
            default: true
        },

        ipAddress: {
            type: String,
            required: true
        },

        userAgent: String,

        location: {
            country: String,
            city: String
        },

        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },

        errorMessage: String,

        timestamp: {
            type: Date,
            default: Date.now,
        }
    },
    {
        timestamps: false
    }
);

// Indexes
auditLogSchema.index({ user: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }); // Keep logs for 90 days

// Static method to log action
auditLogSchema.statics.logAction = async function({
                                                      userId,
                                                      action,
                                                      success = true,
                                                      ipAddress,
                                                      userAgent,
                                                      metadata = {},
                                                      errorMessage = null
                                                  }) {
    try {
        await this.create({
            user: userId || null,
            action,
            success,
            ipAddress,
            userAgent,
            metadata,
            errorMessage
        });
    } catch (error) {
        console.error('Failed to create audit log:', error);
        // Don't throw - logging failures shouldn't break the app
    }
};

// Static method to get user activity
auditLogSchema.statics.getUserActivity = async function(userId, limit = 50) {
    return this.find({ user: userId })
        .sort({ timestamp: -1 })
        .limit(limit);
};

// Static method to detect suspicious activity
auditLogSchema.statics.detectSuspiciousActivity = async function(userId) {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Get recent failed login attempts
    const failedLogins = await this.countDocuments({
        user: userId,
        action: 'failed_login',
        success: false,
        timestamp: { $gte: last24Hours }
    });

    // Get logins from different IPs
    const recentLogins = await this.find({
        user: userId,
        action: 'login',
        success: true,
        timestamp: { $gte: last24Hours }
    }).select('ipAddress');

    const uniqueIPs = new Set(recentLogins.map(log => log.ipAddress));

    return {
        suspiciousActivity: failedLogins > 10 || uniqueIPs.size > 5,
        failedLogins,
        uniqueIPsCount: uniqueIPs.size,
        details: {
            multipleFailedAttempts: failedLogins > 10,
            multipleLocations: uniqueIPs.size > 5
        }
    };
};

export default mongoose.model('AuditLog', auditLogSchema);