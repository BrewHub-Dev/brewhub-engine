import { FastifyPluginAsync } from "fastify";
import { sign } from "jsonwebtoken";
import * as bcrypt from "bcryptjs";
import {
  deleteSessionByToken,
  findSessionsByUser,
  createSession,
  findActiveSessionsByUser,
  deleteSessionsByUser,
} from "./session.service";
import { findUserByEmail } from "../users/user.service";
import { AuthTokenPayload } from "@/auth/scope";

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
      const payload: AuthTokenPayload = {
        sub: user._id.toString(),
        role: user.role,
        shopId: user.ShopId ? user.ShopId.toString() : undefined,
        branchId:
          user.role === "BRANCH_ADMIN" && user.BranchId
            ? user.BranchId.toString()
            : undefined,
        defaultBranchId: user.BranchId ? user.BranchId.toString() : undefined,
      };

      const token = sign(payload, JWT_SECRET, { expiresIn: "1d" });
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await createSession(user._id, token, expiresAt);
      reply.setCookie("session", token, { httpOnly: true, path: "/" });
      reply.send({ ok: true, user, token });
    } catch (e) {
      reply.status(500).send({ error: (e as Error).message });
    }
  });
  app.get("/sessions", { config: { action: "sessions.list" }, preHandler: app.authenticate }, async (req, reply) => {
    try {
      if (!req.auth) {
        return reply.status(401).send({ error: "No auth context" });
      }

      const sessions = await findSessionsByUser(req.auth.identity.userId.toString());
      reply.send(sessions);
    } catch (e) {
      reply.status(401).send({ error: (e as Error).message });
    }
  });

  app.delete("/sessions", { config: { action: "sessions.delete" }, preHandler: app.authenticate }, async (req, reply) => {
    try {
      if (!req.auth) {
        return reply.status(401).send({ error: "No auth context" });
      }
      const token = req.auth.token;
      await deleteSessionByToken(token);
      reply.clearCookie("session");
      reply.send({ ok: true });
    } catch (e) {
      reply.status(500).send({ error: (e as Error).message });
    }
  });

  app.delete("/sessions/user/:id", { config: { action: "sessions.deleteByUser" }, preHandler: app.authenticate }, async (req, reply) => {
    try {
      if (!req.auth) {
        return reply.status(401).send({ error: "No auth context" });
      }

      const { id } = req.params as { id: string };

      if (req.auth.scope.role !== "ADMIN") {
        return reply.status(403).send({ error: "Forbidden" });
      }

      await deleteSessionsByUser(id);
      reply.send({ ok: true });
    } catch (e) {
      reply.status(500).send({ error: (e as Error).message });
    }
  });
};
