import mongoose from "mongoose";

const templateSchema = new mongoose.Schema({
    name: { type: String, required: true },
    data: {
        elements: [mongoose.Schema.Types.Mixed],
        sections: [mongoose.Schema.Types.Mixed],
        canvasSettings: mongoose.Schema.Types.Mixed
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model('Template', templateSchema);