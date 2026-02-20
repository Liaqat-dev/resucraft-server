
import mongoose from "mongoose";

const experienceSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        company: { type: String, required: [true, "Company name is required"] },
        role: { type: String, required: [true, "Role is required"] },
        startDate: { type: String, required: [true, "Start date is required"] },
        endDate: { type: String },
        currentlyWorking: { type: Boolean, default: false },
        description: { type: String }
    },
    { timestamps: true }
);

const Experience = mongoose.model("Experience", experienceSchema);
export default Experience;
