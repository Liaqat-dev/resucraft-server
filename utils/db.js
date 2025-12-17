import mongoose from "mongoose";
import catchAsync from "#utils/catchAsync.js";

const connectDB = catchAsync(async () => {
    await mongoose.connect(process.env.MONGODB_URI).then(() => console.log('✅ MongoDB Connected'));
})
export default connectDB;
