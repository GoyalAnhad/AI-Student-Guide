    import express from "express";
    import cors from "cors";
    import dotenv from "dotenv";
    import mongoose from "mongoose";
    import http from "http";

    import authRoutes from "./routes/auth.js";
    import analyzeRoutes from "./routes/analyze.js";
    import adminRoutes from "./routes/admin.js";

    import { initSocket } from "./socket.js";

    dotenv.config();

    const app = express();
    const server = http.createServer(app);

    // Middleware
    app.use(cors());
    app.use(express.json());

    // Routes
    app.use("/api/auth", authRoutes);
    app.use("/api/analyze", analyzeRoutes);
    app.use("/api/admin", adminRoutes);

    // DB Connection
    mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected"))
    .catch((err) => console.log("❌ DB Error:", err));

    // Socket
    initSocket(server);

    // Start Server
    const PORT = process.env.PORT || 5000;

    server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    });