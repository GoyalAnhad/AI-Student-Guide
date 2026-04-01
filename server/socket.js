    import { Server } from "socket.io";
    import { processStudent } from "./ai/engine.js";

    export function initSocket(server) {
    const io = new Server(server, {
        cors: { origin: "*" },
    });

    io.on("connection", (socket) => {
        socket.on("analyze", (data) => {
        const result = processStudent(data);
        socket.emit("result", result);
        });
    });
    }