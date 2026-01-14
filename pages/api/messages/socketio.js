import { Server } from "socket.io";
import { redisClient } from "../../../bullmq/redis";

let io;

export default function SocketHandler(req, res) {
  if (!res.socket.server.io) {
    console.log("Starting Socket.IO server...");
    io = new Server(res.socket.server, {
      path: "/api/messages/socketio",
      cors: {
        origin: "*", // restrict in production
      },
    });

    io.on("connection", async (socket) => {
      const userId = socket.handshake.query.userId;
      console.log("User connected:", socket.id);
      console.log({
        userId,
        socketId: socket.id,
        key: `socket:user:${userId}`,
      });

      if (userId) {
        await redisClient.set(`socket:user:${userId}`, socket.id, "EX", 3600);
      }

      socket.on("register", async (userId) => {
        socket.join(userId);
        await redisClient.set(`socket:user:${userId}`, socket.id, "EX", 3600);
        console.log(`User ${userId} joined their room`);
      });

      socket.on("disconnect", async () => {
        await redisClient.del(`socket:user:${userId}`);
        console.log("User disconnected:", socket.id);
      });
    });

    res.socket.server.io = io;
  }
  res.end();
}

export async function emitIncomingMessageToUser(userId, message) {
  const socketId = await redisClient.get(`socket:user:${userId}`);
  console.log({
    userId,
    socketId,
    io,
  });
  if (io && socketId) {
    io.to(socketId).emit("incomingMessage", message);
  }
}
export async function emitMessageStatusUpdateToUser(userId, message) {
  const socketId = await redisClient.get(`socket:user:${userId}`);
  console.log({
    userId,
    socketId,
    status: message.status,
  });
  if (io && socketId) {
    io.to(socketId).emit("messageStatusUpdate", message);
  }
}
