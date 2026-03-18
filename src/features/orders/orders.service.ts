import * as crypto from "node:crypto";
import { db } from "@/db/mongo";
import { redis, redisKeys } from "@/db/redis";
import { withLock, lockKeys } from "@/db/lock";
import { nowUtc, todayInZone } from "@/utils/date-time";
import { ObjectId } from "mongodb";
import { emitToUser, emitToBranch, emitToShop } from "@/websockets";
import { sendPushNotification } from "@/services/push.service";
import {
  type OrderStatus,
  type OrderItem,
  type CreateAppOrderInput,
  type CreatePosOrderInput,
  STATE_TRANSITIONS,
} from "./orders.model";

const QR_SECRET = process.env.QR_SECRET || process.env.JWT_SECRET || "";
const QR_TTL_HOURS = 72;
const QR_TTL_SECONDS = QR_TTL_HOURS * 60 * 60;


function roundNumber(
  num: number,
  decimals: number,
  mode: string
): number {
  const m = Math.pow(10, decimals);
  switch (mode) {
    case "UP":
      return Math.ceil(num * m) / m;
    case "DOWN":
      return Math.floor(num * m) / m;
    default:
      return Math.round(num * m) / m;
  }
}


export function generateQRToken(orderId: ObjectId) {
  const orderIdStr = orderId.toHexString();
  const timestamp = Date.now().toString();

  const hmac = crypto
    .createHmac("sha256", QR_SECRET)
    .update(`${orderIdStr}:${timestamp}`)
    .digest("hex");

  const token = `${orderIdStr}.${timestamp}.${hmac}`;
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  return { token, tokenHash };
}

export function verifyQRTokenSignature(token: string): {
  orderId: string;
  tokenHash: string;
} | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    console.log(`[QR] Verifying token: ${token}`);

    const [orderIdStr, timestamp, providedHmac] = parts;
    console.log(`[QR] Parsed token - orderId: ${orderIdStr}, timestamp: ${timestamp}`);
    const tokenTime = Number.parseInt(timestamp, 10);
    if (Date.now() - tokenTime > QR_TTL_SECONDS * 1000) return null;

    const expectedHmac = crypto
      .createHmac("sha256", QR_SECRET)
      .update(`${orderIdStr}:${timestamp}`)
      .digest("hex");

    if (expectedHmac !== providedHmac) return null;

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    return { orderId: orderIdStr, tokenHash };
  } catch {
    return null;
  }
}

export async function generateOrderNumber(
  branchId: ObjectId,
  timezone: string
): Promise<string> {
  const dateStr = todayInZone(timezone).replaceAll(/-/g, "");
  const branchShort = branchId.toHexString().slice(-4).toUpperCase();
  const counterId = `orders:${branchId.toHexString()}:${dateStr}`;

  const result = await db.collection("counters").findOneAndUpdate(
    { _id: counterId as any },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" }
  );

  const seq = (result!.seq as number).toString().padStart(4, "0");
  return `ORD-${dateStr}-${branchShort}-${seq}`;
}


export async function snapshotOrderItems(
  inputItems: CreateAppOrderInput["items"],
  shopId: ObjectId
): Promise<OrderItem[]> {
  const items = db.collection("items");
  const itemIds = inputItems.map((i) => new ObjectId(i.itemId));

  const dbItems = await items
    .find({ _id: { $in: itemIds }, ShopId: shopId })
    .toArray();

  const dbItemsMap = new Map(
    dbItems.map((item) => [item._id.toHexString(), item])
  );

  const snapshotted: OrderItem[] = [];

  for (const input of inputItems) {
    const dbItem = dbItemsMap.get(input.itemId);
    if (!dbItem) {
      throw new Error(`Item ${input.itemId} not found in this shop`);
    }
    if (!dbItem.active) {
      throw new Error(`Item "${dbItem.name}" is not available`);
    }

    let modifiersTotal = 0;
    const resolvedModifiers: OrderItem["modifiers"] = [];

    if (input.modifiers && input.modifiers.length > 0) {
      for (const mod of input.modifiers) {
        const dbModifier = dbItem.modifiers?.find(
          (m: any) => m.name === mod.name
        );
        if (!dbModifier) {
          throw new Error(
            `Modifier "${mod.name}" not found on item "${dbItem.name}"`
          );
        }
        const dbOption = dbModifier.options?.find(
          (o: any) => o.name === mod.optionName
        );
        if (!dbOption) {
          throw new Error(
            `Option "${mod.optionName}" not found for modifier "${mod.name}"`
          );
        }
        const extraPrice = dbOption.extraPrice || 0;
        modifiersTotal += extraPrice;
        resolvedModifiers.push({
          name: mod.name,
          optionName: mod.optionName,
          extraPrice,
        });
      }
    }

    const itemTotal = (dbItem.price + modifiersTotal) * input.quantity;

    snapshotted.push({
      itemId: new ObjectId(input.itemId),
      name: dbItem.name,
      quantity: input.quantity,
      unitPrice: dbItem.price,
      ...(resolvedModifiers.length > 0 ? { modifiers: resolvedModifiers } : {}),
      itemTotal,
      ...(input.notes ? { notes: input.notes } : {}),
    });
  }

  return snapshotted;
}


