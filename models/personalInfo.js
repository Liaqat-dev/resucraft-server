import mongoose from "mongoose";

const personalInfoSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        firstName: {
            type: String,
            minlength: [3, 'First must be at least 3 characters'],
            required: [true, 'First name is required'],
        },
        lastName: {
            type: String,
            minlength: [3, 'First must be at least 3 characters'],
            required: [true, 'First name is required'],
        },
        profession: {
            type: String,
            required: [true,'Profession is required'],
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            // unique: [true, 'Profile with this email already exists'],
        },
        dob: Date,
        bio: String,
        phone: {
            type: String,
            required: [true, 'Phone Number is required'],
        },
        address: {
            type: String,
            required: [true, 'Address is required'],
        },
        github: String,
        linkedin: String,
    },
    {timestamps: true}
);

export default mongoose.model("PersonalInfo", personalInfoSchema);