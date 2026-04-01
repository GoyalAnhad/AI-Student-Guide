    import mongoose from "mongoose";

    const uniSchema = new mongoose.Schema({
    name: String,
    location: String,
    });

    export default mongoose.model("University", uniSchema);