export async function calculateTotals(
  items: OrderItem[],
  shopId: ObjectId,
  discountAmount = 0
) {
  const shops = db.collection("shops");
  const shop = await shops.findOne({ _id: shopId });
  if (!shop) throw new Error("Shop not found");

  const subtotal = items.reduce((sum, item) => sum + item.itemTotal, 0);
  const taxes = shop.taxes || {
    enabled: false,
    type: "NONE",
    percentage: 0,
    includedInPrice: false,
  };
  const pricing = shop.pricing || {
    roundingMode: "HALF_UP",
    roundToDecimals: 2,
  };

  let tax = 0;
  if (taxes.enabled && taxes.type !== "NONE") {
    const rate = taxes.percentage / 100;
    if (taxes.includedInPrice) {
      tax = subtotal - subtotal / (1 + rate);
    } else {
      tax = subtotal * rate;
    }
  }

  const total = subtotal + (taxes.includedInPrice ? 0 : tax) - discountAmount;
  const { roundingMode, roundToDecimals } = pricing;

  return {
    subtotal: roundNumber(subtotal, roundToDecimals, roundingMode),
    tax: roundNumber(tax, roundToDecimals, roundingMode),
    discount: roundNumber(discountAmount, roundToDecimals, roundingMode),
    total: roundNumber(Math.max(total, 0), roundToDecimals, roundingMode),
  };
}


