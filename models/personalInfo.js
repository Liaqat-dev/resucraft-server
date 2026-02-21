import mongoose from "mongoose";

const personalInfoSchema = new mongoose.Schema(
    {
            userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
            name: String,
            dob: Date,
            bio: String,
            phone: String,
            github: String,
            linkedin: String,
            profilePic: String,
    },
    { timestamps: true }
);

export default mongoose.model("PersonalInfo", personalInfoSchema);