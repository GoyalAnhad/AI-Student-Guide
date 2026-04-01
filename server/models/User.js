    import mongoose from "mongoose";

    const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    profile: Object,
    results: Object,
    });

    export default mongoose.model("User", userSchema);