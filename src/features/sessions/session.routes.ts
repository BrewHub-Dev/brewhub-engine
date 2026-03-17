import { FastifyPluginAsync } from "fastify";
import { sign, decode } from "jsonwebtoken";
import * as bcrypt from "bcryptjs";
import {
  deleteSessionByToken,
  findSessionsByUser,
  createSession,
  deleteSessionsByUser,
  findSessionByRefreshToken,
  rotateSession,
  generateRefreshToken,
} from "./session.service";
import { findUserByEmail } from "../users/user.service";
import { getShopById } from "../shops/shop.service";
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

      const payload: AuthTokenPayload = {
        sub: user._id.toString(),
        role: user.role,
        shopId: user.ShopId ? user.ShopId.toString() : undefined,
        branchId:
          user.role === "BRANCH_ADMIN" && user.BranchId
            ? user.BranchId.toString()
            : undefined,
        defaultBranchId: user.BranchId ? user.BranchId.toString() : undefined,
        tenantId: user.tenantId?.toString(),
        tenants: user.tenants?.map(t => ({
          tenantId: t.tenantId.toString(),
          role: t.role,
          branchId: t.branchId?.toString(),
        })),
      };

      const token = sign(payload, JWT_SECRET, { expiresIn: "1h" });
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      const refreshToken = generateRefreshToken();
      const refreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await createSession(user._id, token, expiresAt, refreshToken, refreshExpiresAt);
      reply.setCookie("session", token, { httpOnly: true, path: "/" });
      reply.setCookie("refreshToken", refreshToken, { httpOnly: true, path: "/sessions/refresh" });

      let tenant = null;
      const shopId = user.tenantId || user.ShopId;
      if (shopId) {
        const shop = await getShopById(shopId);
        if (shop) {
          tenant = {
            tenantId: shop._id.toString(),
            shopName: shop.name,
            shopLogo: shop.image || null,
            branchId: user.BranchId?.toString() || null,
          };
        }
      }

      const { password: _, ...userWithoutPassword } = user;
      reply.send({ ok: true, user: userWithoutPassword, token, refreshToken, tenant });
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

  app.post("/sessions/refresh", { config: { action: "sessions.refresh" } }, async (req, reply) => {
    try {
      const refreshToken =
        req.cookies?.refreshToken ||
        (req.body as { refreshToken?: string })?.refreshToken;

      if (!refreshToken) {
        return reply.status(401).send({ error: "No refresh token" });
      }

      const session = await findSessionByRefreshToken(refreshToken);
      if (!session || session.refreshExpiresAt <= new Date()) {
        return reply.status(401).send({ error: "Invalid or expired refresh token" });
      }

      const decoded = decode(session.token) as AuthTokenPayload | null;
      if (!decoded) {
        return reply.status(401).send({ error: "Could not decode existing token" });
      }

      const payload: AuthTokenPayload = {
        sub: decoded.sub,
        role: decoded.role,
        shopId: decoded.shopId,
        branchId: decoded.branchId,
        defaultBranchId: decoded.defaultBranchId,
        tenantId: decoded.tenantId,
        tenants: decoded.tenants,
      };

      const newToken = sign(payload, JWT_SECRET, { expiresIn: "1h" });
      const newExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
      const newRefreshToken = generateRefreshToken();
      const newRefreshExpiresAt = new Date(session.refreshExpiresAt); // keep original 30d expiry

      await rotateSession(refreshToken, newToken, newExpiresAt, newRefreshToken, newRefreshExpiresAt);

      reply.setCookie("session", newToken, { httpOnly: true, path: "/" });
      reply.setCookie("refreshToken", newRefreshToken, { httpOnly: true, path: "/sessions/refresh" });
      reply.send({ ok: true, token: newToken, refreshToken: newRefreshToken });
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
