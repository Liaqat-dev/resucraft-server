import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },

        // Token Information
        accessToken: {
            type: String,
            required: true,
            unique: true,
            index: true
        },

        refreshToken: {
            type: String,
            required: true,
            unique: true,
            index: true
        },

        // Device Information
        deviceId: {
            type: String,
            required: true
        },

        deviceName: {
            type: String,
            default: 'Unknown Device'
        },

        userAgent: {
            type: String,
            required: true
        },

        ipAddress: {
            type: String,
            required: true
        },

        // Location (optional - can be added via IP geolocation)
        location: {
            country: String,
            city: String,
            coordinates: {
                lat: Number,
                lng: Number
            }
        },

        // Activity Tracking
        lastActivity: {
            type: Date,
            default: Date.now,
            index: true
        },

        createdAt: {
            type: Date,
            default: Date.now,
            index: true
        },

        expiresAt: {
            type: Date,
            required: true
            // ✅ REMOVED TTL index - we manage expiry manually
        },

        // Session Status
        isActive: {
            type: Boolean,
            default: true
        },

        revokedAt: Date,
        revokedReason: String,
    },
    {
        timestamps: true
    }
);

// Indexes
sessionSchema.index({ user: 1, isActive: 1 });
// ✅ REMOVED: sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
sessionSchema.index({ accessToken: 1 });
sessionSchema.index({ refreshToken: 1 });

// Virtual for checking if session is expired
sessionSchema.virtual('isExpired').get(function() {
    return this.expiresAt < new Date();
});

// Method to revoke session
sessionSchema.methods.revoke = async function(reason = 'User logged out') {
    this.isActive = false;
    this.revokedAt = new Date();
    this.revokedReason = reason;
    return this.save();
};

// Method to update last activity
sessionSchema.methods.updateActivity = async function() {
    this.lastActivity = new Date();
    return this.save();
};

// Static method to clean expired sessions
sessionSchema.statics.cleanExpiredSessions = async function() {
    const now = new Date();
    return this.deleteMany({
        $or: [
            { isActive: false, revokedAt: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
        ]
    });
};

// Static method to get active sessions count for user
sessionSchema.statics.getActiveSessionsCount = async function(userId) {
    return this.countDocuments({
        user: userId,
        isActive: true
    });
};

// Static method to get user's active sessions
sessionSchema.statics.getUserActiveSessions = async function(userId) {
    return this.find({
        user: userId,
        isActive: true
    }).sort({ lastActivity: -1 });
};

export default mongoose.model('Session', sessionSchema);