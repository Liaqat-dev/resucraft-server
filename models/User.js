import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { AUTH_CONSTANTS } from "#constants/authConstants.js";

const userSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: [true, "Username is required"],
            unique: true,
            trim: true,
            lowercase: true,
            index: true
        },

        email: {
            type: String,
            required: [true, "Email is required"],
            unique: true,
            lowercase: true,
            trim: true,
            index: true,
            match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
        },

        password: {
            type: String,
            select: false,
            required: function () {
                return this.provider === "local";
            },
            validate: {
                validator: function (value) {
                    if (this.provider !== "local") return true;
                    if (!value || typeof value !== "string") return false;

                    const trimmed = value.trim();
                    if (trimmed.length < AUTH_CONSTANTS.PASSWORD_MIN_LENGTH) return false;

                    // Check password complexity
                    const hasLowercase = /[a-z]/.test(trimmed);
                    const hasUppercase = /[A-Z]/.test(trimmed);
                    const hasNumber = /[0-9]/.test(trimmed);
                    const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(trimmed);

                    return hasLowercase && hasUppercase && hasNumber && hasSymbol;
                },
                message: `Password must be at least ${AUTH_CONSTANTS.PASSWORD_MIN_LENGTH} characters and contain uppercase, lowercase, number, and special character`,
            },
        },

        provider: {
            type: String,
            enum: ["local", "google"],
            default: "local",
        },

        isVerified: {
            type: Boolean,
            default: false,
        },

        verificationCode: {
            type: String,
            select: false
        },

        verificationCodeExpires: {
            type: Date,
            select: false
        },

        resetPasswordToken: {
            type: String,
            select: false
        },

        resetPasswordExpires: {
            type: Date,
            select: false
        },

        // Security Features
        loginAttempts: {
            type: Number,
            default: 0,
            select: false
        },

        lockUntil: {
            type: Date,
            select: false
        },

        // Two-Factor Authentication
        twoFactorSecret: {
            type: String,
            select: false
        },

        twoFactorEnabled: {
            type: Boolean,
            default: false
        },

        twoFactorBackupCodes: [{
            code: String,
            used: { type: Boolean, default: false }
        }],

        // Profile
        profilePic: {
            url: {
                type: String,
            },
            deleteUrl: {
                type: String
            }
        },

        // Role & Status
        role: {
            type: String,
            enum: ['user', 'moderator', 'admin'],
            default: 'user',
            index: true,
        },

        isSuspended: {
            type: Boolean,
            default: false,
        },

        suspendedReason: {
            type: String,
            default: null,
        },

        // Metadata
        lastLogin: Date,
        lastPasswordChange: Date,
    },
    {
        timestamps: true,
        toJSON: {
            transform: function(doc, ret) {
                delete ret.password;
                delete ret.verificationCode;
                delete ret.verificationCodeExpires;
                delete ret.resetPasswordToken;
                delete ret.resetPasswordExpires;
                delete ret.loginAttempts;
                delete ret.lockUntil;
                delete ret.twoFactorSecret;
                delete ret.twoFactorBackupCodes;
                return ret;
            }
        }
    }
);

// Indexes
userSchema.index({ lockUntil: 1 });

// Virtual for checking if account is locked
userSchema.virtual('isLocked').get(function() {
    return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Hash password before saving
userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();

    this.password = await bcrypt.hash(this.password, 12);
    this.lastPasswordChange = new Date();
    next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

// Increment login attempts
userSchema.methods.incLoginAttempts = async function() {
    // If we have a previous lock that has expired, restart at 1
    if (this.lockUntil && this.lockUntil < Date.now()) {
        return this.updateOne({
            $set: { loginAttempts: 1 },
            $unset: { lockUntil: 1 }
        });
    }

    // Otherwise increment
    const updates = { $inc: { loginAttempts: 1 } };

    // Lock account after max attempts
    const needsLock = this.loginAttempts + 1 >= AUTH_CONSTANTS.MAX_LOGIN_ATTEMPTS;
    if (needsLock && !this.isLocked) {
        updates.$set = { lockUntil: Date.now() + AUTH_CONSTANTS.LOCK_TIME };
    }

    return this.updateOne(updates);
};

// Reset login attempts
userSchema.methods.resetLoginAttempts = async function() {
    return this.updateOne({
        $set: { loginAttempts: 0 },
        $unset: { lockUntil: 1 }
    });
};

export default mongoose.model('User', userSchema);