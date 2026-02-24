import mongoose from "mongoose";

const certificateSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        name: { type: String, required: [true, "Certificate name is required"] },
        issuer: { type: String, required: [true, "Issuer is required"] },
        issueDate: { type: String, required: [true, "Issue date is required"] },
        expiryDate: { type: String },
        credentialId: { type: String },
        credentialUrl: { type: String },
        description: { type: String },
    },
    { timestamps: true }
);

const Certificate = mongoose.model("Certificate", certificateSchema);
export default Certificate;