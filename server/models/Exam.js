    import mongoose from "mongoose";

    const examSchema = new mongoose.Schema({
    name: String,
    date: String,
    country: String,
    });

    export default mongoose.model("Exam", examSchema);