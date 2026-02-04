import { FastifyPluginAsync } from "fastify";
import { sign, verify } from "jsonwebtoken";
import * as bcrypt from "bcryptjs";
import {
  deleteSessionByToken,
  findSessionByToken,
  findSessionsByUser,
  createSession,
  findActiveSessionsByUser,
} from "./session.service";
import { findUserByEmail } from "../users/user.service";

const JWT_SECRET = process.env.JWT_SECRET;
interface LoginRequest {
  emailAddress: string;
  password: string;
}

export const sessionRoutes: FastifyPluginAsync = async (app) => {
  app.post("/login", { config: { action: "sessions.login" } }, async (req, reply) => {
    try {
      const { emailAddress, password } = req.body as LoginRequest;
      if (!emailAddress || !password)
        return reply.status(400).send({ error: "Missing credentials" });

      const user = await findUserByEmail(emailAddress);
      if (!user) return reply.status(401).send({ error: "Invalid credentials" });

      const valid = await bcrypt.compare(password, user.password || "");
      if (!valid) return reply.status(401).send({ error: "Invalid credentials" });

      const activeSessions = await findActiveSessionsByUser(user._id);
      if (activeSessions.length > 0) {
        return reply
          .status(409)
          .send({ error: "User already has an active session" });
      }

      const token = sign({ user }, JWT_SECRET, { expiresIn: "1d" });
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await createSession(user._id, token, expiresAt);
      reply.setCookie("session", token, { httpOnly: true, path: "/" });
      reply.send({ ok: true, user, token });
    } catch (e) {
      reply.status(500).send({ error: (e as Error).message });
    }
  });
  app.get("/sessions", { config: { action: "sessions.list" } }, async (req, reply) => {
    try {
      const token = req.cookies?.session;
      if (!token) return reply.status(401).send({ error: "No session" });
      const payload = verify(token, JWT_SECRET);
      const stored = await findSessionByToken(token);
      if (!stored) return reply.status(401).send({ error: "Invalid session" });
      const sessions = await findSessionsByUser(payload.user._id || payload.user);
      reply.send(sessions);
    } catch (e) {
      reply.status(401).send({ error: (e as Error).message });
    }
  });

  app.delete("/sessions", { config: { action: "sessions.delete" } }, async (req, reply) => {
    try {
      const token = req.cookies?.session;
      if (!token) return reply.status(400).send({ error: "No session" });
      await deleteSessionByToken(token);
      reply.clearCookie("session");
      reply.send({ ok: true });
    } catch (e) {
      reply.status(500).send({ error: (e as Error).message });
    }
  });
};
