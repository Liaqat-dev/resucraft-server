import User from '#models/User.js';
import Session from '#models/Session.js';
import Template from '#models/Template.js';
import catchAsync from '#utils/catchAsync.js';
import { AppError } from '#middlewares/errorHandler.js';
import { ROLES } from '#constants/authConstants.js';

const ALLOWED_ROLES = Object.values(ROLES);

/**
 * GET /api/admin/users
 * List all users with optional search + role filter + pagination
 */
export const listUsers = catchAsync(async (req, res) => {
    const { page = 1, limit = 20, role, search, suspended } = req.query;

    const filter = {};

    if (role) {
        if (!ALLOWED_ROLES.includes(role)) {
            throw new AppError(`Invalid role. Must be one of: ${ALLOWED_ROLES.join(', ')}`, 400);
        }
        filter.role = role;
    }

    if (suspended !== undefined) {
        filter.isSuspended = suspended === 'true';
    }

    if (search) {
        filter.$or = [
            { username: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
        ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [users, total] = await Promise.all([
        User.find(filter)
            .select('username email role isSuspended suspendedReason isVerified provider profilePic lastLogin createdAt')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit)),
        User.countDocuments(filter),
    ]);

    res.json({
        users,
        pagination: {
            total,
            page: Number(page),
            limit: Number(limit),
            pages: Math.ceil(total / Number(limit)),
        },
    });
});

/**
 * GET /api/admin/users/:id
 * Get a single user's details
 */
export const getUserById = catchAsync(async (req, res) => {
    const user = await User.findById(req.params.id)
        .select('-password -verificationCode -verificationCodeExpires -resetPasswordToken -resetPasswordExpires -twoFactorSecret -twoFactorBackupCodes');

    if (!user) throw new AppError('User not found', 404);

    res.json({ user });
});

/**
 * PATCH /api/admin/users/:id/role
 * Change a user's role  (admin only)
 */
export const updateUserRole = catchAsync(async (req, res) => {
    const { role } = req.body;

    if (!role || !ALLOWED_ROLES.includes(role)) {
        throw new AppError(`Invalid role. Must be one of: ${ALLOWED_ROLES.join(', ')}`, 400);
    }

    // Prevent admin from demoting themselves
    if (req.params.id === req.user._id.toString() && role !== ROLES.ADMIN) {
        throw new AppError('You cannot change your own admin role', 403);
    }

    const user = await User.findByIdAndUpdate(
        req.params.id,
        { role },
        { new: true, runValidators: true }
    ).select('username email role');

    if (!user) throw new AppError('User not found', 404);

    res.json({ message: `Role updated to '${role}'`, user });
});

/**
 * PATCH /api/admin/users/:id/suspend
 * Suspend a user (admin + moderator)
 */
export const suspendUser = catchAsync(async (req, res) => {
    const { reason } = req.body;

    if (req.params.id === req.user._id.toString()) {
        throw new AppError('You cannot suspend yourself', 403);
    }

    const target = await User.findById(req.params.id).select('role isSuspended username email');
    if (!target) throw new AppError('User not found', 404);

    // Moderators cannot suspend admins
    if (req.user.role === ROLES.MODERATOR && target.role === ROLES.ADMIN) {
        throw new AppError('Moderators cannot suspend admin accounts', 403);
    }

    target.isSuspended = true;
    target.suspendedReason = reason || null;
    await target.save();

    // Invalidate all active sessions for the suspended user
    await Session.updateMany({ user: target._id, isActive: true }, { isActive: false });

    res.json({ message: `User '${target.username}' has been suspended`, user: { _id: target._id, username: target.username, email: target.email, isSuspended: true } });
});

/**
 * PATCH /api/admin/users/:id/unsuspend
 * Remove suspension (admin + moderator)
 */
export const unsuspendUser = catchAsync(async (req, res) => {
    const user = await User.findByIdAndUpdate(
        req.params.id,
        { isSuspended: false, suspendedReason: null },
        { new: true }
    ).select('username email isSuspended');

    if (!user) throw new AppError('User not found', 404);

    res.json({ message: `User '${user.username}' has been unsuspended`, user });
});

/**
 * DELETE /api/admin/users/:id
 * Permanently delete a user account (admin only)
 */
export const deleteUser = catchAsync(async (req, res) => {
    if (req.params.id === req.user._id.toString()) {
        throw new AppError('You cannot delete your own account via admin panel', 403);
    }

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) throw new AppError('User not found', 404);

    // Clean up sessions
    await Session.deleteMany({ user: req.params.id });

    res.json({ message: `User '${user.username}' has been permanently deleted` });
});

