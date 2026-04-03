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

app.use(
  cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : "*",
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
    await connectDB();
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Startup failed:", error);
    process.exit(1);
  }
}

start();
