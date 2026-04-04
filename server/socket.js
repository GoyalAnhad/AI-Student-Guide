// server/socket.js
import { Server } from "socket.io";
import { processStudent } from "./ai/engine.js";

export function initSocket(server) {
  const io = new Server(server, { cors: { origin: "*" } });

  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    socket.on("analyze", async (data) => {
      try {
        socket.emit("progress", { step: 1, message: "🤖 Consulting GPT-4, Gemini & Claude..." });
        await delay(300);
        socket.emit("progress", { step: 2, message: "⚖️  AI debate & confidence scoring..." });

        const result = await processStudent(data);

        socket.emit("progress", { step: 3, message: "✅ Analysis complete!" });
        socket.emit("result", result);
      } catch (err) {
        console.error("Analysis failed:", err);
        socket.emit("result", { error: "Analysis failed. Please try again." });
      }
    });

    socket.on("disconnect", () => console.log("Socket disconnected:", socket.id));
  });
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
