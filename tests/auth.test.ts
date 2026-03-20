/// <reference types="bun-types" />
import { describe, beforeAll, afterAll, beforeEach, it, expect } from "bun:test";
import { ObjectId } from "mongodb";
import { db } from "../src/db/mongo";
import { startTestApp, stopTestApp, getApp } from "./helpers/app";


beforeAll(async () => {
  await startTestApp();
});

afterAll(async () => {
  await stopTestApp();
});

beforeEach(async () => {
  await db.collection("users").deleteMany({});
  await db.collection("invitations").deleteMany({});
  await db.collection("sessions").deleteMany({});
  await db.collection("shops").deleteMany({});
});


async function createTestShop() {
  const result = await db.collection("shops").insertOne({
    name: "Test Coffee Shop",
    slug: "test-coffee",
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return result.insertedId;
}

async function createTestInvitation(shopId: ObjectId, branchId?: ObjectId) {
  const invitation = {
    tenantId: shopId,
    inviteCode: "TEST-INVITE-001",
    type: "link",
    maxUses: 10,
    usedCount: 0,
    active: true,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    ...(branchId ? { branchId } : {}),
    createdAt: new Date(),
  };
  await db.collection("invitations").insertOne(invitation);
  return invitation;
}

describe("POST /auth/register", () => {
  it("registers successfully with valid invite code", async () => {
    const shopId = await createTestShop();
    await createTestInvitation(shopId);

    const res = await getApp().inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        name: "Ana García",
        emailAddress: "ana@test.com",
        password: "password123",
        inviteCode: "TEST-INVITE-001",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.userId).toBeDefined();

    const user = await db.collection("users").findOne({ emailAddress: "ana@test.com" });
    expect(user).not.toBeNull();
    expect(user!.role).toBe("CLIENT");
    expect(user!.password).not.toBe("password123");
  });

  it("fails with invalid invite code", async () => {
    const res = await getApp().inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        name: "Test User",
        emailAddress: "test@test.com",
        password: "password123",
        inviteCode: "INVALID-CODE",
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBeDefined();
  });

  it("fails when email already registered", async () => {
    const shopId = await createTestShop();
    await createTestInvitation(shopId);

    const payload = {
      name: "First User",
      emailAddress: "duplicate@test.com",
      password: "password123",
      inviteCode: "TEST-INVITE-001",
    };

    await getApp().inject({ method: "POST", url: "/auth/register", payload });

    await db.collection("invitations").updateOne(
      { inviteCode: "TEST-INVITE-001" },
      { $set: { usedCount: 0 } }
    );

    const res = await getApp().inject({ method: "POST", url: "/auth/register", payload });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain("registrado");
  });

  it("fails with missing required fields", async () => {
    const res = await getApp().inject({
      method: "POST",
      url: "/auth/register",
      payload: { name: "No Email" },
    });

    expect(res.statusCode).toBe(400);
  });

  it("fails with expired invite code", async () => {
    const shopId = await createTestShop();
    await db.collection("invitations").insertOne({
      tenantId: shopId,
      inviteCode: "EXPIRED-CODE",
      type: "link",
      maxUses: 10,
      usedCount: 0,
      active: true,
      expiresAt: new Date(Date.now() - 1000),
      createdAt: new Date(),
    });

    const res = await getApp().inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        name: "Late User",
        emailAddress: "late@test.com",
        password: "password123",
        inviteCode: "EXPIRED-CODE",
      },
    });

    expect(res.statusCode).toBe(400);
  });
});


describe("POST /auth/register-direct", () => {
  it("registers directly with valid tenantId", async () => {
    const shopId = await createTestShop();

    const res = await getApp().inject({
      method: "POST",
      url: "/auth/register-direct",
      payload: {
        name: "Direct User",
        emailAddress: "direct@test.com",
        password: "password123",
        tenantId: shopId.toHexString(),
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().ok).toBe(true);
  });

  it("fails with non-existent shop", async () => {
    const res = await getApp().inject({
      method: "POST",
      url: "/auth/register-direct",
      payload: {
        name: "Ghost User",
        emailAddress: "ghost@test.com",
        password: "password123",
        tenantId: new ObjectId().toHexString(),
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain("Tienda no encontrada");
  });
});


describe("POST /login", () => {
  beforeEach(async () => {
    const shopId = await createTestShop();
    await db.collection("invitations").insertOne({
      tenantId: shopId,
      inviteCode: "LOGIN-INVITE",
      type: "link",
      maxUses: 5,
      usedCount: 0,
      active: true,
      expiresAt: new Date(Date.now() + 86400_000),
      createdAt: new Date(),
    });

    await getApp().inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        name: "Login User",
        emailAddress: "login@test.com",
        password: "secret123",
        inviteCode: "LOGIN-INVITE",
      },
    });
  });

  it("returns token on valid credentials", async () => {
    const res = await getApp().inject({
      method: "POST",
      url: "/login",
      payload: { emailAddress: "login@test.com", password: "secret123" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.token).toBeDefined();
    expect(body.refreshToken).toBeDefined();
    expect(body.user).toBeDefined();
    expect(body.user.password).toBeUndefined();
  });

  it("returns 401 on wrong password", async () => {
    const res = await getApp().inject({
      method: "POST",
      url: "/login",
      payload: { emailAddress: "login@test.com", password: "wrong-password" },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe("Invalid credentials");
  });

  it("returns 401 for unknown email", async () => {
    const res = await getApp().inject({
      method: "POST",
      url: "/login",
      payload: { emailAddress: "nobody@test.com", password: "whatever" },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe("Invalid credentials");
  });

  it("returns 400 when credentials missing", async () => {
    const res = await getApp().inject({
      method: "POST",
      url: "/login",
      payload: {},
    });

    expect(res.statusCode).toBe(400);
  });
});


describe("POST /sessions/refresh", () => {
  it("returns a new token using refresh token from body", async () => {
    const shopId = await createTestShop();
    await db.collection("invitations").insertOne({
      tenantId: shopId,
      inviteCode: "REFRESH-INVITE",
      type: "link",
      maxUses: 5,
      usedCount: 0,
      active: true,
      expiresAt: new Date(Date.now() + 86400_000),
      createdAt: new Date(),
    });

    await getApp().inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        name: "Refresh User",
        emailAddress: "refresh@test.com",
        password: "refresh123",
        inviteCode: "REFRESH-INVITE",
      },
    });

    const loginRes = await getApp().inject({
      method: "POST",
      url: "/login",
      payload: { emailAddress: "refresh@test.com", password: "refresh123" },
    });

    const { refreshToken } = loginRes.json();
    expect(refreshToken).toBeDefined();

    const refreshRes = await getApp().inject({
      method: "POST",
      url: "/sessions/refresh",
      payload: { refreshToken },
    });

    expect(refreshRes.statusCode).toBe(200);
    const body = refreshRes.json();
    expect(body.ok).toBe(true);
    expect(body.token).toBeDefined();
    expect(body.refreshToken).toBeDefined();
    // New refresh token should differ from the old one
    expect(body.refreshToken).not.toBe(refreshToken);
  });

  it("returns 401 with invalid refresh token", async () => {
    const res = await getApp().inject({
      method: "POST",
      url: "/sessions/refresh",
      payload: { refreshToken: "fake-refresh-token" },
    });

    expect(res.statusCode).toBe(401);
  });
});
