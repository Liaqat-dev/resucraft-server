import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        title: { type: String, required: [true, "Project title is required"] },
        description: { type: String },
        liveUrl: { type: String },
        repoUrl: { type: String },
        startDate: { type: String },
        endDate: { type: String },
        technologies: { type: [String], default: [] },
        status: {
            type: String,
            enum: ["planned", "in-progress", "completed"],
            default: "completed",
        },
    },
    { timestamps: true }
);

const Project = mongoose.model("Project", projectSchema);
export default Project;