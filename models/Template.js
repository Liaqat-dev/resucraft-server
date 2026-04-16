import mongoose from "mongoose";

const CATEGORIES = ['Modern', 'Classic', 'Creative', 'Minimal', 'Professional', 'Other'];
const VISIBILITY = ['public', 'private'];
const STATUS = ['draft', 'pending', 'published'];

const templateSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    category: { type: String, enum: CATEGORIES, default: 'Other' },
    visibility: { type: String, enum: VISIBILITY, default: 'private' },
    status: { type: String, enum: STATUS, default: 'draft' },
    data: {
        elements: [mongoose.Schema.Types.Mixed],
        sections: [mongoose.Schema.Types.Mixed],
        canvasSettings: mongoose.Schema.Types.Mixed
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model('Template', templateSchema);