export async function createAppOrder(
  input: CreateAppOrderInput,
  customerId: string
) {
  return withLock(lockKeys.orderCreate(customerId, input.BranchId), async () => {
    const orders = db.collection("orders");
    const branches = db.collection("branches");

    const branchId = new ObjectId(input.BranchId);
    const branch = await branches.findOne({ _id: branchId });
    if (!branch) throw new Error("Branch not found");

    const shopId = new ObjectId(branch.ShopId);
    const timezone: string = branch.timezone || "UTC";

    const items = await snapshotOrderItems(input.items, shopId);
    const totals = await calculateTotals(items, shopId);
    const orderNumber = await generateOrderNumber(branchId, timezone);

    const now = nowUtc();
    const customerOid = new ObjectId(customerId);

    const orderDoc = {
      orderNumber,
      ShopId: shopId,
      BranchId: branchId,
      customerId: customerOid,
      source: "app" as const,
      createdBy: { userId: customerOid, role: "CLIENT" as const },
      items,
      ...totals,
      paymentMethod: input.paymentMethod,
      paymentStatus: input.paymentStatus === "paid" ? "paid" : ("pending" as const),
      paidAt: input.paymentStatus === "paid" ? now : undefined,
      status: "pending" as const,
      notes: undefined,
      customerNotes: input.customerNotes,
      timezone,
      statusHistory: [
        {
          status: "pending" as const,
          changedAt: now,
          changedBy: customerOid,
          changedByRole: "CLIENT" as const,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    const result = await orders.insertOne(orderDoc);
    const orderId = result.insertedId;

    const qr = generateQRToken(orderId);
    await orders.updateOne(
      { _id: orderId },
      { $set: { qrToken: qr.token, qrTokenHash: qr.tokenHash } }
    );

    await redis.setex(
      redisKeys.qrVerification(qr.tokenHash),
      QR_TTL_SECONDS,
      orderId.toHexString()
    );

    return {
      ...orderDoc,
      _id: orderId,
      qrToken: qr.token,
      qrTokenHash: qr.tokenHash,
    };
  });
}


export async function createPosOrder(
  input: CreatePosOrderInput,
  staffId: string,
  staffRole: string
) {
  return withLock(lockKeys.orderCreate(staffId, input.BranchId), async () => {
    const orders = db.collection("orders");
    const branches = db.collection("branches");

    const branchId = new ObjectId(input.BranchId);
    const branch = await branches.findOne({ _id: branchId });
    if (!branch) throw new Error("Branch not found");

    const shopId = new ObjectId(branch.ShopId);
    const timezone: string = branch.timezone || "UTC";

    const items = await snapshotOrderItems(input.items, shopId);
    const totals = await calculateTotals(items, shopId, input.discount || 0);
    const orderNumber = await generateOrderNumber(branchId, timezone);

    const now = nowUtc();
    const staffOid = new ObjectId(staffId);

    const orderDoc = {
      orderNumber,
      ShopId: shopId,
      BranchId: branchId,
      customerId: input.customerId
        ? new ObjectId(input.customerId)
        : undefined,
      source: "pos" as const,
      createdBy: { userId: staffOid, role: staffRole },
      items,
      ...totals,
      paymentMethod: input.paymentMethod,
      paymentStatus:
        input.paymentStatus === "paid" ? "paid" : ("pending" as const),
      paidAt: input.paymentStatus === "paid" ? now : undefined,
      status: "confirmed" as const,
      notes: input.notes,
      customerNotes: undefined,
      guestName: input.guestName,
      timezone,
      statusHistory: [
        {
          status: "confirmed" as const,
          changedAt: now,
          changedBy: staffOid,
          changedByRole: staffRole,
        },
      ],
      createdAt: now,
      updatedAt: now,
      confirmedAt: now,
    };

    const result = await orders.insertOne(orderDoc);

    const qr = generateQRToken(result.insertedId);
    await orders.updateOne(
      { _id: result.insertedId },
      { $set: { qrToken: qr.token, qrTokenHash: qr.tokenHash } }
    );
    await redis.setex(
      redisKeys.qrVerification(qr.tokenHash),
      QR_TTL_SECONDS,
      result.insertedId.toHexString()
    );
    return { ...orderDoc, _id: result.insertedId, qrToken: qr.token, qrTokenHash: qr.tokenHash };
  });
}

export async function getOrderById(id: ObjectId) {
  return db.collection("orders").findOne({ _id: id });
}


export async function* getOrders(filter: Record<string, any>) {
  const ordersCursor = db.collection("orders").find(filter).sort({ createdAt: -1 });

  for await (const order of ordersCursor) {
    yield order;
  }
}

async function* getUsersByIds(ids: string[]) {
  if (ids.length === 0) return;

  const usersCursor = db
    .collection("users")
    .find({ _id: { $in: ids.map((id) => new ObjectId(id)) } }, { projection: { password: 0 } });

  for await (const user of usersCursor) {
    yield user;
  }
}

async function* getBranchesByIds(ids: string[]) {
  if (ids.length === 0) return;

  const branchesCursor = db
    .collection("branches")
    .find({ _id: { $in: ids.map((id) => new ObjectId(id)) } }, { projection: { name: 1 } });

  for await (const branch of branchesCursor) {
    yield branch;
  }
}

export async function* getOrdersWithDetails(filter: Record<string, any>) {
  const customerIdsSet = new Set<string>();
  const branchIdsSet = new Set<string>();
  const ordersBuffer: any[] = [];

  for await (const order of getOrders(filter)) {
    ordersBuffer.push(order);
    if (order.customerId) customerIdsSet.add(order.customerId.toString());
    if (order.BranchId) branchIdsSet.add(order.BranchId.toString());
  }

  const usersById: Record<string, any> = {};
  for await (const user of getUsersByIds([...customerIdsSet])) {
    usersById[user._id.toString()] = user;
  }

  const branchesById: Record<string, string> = {};
  for await (const branch of getBranchesByIds([...branchIdsSet])) {
    branchesById[branch._id.toString()] = branch.name;
  }

  for (const order of ordersBuffer) {
    yield {
      ...order,
      customer: usersById[order.customerId?.toString()] ?? null,
      branchName: branchesById[order.BranchId?.toString()] ?? "Unknown Branch",
    };
  }
}

export async function getOrderByQRToken(token: string) {
  const verified = verifyQRTokenSignature(token);
  if (!verified) return null;

  const cached = await redis.get(
    redisKeys.qrVerification(verified.tokenHash)
  );
  if (cached) {
    return getOrderById(new ObjectId(cached));
  }

  const order = await db
    .collection("orders")
    .findOne({ $or: [{ qrToken: token }, { qrTokenHash: verified.tokenHash }] });

  if (order) {
    await redis.setex(
      redisKeys.qrVerification(verified.tokenHash),
      QR_TTL_SECONDS,
      order._id.toHexString()
    );
  }

  return order;
}

export async function getOrderByQRTokenHash(hash: string) {
  const cached = await redis.get(redisKeys.qrVerification(hash));
  if (cached) {
    return getOrderById(new ObjectId(cached));
  }

  const order = await db
    .collection("orders")
    .findOne({ qrTokenHash: hash });

  if (order) {
    await redis.setex(
      redisKeys.qrVerification(hash),
      QR_TTL_SECONDS,
      order._id.toHexString()
    );
  }

  return order;
}

export async function* getOrdersByShopId(shopId: ObjectId) {
  for await (const order of db.collection("orders").find({ ShopId: shopId }).sort({ createdAt: -1 })) {
    yield order;
  }
}

export async function* getActiveOrdersByUserId(userId: ObjectId) {
  for await (const order of db.collection("orders").find({
    customerId: userId,
    status: { $nin: ["completed", "cancelled"] },
  }).sort({ createdAt: -1 })) {
    yield order;
  }
}

export async function getOrderCountsForDashboard(userId: ObjectId) {
  const orders = db.collection("orders");
  const total = await orders.countDocuments({ customerId: userId });
  const completed = await orders.countDocuments({ customerId: userId, status: "completed" });
  const inProduction = await orders.countDocuments({
    customerId: userId,
    status: { $in: ["confirmed", "preparing", "ready"] }
  });
  return { total, inProduction, completed };
}


export async function updateOrderStatus(
  orderId: ObjectId,
  newStatus: OrderStatus,
  changedBy: { userId: string; role: string },
  notes?: string
) {
  const orders = db.collection("orders");
  const order = await orders.findOne({ _id: orderId });
  if (!order) throw new Error("Order not found");

  const currentStatus = order.status as OrderStatus;
  const allowed = STATE_TRANSITIONS[currentStatus];

  if (!allowed.includes(newStatus)) {
    throw new Error(
      `Cannot transition from "${currentStatus}" to "${newStatus}"`
    );
  }

  if (newStatus === "cancelled" && changedBy.role === "CLIENT") {
    if (order.customerId?.toString() !== changedBy.userId) {
      throw new Error("Cannot cancel another user's order");
    }
    if (currentStatus !== "pending") {
      throw new Error("Clients can only cancel pending orders");
    }
  }

  const now = nowUtc();
  const timestampField = `${newStatus}At`;
  const result = await orders.findOneAndUpdate(
    { _id: orderId, status: currentStatus },
    {
      $set: {
        status: newStatus,
        updatedAt: now,
        [timestampField]: now,
      },
      $push: {
        statusHistory: {
          status: newStatus,
          changedAt: now,
          changedBy: new ObjectId(changedBy.userId),
          changedByRole: changedBy.role,
          notes,
        },
      } as any,
    },
    { returnDocument: "after" }
  );

  if (!result) throw new Error("Order status changed concurrently, please retry");

  try {
    const orderPayload = {
      orderId: result._id,
      orderNumber: result.orderNumber,
      status: result.status,
      BranchId: result.BranchId?.toString(),
      ShopId: result.ShopId?.toString(),
    };

    if (result.BranchId) {
      emitToBranch(result.BranchId.toString(), "order:statusChanged", orderPayload);
    }
    if (result.ShopId) {
      emitToShop(result.ShopId.toString(), "order:statusChanged", orderPayload);
    }

    if (result.customerId) {
      const customerStr = result.customerId.toString();

      emitToUser(customerStr, "order:updated", {
        orderId: result._id,
        orderNumber: result.orderNumber,
        status: result.status,
      });

      if (["preparing", "ready", "completed"].includes(result.status)) {
        const users = db.collection("users");
        const customer = await users.findOne({ _id: result.customerId });
        if (customer && customer.pushTokens && customer.pushTokens.length > 0) {
          const title = "Actualización de Orden";
          const body = result.status === "preparing"
            ? `Tu orden #${result.orderNumber} está siendo preparada.`
            : result.status === "ready"
              ? `¡Tu orden #${result.orderNumber} está lista para recoger!`
              : `Tu orden #${result.orderNumber} ha sido Completada Muchas gracias por tu Compra, te esperamos pronto!`;

          await sendPushNotification(customer.pushTokens, title, body, {
            orderId: result._id,
            status: result.status
          });
        }
      }
    }
  } catch (err) {
    console.error("[Orders] Failed to dispatch notifications:", err);
  }

  return result;
}


export async function markOrderAsPaid(
  orderId: ObjectId,
  paymentMethod: string
) {
  const orders = db.collection("orders");
  const order = await orders.findOne({ _id: orderId });
  if (!order) throw new Error("Order not found");

  if (order.paymentStatus === "paid") {
    throw new Error("Order is already paid");
  }
  if (order.status === "cancelled") {
    throw new Error("Cannot pay a cancelled order");
  }

  const now = nowUtc();
  const result = await orders.findOneAndUpdate(
    { _id: orderId, paymentStatus: { $ne: "paid" }, status: { $ne: "cancelled" } },
    {
      $set: {
        paymentMethod,
        paymentStatus: "paid",
        paidAt: now,
        updatedAt: now,
      },
    },
    { returnDocument: "after" }
  );

  if (!result) throw new Error("Order is already paid or cancelled");
  return result;
}

export async function refundOrder(orderId: ObjectId) {
  const orders = db.collection("orders");
  const order = await orders.findOne({ _id: orderId });
  if (!order) throw new Error("Order not found");

  if (order.paymentStatus !== "paid") {
    throw new Error("Can only refund paid orders");
  }

  const result = await orders.findOneAndUpdate(
    { _id: orderId, paymentStatus: "paid" },
    {
      $set: {
        paymentStatus: "refunded",
        updatedAt: nowUtc(),
      },
    },
    { returnDocument: "after" }
  );

  if (!result) throw new Error("Order is already refunded or not in paid state");
  return result;
}

export async function applyDiscount(orderId: ObjectId, amount: number) {
  const orders = db.collection("orders");
  const order = await orders.findOne({ _id: orderId });
  if (!order) throw new Error("Order not found");

  if (order.status === "completed" || order.status === "cancelled") {
    throw new Error("Cannot apply discount to a finished order");
  }

  const newTotal = Math.max(order.subtotal + order.tax - amount, 0);
  const result = await orders.findOneAndUpdate(
    { _id: orderId, status: { $nin: ["completed", "cancelled"] } },
    {
      $set: {
        discount: amount,
        total: newTotal,
        updatedAt: nowUtc(),
      },
    },
    { returnDocument: "after" }
  );

  if (!result) throw new Error("Cannot apply discount to a finished order");
  return result;
}


export async function getDashboardStats(filter: {
  ShopId?: ObjectId;
  BranchId?: ObjectId;
}) {
  const col = db.collection("orders");

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 6);

  const base: Record<string, any> = {};
  if (filter.ShopId) base.ShopId = filter.ShopId;
  if (filter.BranchId) base.BranchId = filter.BranchId;

  let todayRevenue = 0;
  let todayOrdersCount = 0;
  const todayCustomers = new Set<string>();

  let yesterdayRevenue = 0;
  let yesterdayOrdersCount = 0;

  const weeklyRevenueByDay = new Map<string, number>();

  const productsMap = new Map<string, { quantity: number; revenue: number }>();

  const recentBuffer: any[] = [];
  const RECENT_LIMIT = 10;

  const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

  const pendingCount = await col.countDocuments({ ...base, status: "pending" });

  const cursor = col
    .find(
      { ...base, createdAt: { $gte: weekStart }, status: { $nin: ["cancelled"] } },
      { projection: { total: 1, createdAt: 1, status: 1, customerId: 1, guestName: 1, items: 1, orderNumber: 1 } }
    )
    .sort({ createdAt: -1 });

  for await (const order of cursor) {
    const orderDate = order.createdAt as Date;
    const total = (order.total as number) ?? 0;

    if (recentBuffer.length < RECENT_LIMIT) {
      recentBuffer.push(order);
    }

    const isToday = orderDate >= todayStart;
    const isYesterday = !isToday && orderDate >= yesterdayStart;

    if (isToday) {
      todayRevenue += total;
      todayOrdersCount++;
      const key = order.customerId?.toString() ?? order.guestName;
      if (key) todayCustomers.add(key);
    } else if (isYesterday) {
      yesterdayRevenue += total;
      yesterdayOrdersCount++;
    }

    const dayLabel = DAY_NAMES[orderDate.getDay()];
    weeklyRevenueByDay.set(dayLabel, (weeklyRevenueByDay.get(dayLabel) ?? 0) + total);

    if (Array.isArray(order.items)) {
      for (const item of order.items as any[]) {
        const name = item.name as string;
        const qty = (item.quantity as number) ?? 1;
        const itemTotal = (item.itemTotal as number) ?? 0;
        const entry = productsMap.get(name);
        if (entry) {
          entry.quantity += qty;
          entry.revenue += itemTotal;
        } else {
          productsMap.set(name, { quantity: qty, revenue: itemTotal });
        }
      }
    }
  }

  const orderedDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const weeklySales = orderedDays.map((day) => ({
    day,
    value: +((weeklyRevenueByDay.get(day) ?? 0)).toFixed(2),
  }));

  const topProducts = [...productsMap.entries()]
    .sort((a, b) => b[1].quantity - a[1].quantity)
    .slice(0, 5)
    .map(([name, data]) => ({
      name,
      quantity: data.quantity,
      revenue: +data.revenue.toFixed(2),
    }));

  const revenueTrend =
    yesterdayRevenue > 0
      ? +(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100).toFixed(1)
      : 0;
  const ordersTrend =
    yesterdayOrdersCount > 0
      ? +(((todayOrdersCount - yesterdayOrdersCount) / yesterdayOrdersCount) * 100).toFixed(1)
      : 0;

  const customerOids = recentBuffer.map((o) => o.customerId).filter(Boolean);
  const customersMap = new Map<string, string>();
  if (customerOids.length > 0) {
    const usersCursor = db
      .collection("users")
      .find({ _id: { $in: customerOids } }, { projection: { name: 1, lastName: 1 } });
    for await (const user of usersCursor) {
      customersMap.set(user._id.toString(), `${user.name} ${user.lastName}`);
    }
  }

  const recentOrders = recentBuffer.map((o) => ({
    id: (o.orderNumber as string) ?? o._id.toString(),
    customer: customersMap.get(o.customerId?.toString()) ?? (o.guestName as string) ?? "Cliente",
    items: (o.items as any[])?.length ?? 0,
    total: +((o.total as number) ?? 0).toFixed(2),
    status: o.status as string,
    createdAt: o.createdAt,
  }));

  return {
    today: {
      revenue: +todayRevenue.toFixed(2),
      ordersCount: todayOrdersCount,
      uniqueCustomers: todayCustomers.size,
    },
    yesterday: {
      revenue: +yesterdayRevenue.toFixed(2),
      ordersCount: yesterdayOrdersCount,
    },
    trends: { revenue: revenueTrend, orders: ordersTrend },
    pendingCount,
    weeklySales,
    topProducts,
    recentOrders,
  };
}

export async function getAdminDashboardStats() {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const [shopsCount, usersCount, sessionsCount] = await Promise.all([
    db.collection("shops").countDocuments(),
    db.collection("users").countDocuments(),
    db.collection("sessions").countDocuments({ active: true }).catch(() => 0),
  ]);

  let platformRevenueToday = 0;
  const todayCursor = db
    .collection("orders")
    .find(
      { createdAt: { $gte: todayStart }, status: { $nin: ["cancelled"] } },
      { projection: { total: 1 } }
    );
  for await (const order of todayCursor) {
    platformRevenueToday += (order.total as number) ?? 0;
  }

  return {
    totalShops: shopsCount,
    totalUsers: usersCount,
    activeSessions: sessionsCount,
    platformRevenueToday: +platformRevenueToday.toFixed(2),
  };
}

export async function ensureOrderIndexes() {
  const orders = db.collection("orders");
  await orders.createIndexes([
    { key: { BranchId: 1, createdAt: -1 } },
    { key: { ShopId: 1, createdAt: -1 } },
    { key: { customerId: 1, createdAt: -1 } },
    { key: { orderNumber: 1 }, unique: true },
    { key: { qrTokenHash: 1 }, sparse: true },
    { key: { status: 1, BranchId: 1 } },
  ]);
}
