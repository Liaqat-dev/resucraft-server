import express from 'express';
import {
    upsertReview,
    getTemplateReviews,
    getMyReview,
    deleteReview,
    adminDeleteReview,
} from '#controllers/reviewController.js';
import { protect, requireVerified, requireRole } from '#middlewares/authMiddleware.js';

const router = express.Router();

// ── Public ────────────────────────────────────────────────────────────────────
// GET /api/reviews/:templateId  →  all reviews + aggregate stats (paginated)
router.get('/:templateId', getTemplateReviews);

// ── Authenticated routes ───────────────────────────────────────────────────────
router.use(protect, requireVerified);

// GET    /api/reviews/:templateId/my-review  →  current user's own review
router.get('/:templateId/my-review', getMyReview);

// POST   /api/reviews/:templateId  →  create or update own review
router.post('/:templateId', upsertReview);

// DELETE /api/reviews/:templateId  →  delete own review
router.delete('/:templateId', deleteReview);

// ── Admin routes ───────────────────────────────────────────────────────────────
// DELETE /api/reviews/admin/:reviewId  →  admin can delete any review
router.delete('/admin/:reviewId', requireRole('admin', 'moderator'), adminDeleteReview);

export default router;
