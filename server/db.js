  import mongoose from "mongoose";

  export async function connectDB() {
    const uri = process.env.MONGO_URI;

    if (!uri) {
      throw new Error("MONGO_URI is not set");
    }

    try {
      await mongoose.connect(uri);
      console.log("DB connected");
    } catch (error) {
      console.error("MongoDB connection failed:", error.message);
      throw error;
    }
  }