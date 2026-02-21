import mongoose from "mongoose";

const skillSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        name: {
            type: String,
            required: true,
        },
        category: {
            type: String,
            enum: ["Technical", "Soft", "Other"],
            required: true,
        },
    },
    { timestamps: true }
);

const Skill = mongoose.model("Skill", skillSchema);
export default Skill;