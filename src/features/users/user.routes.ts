import { FastifyPluginAsync } from "fastify";
import { createUser, getUsers, getUser, updateUser, deleteUser, updateUserPassword } from "./user.service";
import { userSchema } from "./user.model";
import { sign } from "jsonwebtoken";
import { createSession } from "../sessions/session.service";
import { AuthTokenPayload } from "@/auth/scope";
import { requirePermission } from "../../middleware/permissions.middleware";
import { applyScopeMiddleware } from "../../middleware/scope.middleware";

const JWT_SECRET = process.env.JWT_SECRET;

export const userRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    "/users",
    { config: { action: "users.create" } },
    async (req, reply) => {
      try {
        const user = userSchema.parse(req.body);
        const created = await createUser(user);
        const payload: AuthTokenPayload = {
          sub: created._id.toString(),
          role: created.role,
          shopId: created.ShopId ? created.ShopId.toString() : undefined,
          branchId:
            created.role === "BRANCH_ADMIN" && created.BranchId
              ? created.BranchId.toString()
              : undefined,
          defaultBranchId: created.BranchId
            ? created.BranchId.toString()
            : undefined,
        };

        const token = sign(payload, JWT_SECRET, { expiresIn: "1d" });
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await createSession(created._id, token, expiresAt);
        reply.setCookie("session", token, { httpOnly: true, path: "/" });

        console.log("[Users] New user created:", created._id);
        reply.send({ user: created, token });
      } catch (e) {
        reply.status(400).send({ error: (e as Error).message });
        console.error("Error creating user:", e);
      }
    }
  );

  app.get(
    "/users",
    {
      config: { action: "users.list" },
      preHandler: [
        app.authenticate,
        requirePermission("users:view"),
        applyScopeMiddleware,
      ],
    },
    async (req, reply) => {
      try {
        if (!req.auth) {
          return reply.status(401).send({ error: "No auth context" });
        }

        console.log("[Users] GET /users", {
          role: req.auth.scope.role,
          shopId:
            req.auth.scope.role !== "ADMIN" && req.auth.scope.role !== "CLIENT"
              ? req.auth.scope.shopId?.toHexString()
              : undefined,
        });

        const users = await getUsers(req.auth.scope);
        reply.send(users);
      } catch (e) {
        reply.status(500).send({ error: (e as Error).message });
        console.error("Error fetching users:", e);
      }
    }
  );

  app.get(
    "/users/me",
    {
      config: { action: "users.me" },
      preHandler: [app.authenticate],
    },
    async (req, reply) => {
      try {
        if (!req.auth) {
          return reply.status(401).send({ error: "No auth context" });
        }

        const userId = req.auth.identity.userId.toString();
        const user = await getUser(userId, req.auth.scope);
        if (!user) {
          return reply.status(404).send({ error: "User not found" });
        }
        reply.send(user);
      } catch (e) {
        reply.status(500).send({ error: (e as Error).message });
        console.error("Error fetching current user:", e);
      }
    }
  );

  app.get(
    "/users/:id",
    {
      config: { action: "users.get" },
      preHandler: [
        app.authenticate,
        requirePermission("users:view"),
        applyScopeMiddleware,
      ],
    },
    async (req, reply) => {
      try {
        if (!req.auth) {
          return reply.status(401).send({ error: "No auth context" });
        }

        const { id } = req.params as { id: string };
        const user = await getUser(id, req.auth.scope);
        if (!user) {
          return reply.status(404).send({ error: "User not found" });
        }

        console.log("[Users] User fetched:", id);
        reply.send(user);
      } catch (e) {
        reply.status(500).send({ error: (e as Error).message });
        console.error("Error fetching user by ID:", e);
      }
    }
  );

  app.patch(
    "/users/:id",
    {
      config: { action: "users.update" },
      preHandler: [
        app.authenticate,
        requirePermission("users:edit"),
        applyScopeMiddleware,
      ],
    },
    async (req, reply) => {
      try {
        if (!req.auth) {
          return reply.status(401).send({ error: "No auth context" });
        }

        const { id } = req.params as { id: string };

        const existingUser = await getUser(id, req.auth.scope);
        if (!existingUser) {
          return reply.status(404).send({ error: "User not found" });
        }

        const parsed = userSchema.partial().parse(req.body);
        const updated = await updateUser(id, parsed);

        console.log("[Users] User updated:", id);
        reply.send(updated);
      } catch (e) {
        reply.status(400).send({ error: (e as Error).message });
        console.error("Error updating user:", e);
      }
    }
  );

  app.patch(
    "/users/me/password",
    {
      config: { action: "users.updatePassword" },
      preHandler: [app.authenticate],
    },
    async (req, reply) => {
      try {
        if (!req.auth) {
          return reply.status(401).send({ error: "No auth context" });
        }

        const { newPassword } = req.body as { newPassword: string };
        if (!newPassword || newPassword.length < 6) {
          return reply.status(400).send({ error: "Password must be at least 6 characters" });
        }

        const userId = req.auth.identity.userId.toString();
        await updateUserPassword(userId, newPassword);

        console.log("[Users] Password updated for user:", userId);
        reply.send({ ok: true, message: "Password updated successfully" });
      } catch (e) {
        reply.status(400).send({ error: (e as Error).message });
        console.error("Error updating password:", e);
      }
    }
  );

  app.delete(
    "/users/:id",
    {
      config: { action: "users.delete" },
      preHandler: [
        app.authenticate,
        requirePermission("users:delete"),
        applyScopeMiddleware,
      ],
    },
    async (req, reply) => {
      try {
        if (!req.auth) {
          return reply.status(401).send({ error: "No auth context" });
        }

        const { id } = req.params as { id: string };

        const existingUser = await getUser(id, req.auth.scope);
        if (!existingUser) {
          return reply.status(404).send({ error: "User not found" });
        }

        await deleteUser(id);

        console.log("[Users] User deleted:", id);
        reply.status(204).send();
      } catch (e) {
        reply.status(500).send({ error: (e as Error).message });
        console.error("Error deleting user:", e);
      }
    }
  );
};
