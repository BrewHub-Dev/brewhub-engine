import { MongoMemoryServer } from "mongodb-memory-server";
import { buildApp } from "../../src/app";
import { connectDB, disconnectDB } from "../../src/db/mongo";
import type { FastifyInstance } from "fastify";
import { sign } from "jsonwebtoken";
import { ObjectId } from "mongodb";
import { randomBytes } from "node:crypto";
import { Session } from "../../src/features/sessions/session.model";

let mongod: MongoMemoryServer;
let _app: FastifyInstance;

export async function startTestApp(): Promise<FastifyInstance> {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();

  await connectDB(uri, "brewhub_test");

  _app = buildApp();
  await _app.ready();

  return _app;
}

export async function stopTestApp(): Promise<void> {
  await _app?.close();
  await disconnectDB();
  await mongod?.stop();
}

export function getApp(): FastifyInstance {
  return _app;
}

interface TokenPayload {
  sub: string;
  role: string;
  shopId?: string;
  branchId?: string;
  tenantId?: string;
  defaultBranchId?: string;
  tenants?: Array<{ tenantId: string; role: string; branchId?: string }>;
}

/**
 * Sign a JWT AND create a matching session document in MongoDB.
 * The authenticate middleware validates tokens against the session collection,
 * so this function is required for test requests to pass authentication.
 */
export async function makeToken(payload: TokenPayload): Promise<string> {
  const token = sign(payload, process.env.JWT_SECRET!, { expiresIn: "1h" });
  const now = Date.now();

  await Session.create({
    user: new ObjectId(payload.sub),
    token,
    expiresAt: new Date(now + 60 * 60 * 1000),
    refreshToken: randomBytes(40).toString("hex"),
    refreshExpiresAt: new Date(now + 30 * 24 * 60 * 60 * 1000),
  });

  return token;
}
