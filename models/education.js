import mongoose from "mongoose";

const educationSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        school: { type: String, required: [true, "School name is required"] },
        degree: { type: String, required: [true, "Degree is required"] },
        fieldOfStudy: { type: String },
        startDate: { type: String, required: [true, "Start date is required"] }, // keep as YYYY-MM string
        endDate: { type: String }, // keep as YYYY-MM string
        grade: { type: String },
        description: { type: String }
    },
    { timestamps: true }
);

const Education = mongoose.model("Education", educationSchema);
export default Education;