/**
 * GET /api/admin/stats
 * High-level stats for admin dashboard
 */
export const getAdminStats = catchAsync(async (req, res) => {
    const [total, byRole, suspended, activeSessions] = await Promise.all([
        User.countDocuments(),
        User.aggregate([
            { $group: { _id: '$role', count: { $sum: 1 } } }
        ]),
        User.countDocuments({ isSuspended: true }),
        Session.countDocuments({ isActive: true }),
    ]);

    const roleBreakdown = { user: 0, moderator: 0, admin: 0 };
    byRole.forEach(r => { roleBreakdown[r._id] = r.count; });

    res.json({ total, roles: roleBreakdown, suspended, activeSessions });
});

/* ─────────────────────────────────────────────────────────
   TEMPLATE ADMIN
───────────────────────────────────────────────────────── */

/**
 * GET /api/admin/templates/stats
 * Counts by status and visibility
 */
export const getTemplateStats = catchAsync(async (req, res) => {
    const [statusAgg, visibilityAgg] = await Promise.all([
        Template.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
        Template.aggregate([{ $group: { _id: '$visibility', count: { $sum: 1 } } }]),
    ]);

    const status = { draft: 0, pending: 0, published: 0 };
    statusAgg.forEach(r => { if (r._id in status) status[r._id] = r.count; });

    const visibility = { public: 0, private: 0 };
    visibilityAgg.forEach(r => { if (r._id in visibility) visibility[r._id] = r.count; });

    res.json({
        total: status.draft + status.pending + status.published,
        status,
        visibility,
    });
});

/**
 * GET /api/admin/templates
 * List all templates with optional filters + pagination
 */
export const listAdminTemplates = catchAsync(async (req, res) => {
    const { page = 1, limit = 12, status, visibility, search, category } = req.query;

    const filter = {};
    if (status)     filter.status     = status;
    if (visibility) filter.visibility = visibility;
    if (category)   filter.category   = category;
    if (search)     filter.name       = { $regex: search, $options: 'i' };

    const skip = (Number(page) - 1) * Number(limit);
    const [templates, total] = await Promise.all([
        Template.find(filter)
            .populate('userId', 'username email profilePic')
            .sort({ updatedAt: -1 })
            .skip(skip)
            .limit(Number(limit)),
        Template.countDocuments(filter),
    ]);

    res.json({
        templates,
        pagination: {
            total,
            page:  Number(page),
            limit: Number(limit),
            pages: Math.ceil(total / Number(limit)),
        },
    });
});

/**
 * PATCH /api/admin/templates/:id/approve
 * Approve a pending template — sets status=approved, visibility=public
 */
export const approveTemplate = catchAsync(async (req, res) => {
    const template = await Template.findByIdAndUpdate(
        req.params.id,
        { status: 'published', visibility: 'public' },
        { new: true }
    ).populate('userId', 'username email');

    if (!template) throw new AppError('Template not found', 404);
    res.json({ message: `"${template.name}" approved and published`, template });
});

/**
 * PATCH /api/admin/templates/:id/reject
 * Reject a pending template — sets status=draft, visibility=private
 */
export const rejectTemplate = catchAsync(async (req, res) => {
    const template = await Template.findByIdAndUpdate(
        req.params.id,
        { status: 'draft', visibility: 'private' },
        { new: true }
    ).populate('userId', 'username email');

    if (!template) throw new AppError('Template not found', 404);
    res.json({ message: `"${template.name}" rejected`, template });
});

/**
 * DELETE /api/admin/templates/:id
 * Permanently delete any template (admin only)
 */
export const deleteAdminTemplate = catchAsync(async (req, res) => {
    const template = await Template.findByIdAndDelete(req.params.id);
    if (!template) throw new AppError('Template not found', 404);
    res.json({ message: `Template "${template.name}" deleted` });
});
