import { FastifyPluginAsync } from "fastify";
import { createUser, getUsers } from "./user.service";
import { userSchema } from "./user.model";
import { sign, verify } from "jsonwebtoken";
import { createSession } from "../sessions/session.service";

const JWT_SECRET = process.env.JWT_SECRET;

export const userRoutes: FastifyPluginAsync = async (app) => {
  app.post("/users", { config: { action: "users.create" } }, async (req, reply) => {
    try {
      const user = userSchema.parse(req.body);
      const created = await createUser(user);
      const token = sign({ user }, JWT_SECRET, { expiresIn: "1d" });
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await createSession(created._id, token, expiresAt);
      reply.setCookie("session", token, { httpOnly: true, path: "/" });
      reply.send({ user: created, token });
    } catch (e) {
      reply.status(400).send({ error: (e as Error).message });
    }
  });

  app.get("/users", { config: { action: "users.list" } }, async (req, reply) => {
    try {
      const token = req.cookies?.session;
      if (!token) return reply.status(401).send({ error: "No session" });
      verify(token, JWT_SECRET);
      const users = await getUsers();
      reply.send(users);
    } catch (e) {
      reply.status(401).send({ error: (e as Error).message });
    }
  });
};
