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
            next();
        } catch (err) {
            return next(new Error("Authentication error: Invalid or expired token"));
        }
    });

    io.on("connection", (socket: Socket) => {
        const userId = (socket as any).userId;
        console.log(`[WS] Client connected: ${socket.id} (User: ${userId})`);

        if (userId) {
            socket.join(`user:${userId}`);
            console.log(`[WS] Socket ${socket.id} joined room user:${userId}`);
        }

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
        console.log(`[WS] Emitted event '${event}' to user:${userId}`);
    }
}
