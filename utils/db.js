import mongoose from "mongoose";

const connectDB = async () => {
    await mongoose.connect(process.env.MONGODB_URI).then(() => console.log('✅ MongoDB Connected'));
}
export default connectDB;
