/// <reference types="bun-types" />
import { describe, beforeAll, afterAll, beforeEach, it, expect } from "bun:test";
import { ObjectId } from "mongodb";
import { db } from "../src/db/mongo";
import { startTestApp, stopTestApp, getApp, makeToken } from "./helpers/app";

beforeAll(async () => {
  await startTestApp();
});

afterAll(async () => {
  await stopTestApp();
});

interface TestFixtures {
  shopId: ObjectId;
  branchId: ObjectId;
  itemId: ObjectId;
  staffId: ObjectId;
  clientId: ObjectId;
  staffToken: string;
  clientToken: string;
}

let fixtures: TestFixtures;

beforeEach(async () => {
  await Promise.all([
    db.collection("orders").deleteMany({}),
    db.collection("counters").deleteMany({}),
    db.collection("users").deleteMany({}),
    db.collection("items").deleteMany({}),
    db.collection("categories").deleteMany({}),
    db.collection("branches").deleteMany({}),
    db.collection("shops").deleteMany({}),
    db.collection("sessions").deleteMany({}),
  ]);

  const shopResult = await db.collection("shops").insertOne({
    name: "Payment Test Shop",
    slug: "payment-test-shop",
    active: true,
    taxes: { enabled: false, type: "NONE", percentage: 0, includedInPrice: false },
    pricing: { roundingMode: "HALF_UP", roundToDecimals: 2 },
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const shopId = shopResult.insertedId;

  const branchResult = await db.collection("branches").insertOne({
    name: "Sucursal Test",
    address: "Calle 2",
    phone: "0000000",
    ShopId: shopId,
    timezone: "America/Tijuana",
    active: true,
    createdAt: new Date(),
  });
  const branchId = branchResult.insertedId;

  const catResult = await db.collection("categories").insertOne({
    name: "Bebidas",
    ShopId: shopId,
    isActive: true,
  });

  const itemResult = await db.collection("items").insertOne({
    name: "Café Americano",
    price: 50,
    cost: 10,
    ShopId: shopId,
    categoryId: catResult.insertedId,
    active: true,
    modifiers: [],
    images: [],
    taxIncluded: false,
    createdAt: new Date(),
  });
  const itemId = itemResult.insertedId;

  const staffResult = await db.collection("users").insertOne({
    name: "Staff Pay",
    emailAddress: "staffpay@test.com",
    role: "BRANCH_ADMIN",
    ShopId: shopId,
    BranchId: branchId,
    active: true,
    createdAt: new Date(),
  });
  const staffId = staffResult.insertedId;

  const clientResult = await db.collection("users").insertOne({
    name: "Client Pay",
    emailAddress: "clientpay@test.com",
    role: "CLIENT",
    ShopId: shopId,
    active: true,
    pushTokens: [],
    createdAt: new Date(),
  });
  const clientId = clientResult.insertedId;

  const staffToken = await makeToken({
    sub: staffId.toHexString(),
    role: "BRANCH_ADMIN",
    shopId: shopId.toHexString(),
    branchId: branchId.toHexString(),
    tenantId: shopId.toHexString(),
    defaultBranchId: branchId.toHexString(),
  });

  const clientToken = await makeToken({
    sub: clientId.toHexString(),
    role: "CLIENT",
    shopId: shopId.toHexString(),
    tenantId: shopId.toHexString(),
  });

  fixtures = { shopId, branchId, itemId, staffId, clientId, staffToken, clientToken };
});

async function createPosOrder(paymentMethod = "cash") {
  const { branchId, itemId, staffToken } = fixtures;
  const res = await getApp().inject({
    method: "POST",
    url: "/orders/pos",
    headers: { authorization: `Bearer ${staffToken}` },
    payload: {
      BranchId: branchId.toHexString(),
      items: [{ itemId: itemId.toHexString(), quantity: 1 }],
      paymentMethod,
      paymentStatus: "pending",
      guestName: "Pay Test Guest",
    },
  });
  return res.json();
}

describe("POST /orders/:id/pay", () => {
  it("marks a POS order as paid (cash)", async () => {
    const { staffToken } = fixtures;
    const order = await createPosOrder("cash");

    const res = await getApp().inject({
      method: "POST",
      url: `/orders/${order._id}/pay`,
      headers: { authorization: `Bearer ${staffToken}` },
      payload: { paymentMethod: "cash" },
    });

    expect(res.statusCode).toBe(200);
    const updated = res.json();
    expect(updated.paymentStatus).toBe("paid");
    expect(updated.paymentMethod).toBe("cash");
    expect(updated.paidAt).toBeDefined();
  });

  it("returns 400 when trying to pay an already paid order", async () => {
    const { staffToken } = fixtures;
    const order = await createPosOrder("cash");

    // First payment succeeds
    await getApp().inject({
      method: "POST",
      url: `/orders/${order._id}/pay`,
      headers: { authorization: `Bearer ${staffToken}` },
      payload: { paymentMethod: "cash" },
    });

    // Second payment should fail
    const res = await getApp().inject({
      method: "POST",
      url: `/orders/${order._id}/pay`,
      headers: { authorization: `Bearer ${staffToken}` },
      payload: { paymentMethod: "cash" },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/already paid/i);
  });

  it("returns 401 without auth token", async () => {
    const order = await createPosOrder();

    const res = await getApp().inject({
      method: "POST",
      url: `/orders/${order._id}/pay`,
      payload: { paymentMethod: "cash" },
    });

    expect(res.statusCode).toBe(401);
  });
});

describe("POST /orders/:id/refund", () => {
  it("refunds a cash order (no Stripe call needed)", async () => {
    const { staffToken } = fixtures;
    const order = await createPosOrder("cash");

    // Mark as paid first
    await getApp().inject({
      method: "POST",
      url: `/orders/${order._id}/pay`,
      headers: { authorization: `Bearer ${staffToken}` },
      payload: { paymentMethod: "cash" },
    });

    const res = await getApp().inject({
      method: "POST",
      url: `/orders/${order._id}/refund`,
      headers: { authorization: `Bearer ${staffToken}` },
    });

    expect(res.statusCode).toBe(200);
    const updated = res.json();
    expect(updated.paymentStatus).toBe("refunded");
  });

  it("refunds a card order and stores stripeRefundId", async () => {
    const { staffToken } = fixtures;

    // Seed order with a fake stripePaymentIntentId
    const order = await createPosOrder("card");
    await db.collection("orders").updateOne(
      { _id: new ObjectId(order._id) },
      { $set: { stripePaymentIntentId: "pi_test_mock", paymentStatus: "paid", paidAt: new Date() } }
    );

    const res = await getApp().inject({
      method: "POST",
      url: `/orders/${order._id}/refund`,
      headers: { authorization: `Bearer ${staffToken}` },
    });

    expect(res.statusCode).toBe(200);
    const updated = res.json();
    expect(updated.paymentStatus).toBe("refunded");
    expect(updated.stripeRefundId).toBe("re_test_mock");
  });

  it("returns 400 when order is not paid", async () => {
    const { staffToken } = fixtures;
    const order = await createPosOrder("cash");

    const res = await getApp().inject({
      method: "POST",
      url: `/orders/${order._id}/refund`,
      headers: { authorization: `Bearer ${staffToken}` },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/paid/i);
  });

  it("returns 404 for non-existent order", async () => {
    const { staffToken } = fixtures;

    const res = await getApp().inject({
      method: "POST",
      url: `/orders/${new ObjectId().toHexString()}/refund`,
      headers: { authorization: `Bearer ${staffToken}` },
    });

    expect(res.statusCode).toBe(404);
  });
});

describe("POST /stripe/webhook — payment_intent.succeeded", () => {
  it("marks the order as paid when webhook fires", async () => {
    const { branchId, itemId, staffToken } = fixtures;

    // Create an app order with card payment
    const createRes = await getApp().inject({
      method: "POST",
      url: "/orders/app",
      headers: { authorization: `Bearer ${await makeToken({ sub: fixtures.clientId.toHexString(), role: "CLIENT", shopId: fixtures.shopId.toHexString(), tenantId: fixtures.shopId.toHexString() }) }` },
      payload: {
        BranchId: branchId.toHexString(),
        items: [{ itemId: itemId.toHexString(), quantity: 1 }],
        paymentMethod: "card",
        paymentStatus: "pending",
      },
    });

    expect(createRes.statusCode).toBe(200);
    const order = createRes.json();
    const orderId = String(order._id);

    // Simulate Stripe webhook: payment_intent.succeeded
    const webhookPayload = JSON.stringify({
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_test_mock",
          metadata: { orderId },
        },
      },
    });

    const webhookRes = await getApp().inject({
      method: "POST",
      url: "/stripe/webhook",
      headers: {
        "content-type": "application/json",
        "stripe-signature": "t=1,v1=mock_signature",
      },
      payload: Buffer.from(webhookPayload),
    });

    expect(webhookRes.statusCode).toBe(200);
    expect(webhookRes.json().received).toBe(true);

    // Verify the order is now paid in the DB
    const updatedOrder = await db.collection("orders").findOne({ _id: new ObjectId(orderId) });
    expect(updatedOrder?.paymentStatus).toBe("paid");
    expect(updatedOrder?.paymentMethod).toBe("card");
  });

  it("returns 200 received:true for unknown event types", async () => {
    const webhookPayload = JSON.stringify({
      type: "customer.created",
      data: { object: {} },
    });

    const res = await getApp().inject({
      method: "POST",
      url: "/stripe/webhook",
      headers: {
        "content-type": "application/json",
        "stripe-signature": "t=1,v1=mock_signature",
      },
      payload: Buffer.from(webhookPayload),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().received).toBe(true);
  });

  it("returns 400 when stripe-signature header is missing", async () => {
    const res = await getApp().inject({
      method: "POST",
      url: "/stripe/webhook",
      headers: { "content-type": "application/json" },
      payload: Buffer.from("{}"),
    });

    expect(res.statusCode).toBe(400);
  });
});
