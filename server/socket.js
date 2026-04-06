// server/socket.js
import { Server } from "socket.io";
import { processStudent } from "./ai/engine.js";
import { setAdminIO } from "./utils/logger.js";

export function initSocket(server) {
  const io = new Server(server, { cors: { origin: "*" } });

  // ── Admin namespace — receives all log events ──
  const adminIO = io.of("/admin");
  setAdminIO(adminIO); // wire logger to emit to /admin namespace

  adminIO.on("connection", (socket) => {
    console.log("🔧 Admin connected:", socket.id);
    socket.emit("log", { type: "system", message: "Admin dashboard connected. Watching live logs.", timestamp: new Date() });
    socket.on("disconnect", () => console.log("🔧 Admin disconnected:", socket.id));
  });

  // ── User namespace — student analysis ──
  io.on("connection", (socket) => {
    console.log("Student connected:", socket.id);

    socket.on("analyze", async (data) => {
      try {
        // Attach session id for log correlation
        const studentData = { ...data, session_id: socket.id };

        socket.emit("progress", { step: 1, message: "🤖 Consulting AI advisors (GPT-4, Gemini, Claude)..." });

        const result = await processStudent(studentData);

        socket.emit("progress", { step: 3, message: "✅ Analysis complete!" });
        socket.emit("result", result);
      } catch (err) {
        console.error("Analysis failed:", err);
        socket.emit("result", { error: "Analysis failed. Please try again." });
      }
    });

    socket.on("disconnect", () => console.log("Student disconnected:", socket.id));
  });
}
