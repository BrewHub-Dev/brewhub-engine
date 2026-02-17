import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { verify } from "jsonwebtoken";
import { ObjectId } from "mongodb";
import { Session } from "@/features/sessions/session.model";
import {
  AuthIdentity,
  AuthScope,
  AuthTokenPayload,
  buildScope,
} from "@/auth/scope";

const JWT_SECRET = process.env.JWT_SECRET || "";

if (!JWT_SECRET) {
  throw new Error("Missing JWT_SECRET environment variable");
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    auth?: {
      identity: AuthIdentity;
      scope: AuthScope;
      token: string;
    };
  }
}

export const authPlugin: FastifyPluginAsync = async (app) => {
  app.decorate(
    "authenticate",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const token = request.cookies?.session;
      if (!token) {
        reply.status(401).send({ error: "No session" });
        return;
      }

      let payload: AuthTokenPayload;
      try {
        const decoded = verify(token, JWT_SECRET);
        if (typeof decoded !== "object" || decoded === null) {
          throw new Error("Invalid token payload");
        }
        payload = decoded as AuthTokenPayload;
      } catch (err) {
        reply.status(401).send({ error: "Invalid token" });
        return;
      }

      const session = await Session.findOne({ token }).exec();
      if (!session || session.expiresAt <= new Date()) {
        reply.status(401).send({ error: "Invalid or expired session" });
        return;
      }

      const identity: AuthIdentity = {
        userId: new ObjectId(payload.sub),
        role: payload.role,
        shopId: payload.shopId ? new ObjectId(payload.shopId) : undefined,
        branchId: payload.branchId ? new ObjectId(payload.branchId) : undefined,
        defaultBranchId: payload.defaultBranchId
          ? new ObjectId(payload.defaultBranchId)
          : undefined,
      };

      const requestedBranchIdHeader =
        (request.headers["x-branch-id"] as string | undefined) ||
        (request.headers["x-branch"] as string | undefined) ||
        undefined;

      let scope: AuthScope;
      try {
        scope = await buildScope(identity, requestedBranchIdHeader ?? null);
      } catch (err) {
        reply.status(403).send({ error: (err as Error).message });
        return;
      }

      request.auth = { identity, scope, token };
    }
  );
};

export default authPlugin;
