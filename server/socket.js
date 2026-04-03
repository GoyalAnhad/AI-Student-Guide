import { Server } from "socket.io";
import { processStudent } from "./ai/engine.js";

export function initSocket(server) {
  const io = new Server(server, {
    cors: { origin: "*" },
  });

  io.on("connection", (socket) => {
    socket.on("analyze", async (data) => {
      try {
        const result = await processStudent(data);
        socket.emit("result", result);
      } catch (error) {
        socket.emit("result", { error: "Analysis failed" });
      }
    });
  });
}
