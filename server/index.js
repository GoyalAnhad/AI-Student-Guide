  import express from "express";
  import cors from "cors";
  import dotenv from "dotenv";
  import http from "http";

  import authRoutes from "./routes/auth.js";
  import analyzeRoutes from "./routes/analyze.js";
  import adminRoutes from "./routes/admin.js";
  import { initSocket } from "./socket.js";
  import { connectDB } from "./db.js";

  dotenv.config();

  const app = express();
  const server = http.createServer(app);

  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim())
    : ["*"];

  app.use(
    cors({
      origin: allowedOrigins.includes("*") ? "*" : allowedOrigins,
      credentials: true,
    })
  );

  app.use(express.json());

  app.get("/", (req, res) => {
    res.json({ status: "ok", service: "career-ai-server" });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/analyze", analyzeRoutes);
  app.use("/api/admin", adminRoutes);

  initSocket(server);

  const PORT = process.env.PORT || 5000;

  async function start() {
    try {
      console.log("Starting server...");
      console.log("PORT:", PORT);
      console.log("MONGO_URI present:", Boolean(process.env.MONGO_URI));
      console.log("JWT_SECRET present:", Boolean(process.env.JWT_SECRET));
      console.log("CORS_ORIGIN:", process.env.CORS_ORIGIN || "not set");

      await connectDB();

      server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
      });
    } catch (error) {
      console.error("Startup failed:", error);
      process.exit(1);
    }
  }

  start();