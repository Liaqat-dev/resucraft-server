import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
    {
        templateId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Template',
            required: [true, 'Template ID is required'],
            index: true,
        },

        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User ID is required'],
            index: true,
        },

        rating: {
            type: Number,
            required: [true, 'Rating is required'],
            min: [1, 'Rating must be at least 1'],
            max: [5, 'Rating must be at most 5'],
            validate: {
                validator: Number.isInteger,
                message: 'Rating must be a whole number between 1 and 5',
            },
        },

        reviewText: {
            type: String,
            trim: true,
            maxlength: [1000, 'Review text must be 1000 characters or fewer'],
            default: '',
        },
    },
    {
        timestamps: true,
    }
);

// One review per user per template
reviewSchema.index({ templateId: 1, userId: 1 }, { unique: true });

export default mongoose.model('Review', reviewSchema);
