import express from 'express';
import { protect, requireVerified, requireRole } from '#middlewares/authMiddleware.js';
import {
    listUsers,
    getUserById,
    updateUserRole,
    suspendUser,
    unsuspendUser,
    deleteUser,
    getAdminStats,
    getTemplateStats,
    listAdminTemplates,
    approveTemplate,
    rejectTemplate,
    deleteAdminTemplate,
} from '#controllers/adminController.js';

const router = express.Router();

// All admin routes require authentication + verified email
router.use(protect, requireVerified);

// Stats — admin + moderator can view
router.get('/stats', requireRole('admin', 'moderator'), getAdminStats);

// User listing & details — admin + moderator
router.get('/users', requireRole('admin', 'moderator'), listUsers);
router.get('/users/:id', requireRole('admin', 'moderator'), getUserById);

// Role change — admin only
router.patch('/users/:id/role', requireRole('admin'), updateUserRole);

// Suspend / unsuspend — admin + moderator
router.patch('/users/:id/suspend', requireRole('admin', 'moderator'), suspendUser);
router.patch('/users/:id/unsuspend', requireRole('admin', 'moderator'), unsuspendUser);

// Delete — admin only
router.delete('/users/:id', requireRole('admin'), deleteUser);

// ── Template management ──────────────────────────────────────────────
// Stats & listing — admin + moderator
router.get('/templates/stats',          requireRole('admin', 'moderator'), getTemplateStats);
router.get('/templates',                requireRole('admin', 'moderator'), listAdminTemplates);

// Approve / reject — admin + moderator
router.patch('/templates/:id/approve',  requireRole('admin', 'moderator'), approveTemplate);
router.patch('/templates/:id/reject',   requireRole('admin', 'moderator'), rejectTemplate);

// Delete — admin only
router.delete('/templates/:id',         requireRole('admin'), deleteAdminTemplate);

export default router;
