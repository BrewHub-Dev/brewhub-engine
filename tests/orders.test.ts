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
  categoryId: ObjectId;
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
    name: "Test Café",
    slug: "test-cafe",
    active: true,
    taxes: { enabled: false, type: "NONE", percentage: 0, includedInPrice: false },
    pricing: { roundingMode: "HALF_UP", roundToDecimals: 2 },
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const shopId = shopResult.insertedId;

  const branchResult = await db.collection("branches").insertOne({
    name: "Sucursal Centro",
    address: "Calle 1",
    phone: "1234567",
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
  const categoryId = catResult.insertedId;

  const itemResult = await db.collection("items").insertOne({
    name: "Café Americano",
    price: 45,
    cost: 10,
    ShopId: shopId,
    categoryId,
    active: true,
    modifiers: [],
    images: [],
    taxIncluded: false,
    createdAt: new Date(),
  });
  const itemId = itemResult.insertedId;

  const staffResult = await db.collection("users").insertOne({
    name: "Staff",
    emailAddress: "staff@test.com",
    role: "BRANCH_ADMIN",
    ShopId: shopId,
    BranchId: branchId,
    active: true,
    createdAt: new Date(),
  });
  const staffId = staffResult.insertedId;

  const clientResult = await db.collection("users").insertOne({
    name: "Client",
    emailAddress: "client@test.com",
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

  fixtures = { shopId, branchId, categoryId, itemId, staffId, clientId, staffToken, clientToken };
});


describe("POST /orders/pos", () => {
  it("creates a POS order as BRANCH_ADMIN", async () => {
    const { branchId, itemId, staffToken } = fixtures;

    const res = await getApp().inject({
      method: "POST",
      url: "/orders/pos",
      headers: { authorization: `Bearer ${staffToken}` },
      payload: {
        BranchId: branchId.toHexString(),
        items: [{ itemId: itemId.toHexString(), quantity: 2 }],
        paymentMethod: "cash",
        paymentStatus: "paid",
        guestName: "Juan Cliente",
      },
    });

    expect(res.statusCode).toBe(200);
    const order = res.json();
    expect(order.orderNumber).toMatch(/^ORD-/);
    expect(order.status).toBe("confirmed");
    expect(order.source).toBe("pos");
    expect(order.subtotal).toBe(90);
    expect(order.total).toBe(90);
    expect(order.qrToken).toBeDefined();
  });

  it("creates a POS order with modifiers", async () => {
    const { branchId, shopId, staffToken } = fixtures;

    const { insertedId: modItemId } = await db.collection("items").insertOne({
      name: "Latte",
      price: 55,
      ShopId: shopId,
      categoryId: fixtures.categoryId,
      active: true,
      modifiers: [
        { name: "Tamaño", options: [{ name: "Grande", extraPrice: 10 }] },
      ],
      taxIncluded: false,
      createdAt: new Date(),
    });

    const res = await getApp().inject({
      method: "POST",
      url: "/orders/pos",
      headers: { authorization: `Bearer ${staffToken}` },
      payload: {
        BranchId: branchId.toHexString(),
        guestName: "Test Guest",
        items: [
          {
            itemId: modItemId.toHexString(),
            quantity: 1,
            modifiers: [{ name: "Tamaño", optionName: "Grande" }],
          },
        ],
        paymentMethod: "cash",
        paymentStatus: "pending",
      },
    });

    expect(res.statusCode).toBe(200);
    const order = res.json();
    expect(order.items[0].modifiers[0].extraPrice).toBe(10);
    expect(order.subtotal).toBe(65);
  });

  it("fails when item does not belong to the shop", async () => {
    const { branchId, staffToken } = fixtures;
    const foreignItemId = new ObjectId();

    const res = await getApp().inject({
      method: "POST",
      url: "/orders/pos",
      headers: { authorization: `Bearer ${staffToken}` },
      payload: {
        BranchId: branchId.toHexString(),
        items: [{ itemId: foreignItemId.toHexString(), quantity: 1 }],
        paymentMethod: "cash",
        paymentStatus: "pending",
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it("returns 401 without auth token", async () => {
    const { branchId, itemId } = fixtures;

    const res = await getApp().inject({
      method: "POST",
      url: "/orders/pos",
      payload: {
        BranchId: branchId.toHexString(),
        items: [{ itemId: itemId.toHexString(), quantity: 1 }],
        paymentMethod: "cash",
        paymentStatus: "pending",
      },
    });

    expect(res.statusCode).toBe(401);
  });
});


describe("POST /orders/app", () => {
  it("creates an app order as CLIENT", async () => {
    const { branchId, itemId, clientToken } = fixtures;

    const res = await getApp().inject({
      method: "POST",
      url: "/orders/app",
      headers: { authorization: `Bearer ${clientToken}` },
      payload: {
        BranchId: branchId.toHexString(),
        items: [{ itemId: itemId.toHexString(), quantity: 1 }],
        paymentMethod: "card",
        paymentStatus: "pending",
      },
    });

    expect(res.statusCode).toBe(200);
    const order = res.json();
    expect(order.status).toBe("pending");
    expect(order.source).toBe("app");
    expect(order.total).toBe(45);
  });

  it("returns 403 when staff tries to create an app order", async () => {
    const { branchId, itemId, staffToken } = fixtures;

    const res = await getApp().inject({
      method: "POST",
      url: "/orders/app",
      headers: { authorization: `Bearer ${staffToken}` },
      payload: {
        BranchId: branchId.toHexString(),
        items: [{ itemId: itemId.toHexString(), quantity: 1 }],
        paymentMethod: "card",
        paymentStatus: "pending",
      },
    });

    expect(res.statusCode).toBe(403);
  });
});

describe("GET /orders — pagination", () => {
  async function seedOrders(count: number) {
    const { branchId, itemId, staffToken } = fixtures;
    for (let i = 0; i < count; i++) {
      await getApp().inject({
        method: "POST",
        url: "/orders/pos",
        headers: { authorization: `Bearer ${staffToken}` },
        payload: {
          BranchId: branchId.toHexString(),
          items: [{ itemId: itemId.toHexString(), quantity: 1 }],
          paymentMethod: "cash",
          paymentStatus: "pending",
          guestName: `Guest ${i + 1}`,
        },
      });
    }
  }

  it("returns paginated response with correct structure", async () => {
    const { staffToken } = fixtures;
    await seedOrders(5);

    const res = await getApp().inject({
      method: "GET",
      url: "/orders",
      headers: { authorization: `Bearer ${staffToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toBeArray();
    expect(body.pagination).toBeDefined();
    expect(body.pagination.total).toBe(5);
    expect(body.pagination.page).toBe(1);
    expect(body.pagination.limit).toBe(20);
  });

  it("respects page and limit query params", async () => {
    const { staffToken } = fixtures;
    await seedOrders(10);

    const res = await getApp().inject({
      method: "GET",
      url: "/orders?page=2&limit=3",
      headers: { authorization: `Bearer ${staffToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(3);
    expect(body.pagination.page).toBe(2);
    expect(body.pagination.limit).toBe(3);
    expect(body.pagination.total).toBe(10);
    expect(body.pagination.pages).toBe(4);
    expect(body.pagination.hasPrev).toBe(true);
  });

  it("returns last page correctly", async () => {
    const { staffToken } = fixtures;
    await seedOrders(7);

    const res = await getApp().inject({
      method: "GET",
      url: "/orders?page=2&limit=5",
      headers: { authorization: `Bearer ${staffToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(2);
    expect(body.pagination.hasNext).toBe(false);
    expect(body.pagination.hasPrev).toBe(true);
  });

  it("filters by status", async () => {
    const { staffToken } = fixtures;
    await seedOrders(3);

    const filteredRes = await getApp().inject({
      method: "GET",
      url: "/orders?status=confirmed",
      headers: { authorization: `Bearer ${staffToken}` },
    });

    expect(filteredRes.statusCode).toBe(200);
    const body = filteredRes.json();
    expect(body.pagination.total).toBe(3);
    expect(body.data[0].status).toBe("confirmed");
  });
});


describe("Order status transitions", () => {
  async function createPosOrder() {
    const { branchId, itemId, staffToken } = fixtures;
    const res = await getApp().inject({
      method: "POST",
      url: "/orders/pos",
      headers: { authorization: `Bearer ${staffToken}` },
      payload: {
        BranchId: branchId.toHexString(),
        items: [{ itemId: itemId.toHexString(), quantity: 1 }],
        paymentMethod: "cash",
        paymentStatus: "pending",
        guestName: "Transition Test",
      },
    });
    return res.json();
  }

  it("confirmed → preparing → ready → completed (POS order lifecycle)", async () => {
    const { staffToken } = fixtures;
    const order = await createPosOrder();
    const id = String(order._id);

    expect(order.status).toBe("confirmed");

    let res = await getApp().inject({
      method: "PATCH",
      url: `/orders/${id}/prepare`,
      headers: { authorization: `Bearer ${staffToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("preparing");

    res = await getApp().inject({
      method: "PATCH",
      url: `/orders/${id}/ready`,
      headers: { authorization: `Bearer ${staffToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("ready");

    

    res = await getApp().inject({
      method: "PATCH",
      url: `/orders/${id}/complete`,
      headers: { authorization: `Bearer ${staffToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("completed");
  });

  it("cannot skip states (confirmed → completed is invalid)", async () => {
    const { staffToken } = fixtures;
    const order = await createPosOrder();
    const id = String(order._id);

    const res = await getApp().inject({
      method: "PATCH",
      url: `/orders/${id}/complete`,
      headers: { authorization: `Bearer ${staffToken}` },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/Cannot transition/);
  });

  it("client can cancel own pending app order", async () => {
    const { branchId, itemId, clientToken } = fixtures;

    const createRes = await getApp().inject({
      method: "POST",
      url: "/orders/app",
      headers: { authorization: `Bearer ${clientToken}` },
      payload: {
        BranchId: branchId.toHexString(),
        items: [{ itemId: itemId.toHexString(), quantity: 1 }],
        paymentMethod: "card",
        paymentStatus: "pending",
      },
    });

    const orderId = String(createRes.json()._id);

    const cancelRes = await getApp().inject({
      method: "PATCH",
      url: `/orders/${orderId}/cancel`,
      headers: { authorization: `Bearer ${clientToken}` },
    });

    expect(cancelRes.statusCode).toBe(200);
    expect(cancelRes.json().status).toBe("cancelled");
  });
});


describe("GET /orders/:id", () => {
  it("returns order by ID for staff", async () => {
    const { branchId, itemId, staffToken } = fixtures;

    const createRes = await getApp().inject({
      method: "POST",
      url: "/orders/pos",
      headers: { authorization: `Bearer ${staffToken}` },
      payload: {
        BranchId: branchId.toHexString(),
        guestName: "Lookup Guest",
        items: [{ itemId: itemId.toHexString(), quantity: 1 }],
        paymentMethod: "cash",
        paymentStatus: "pending",
      },
    });

    const orderId = String(createRes.json()._id);

    const res = await getApp().inject({
      method: "GET",
      url: `/orders/${orderId}`,
      headers: { authorization: `Bearer ${staffToken}` },
    });

    expect(res.statusCode).toBe(200);
    expect(String(res.json()._id)).toBe(orderId);
  });

  it("returns 404 for non-existent order", async () => {
    const { staffToken } = fixtures;

    const res = await getApp().inject({
      method: "GET",
      url: `/orders/${new ObjectId().toHexString()}`,
      headers: { authorization: `Bearer ${staffToken}` },
    });

    expect(res.statusCode).toBe(404);
  });
});
