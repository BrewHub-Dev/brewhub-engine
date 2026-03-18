import { Server as HttpServer } from "node:http";
import { Server, Socket } from "socket.io";
import { verify } from "jsonwebtoken";
import { AuthTokenPayload } from "@/auth/scope";

const JWT_SECRET = process.env.JWT_SECRET || "";

let io: Server;

export function initWebSockets(server: HttpServer, corsOrigin: string) {
  io = new Server(server, {
    cors: {
      origin: corsOrigin,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(" ")[1];

    if (!token) {
      return next(new Error("Authentication error: Token missing"));
    }

    try {
      const decoded = verify(token, JWT_SECRET) as AuthTokenPayload;
      if (!decoded.sub) {
        return next(new Error("Authentication error: Invalid token structure"));
      }

      (socket as any).userId = decoded.sub;
      (socket as any).tokenPayload = decoded;
      next();
    } catch (err) {
      return next(new Error("Authentication error: Invalid or expired token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const userId = (socket as any).userId;
    const payload = (socket as any).tokenPayload as AuthTokenPayload;
    console.log(`[WS] Client connected: ${socket.id} (User: ${userId}, Role: ${payload?.role})`);

    if (userId) {
      socket.join(`user:${userId}`);
    }

    if (payload?.branchId) {
      socket.join(`branch:${payload.branchId}`);
      console.log(`[WS] Socket ${socket.id} joined branch:${payload.branchId}`);
    }
    if (payload?.shopId) {
      socket.join(`shop:${payload.shopId}`);
      console.log(`[WS] Socket ${socket.id} joined shop:${payload.shopId}`);
    }

    socket.on("join:room", (room: string) => {
      if (typeof room === "string" && (room.startsWith("branch:") || room.startsWith("shop:"))) {
        socket.join(room);
        console.log(`[WS] Socket ${socket.id} manually joined ${room}`);
      }
    });

    socket.on("disconnect", () => {
      console.log(`[WS] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
}

export function emitToUser(userId: string, event: string, payload: any) {
  if (io) {
    io.to(`user:${userId}`).emit(event, payload);
    console.log(`[WS] Emitted '${event}' to user:${userId}`);
  }
}

export function emitToBranch(branchId: string, event: string, payload: any) {
  if (io) {
    io.to(`branch:${branchId}`).emit(event, payload);
    console.log(`[WS] Emitted '${event}' to branch:${branchId}`);
  }
}

export function emitToShop(shopId: string, event: string, payload: any) {
  if (io) {
    io.to(`shop:${shopId}`).emit(event, payload);
    console.log(`[WS] Emitted '${event}' to shop:${shopId}`);
  }
}
