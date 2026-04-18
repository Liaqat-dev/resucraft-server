import mongoose from 'mongoose';
import Review from '#models/Review.js';
import Template from '#models/Template.js';

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Recalculate and return the average rating for a template from the DB.
 */
const getAverageRating = async (templateId) => {
    const result = await Review.aggregate([
        { $match: { templateId: new mongoose.Types.ObjectId(templateId) } },
        {
            $group: {
                _id: '$templateId',
                averageRating: { $avg: '$rating' },
                totalReviews: { $sum: 1 },
            },
        },
    ]);

    if (result.length === 0) return { averageRating: 0, totalReviews: 0 };

    return {
        averageRating: Math.round(result[0].averageRating * 10) / 10, // 1 decimal
        totalReviews: result[0].totalReviews,
    };
};

// ─── Controllers ───────────────────────────────────────────────────────────────

/**
 * POST /api/reviews/:templateId
 * Create or update the authenticated user's review for a template.
 * Body: { rating: Number, reviewText?: String }
 */
export const upsertReview = async (req, res) => {
    try {
        const { templateId } = req.params;
        const { rating, reviewText = '' } = req.body;

        // Validate templateId
        if (!mongoose.Types.ObjectId.isValid(templateId)) {
            return res.status(400).json({ error: 'Invalid template ID' });
        }

        // Validate rating
        const parsedRating = Number(rating);
        if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
            return res.status(400).json({ error: 'Rating must be a whole number between 1 and 5' });
        }

        // Make sure the template exists and is public/published
        const template = await Template.findOne({
            _id: templateId,
            visibility: 'public',
            status: 'published',
        });

        if (!template) {
            return res.status(404).json({ error: 'Template not found or not available for review' });
        }

        // Upsert: create if not exists, update if already exists
        const review = await Review.findOneAndUpdate(
            { templateId, userId: req.user._id },
            { rating: parsedRating, reviewText: reviewText.trim() },
            { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
        ).populate('userId', 'username profilePic');

        const { averageRating, totalReviews } = await getAverageRating(templateId);

        return res.status(200).json({
            success: true,
            message: 'Review submitted successfully',
            review: {
                _id: review._id,
                templateId: review.templateId,
                rating: review.rating,
                reviewText: review.reviewText,
                createdAt: review.createdAt,
                updatedAt: review.updatedAt,
                user: {
                    _id: review.userId._id,
                    username: review.userId.username,
                    profilePic: review.userId.profilePic?.url || null,
                },
            },
            averageRating,
            totalReviews,
        });
    } catch (error) {
        console.error('Upsert Review Error:', error);

        // Duplicate key is already handled by upsert, but just in case
        if (error.code === 11000) {
            return res.status(409).json({ error: 'You have already reviewed this template' });
        }

        return res.status(500).json({ error: 'Failed to submit review', message: error.message });
    }
};

/**
 * GET /api/reviews/:templateId
 * Get all reviews for a template with user info + aggregate stats.
 * Public route — no auth required.
 * Query params: page (default 1), limit (default 10)
 */
export const getTemplateReviews = async (req, res) => {
    try {
        const { templateId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(templateId)) {
            return res.status(400).json({ error: 'Invalid template ID' });
        }

        const page  = Math.max(1, parseInt(req.query.page)  || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
        const skip  = (page - 1) * limit;

        const [reviews, { averageRating, totalReviews }] = await Promise.all([
            Review.find({ templateId })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('userId', 'username profilePic'),
            getAverageRating(templateId),
        ]);

        const formattedReviews = reviews.map((r) => ({
            _id: r._id,
            rating: r.rating,
            reviewText: r.reviewText,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
            user: {
                _id: r.userId._id,
                username: r.userId.username,
                profilePic: r.userId.profilePic?.url || null,
            },
        }));

        return res.status(200).json({
            success: true,
            templateId,
            averageRating,
            totalReviews,
            pagination: {
                page,
                limit,
                totalPages: Math.ceil(totalReviews / limit),
                hasNextPage: page * limit < totalReviews,
            },
            reviews: formattedReviews,
        });
    } catch (error) {
        console.error('Get Template Reviews Error:', error);
        return res.status(500).json({ error: 'Failed to fetch reviews', message: error.message });
    }
};

/**
 * GET /api/reviews/:templateId/my-review
 * Get the authenticated user's own review for a template (if any).
 */
export const getMyReview = async (req, res) => {
    try {
        const { templateId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(templateId)) {
            return res.status(400).json({ error: 'Invalid template ID' });
        }

        const review = await Review.findOne({ templateId, userId: req.user._id })
            .populate('userId', 'username profilePic');

        if (!review) {
            return res.status(200).json({ success: true, review: null });
        }

        return res.status(200).json({
            success: true,
            review: {
                _id: review._id,
                templateId: review.templateId,
                rating: review.rating,
                reviewText: review.reviewText,
                createdAt: review.createdAt,
                updatedAt: review.updatedAt,
                user: {
                    _id: review.userId._id,
                    username: review.userId.username,
                    profilePic: review.userId.profilePic?.url || null,
                },
            },
        });
    } catch (error) {
        console.error('Get My Review Error:', error);
        return res.status(500).json({ error: 'Failed to fetch your review', message: error.message });
    }
};

/**
 * DELETE /api/reviews/:templateId
 * Delete the authenticated user's review for a template.
 */
export const deleteReview = async (req, res) => {
    try {
        const { templateId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(templateId)) {
            return res.status(400).json({ error: 'Invalid template ID' });
        }

        const deleted = await Review.findOneAndDelete({ templateId, userId: req.user._id });

        if (!deleted) {
            return res.status(404).json({ error: 'Review not found' });
        }

        const { averageRating, totalReviews } = await getAverageRating(templateId);

        return res.status(200).json({
            success: true,
            message: 'Review deleted successfully',
            averageRating,
            totalReviews,
        });
    } catch (error) {
        console.error('Delete Review Error:', error);
        return res.status(500).json({ error: 'Failed to delete review', message: error.message });
    }
};

/**
 * DELETE /api/reviews/admin/:reviewId
 * Admin: delete any review by its ID.
 */
export const adminDeleteReview = async (req, res) => {
    try {
        const { reviewId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(reviewId)) {
            return res.status(400).json({ error: 'Invalid review ID' });
        }

        const deleted = await Review.findByIdAndDelete(reviewId);

        if (!deleted) {
            return res.status(404).json({ error: 'Review not found' });
        }

        const { averageRating, totalReviews } = await getAverageRating(deleted.templateId);

        return res.status(200).json({
            success: true,
            message: 'Review deleted by admin',
            averageRating,
            totalReviews,
        });
    } catch (error) {
        console.error('Admin Delete Review Error:', error);
        return res.status(500).json({ error: 'Failed to delete review', message: error.message });
    }
};
