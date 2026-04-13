import { db } from "@/db/mongo";
import { ObjectId } from "mongodb";
import { stockItemSchema, StockItem } from "./stock.model";
import { type PaginationParams, paginatedResult } from "@/utils/pagination";

export async function createStockItem(data: StockItem) {
  const validated = stockItemSchema.parse(data);
  const col = db.collection('stock_ingredients');
  const toInsert = {
    ...validated,
    branchId: new ObjectId(validated.branchId as string),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const result = await col.insertOne(toInsert);
  return { ...toInsert, _id: result.insertedId };
}

export async function getStockItemsByBranch(branchId: string, pagination: PaginationParams) {
  const col = db.collection('stock_ingredients');
  const filter = { branchId: new ObjectId(branchId) };

  const [total, data] = await Promise.all([
    col.countDocuments(filter),
    col
      .find(filter)
      .skip(pagination.skip)
      .limit(pagination.limit)
      .sort({ category: 1, name: 1 })
      .toArray(),
  ]);

  return paginatedResult(data, total, pagination.page, pagination.limit);
}

export async function getStockItemById(id: string) {
  const col = db.collection('stock_ingredients');
  return col.findOne({ _id: new ObjectId(id) });
}

export async function updateStockItem(id: string, branchId: string, updates: Partial<StockItem>) {
  const col = db.collection('stock_ingredients');
  const toUpdate: Record<string, unknown> = { ...updates, updatedAt: new Date() };
  delete toUpdate.branchId;
  delete toUpdate._id;

  const result = await col.findOneAndUpdate(
    { _id: new ObjectId(id), branchId: new ObjectId(branchId) },
    { $set: toUpdate },
    { returnDocument: "after" }
  );
  if (!result) throw new Error("Stock item not found");
  return result;
}

export async function adjustStockQuantity(id: string, branchId: string, delta: number) {
  const col = db.collection('stock_ingredients');
  const branchOid = new ObjectId(branchId);
  const item = await col.findOne({ _id: new ObjectId(id), branchId: branchOid });
  if (!item) throw new Error("Stock item not found");

  const newQuantity = Math.max(0, (item.quantity ?? 0) + delta);

  const result = await col.findOneAndUpdate(
    { _id: new ObjectId(id), branchId: branchOid },
    { $set: { quantity: newQuantity, updatedAt: new Date() } },
    { returnDocument: "after" }
  );
  return result;
}

export async function deleteStockItem(id: string, branchId: string) {
  const col = db.collection('stock_ingredients');
  const result = await col.deleteOne({ _id: new ObjectId(id), branchId: new ObjectId(branchId) });
  if (result.deletedCount === 0) throw new Error("Stock item not found");
  return true;
}

export async function getLowStockItems(branchId: string) {
  const col = db.collection('stock_ingredients');
  return col
    .find({
      branchId: new ObjectId(branchId),
      active: true,
      $expr: { $lte: ["$quantity", "$minQuantity"] },
    })
    .toArray();
}

export async function checkAndSendStockAlerts(branchId: string, shopId: string): Promise<{ sent: boolean; count: number }> {
  const col = db.collection('stock_ingredients');
  const branches = db.collection('branches');
  const shops = db.collection('shops');

  const branch = await branches.findOne({ _id: new ObjectId(branchId) });
  const shop = await shops.findOne({ _id: new ObjectId(shopId) });

  if (!shop) return { sent: false, count: 0 };

  const shopAlertEmail = shop.notifications?.email || shop.alertEmail;
  if (!shopAlertEmail) return { sent: false, count: 0 };

  const lowStock = await col
    .find({
      branchId: new ObjectId(branchId),
      active: true,
      $and: [
        { quantity: { $gt: 0 } },
        {
          $expr: {
            $lte: [
              { $divide: ["$quantity", "$minQuantity"] },
              0.15
            ]
          }
        }
      ]
    })
    .toArray();

  if (lowStock.length === 0) return { sent: false, count: 0 };

  const { sendStockAlertEmail } = await import("@/services/email.service");
  
  const items = lowStock.map((item) => ({
    name: item.name,
    quantity: item.quantity,
    minQuantity: item.minQuantity,
    unit: item.unit,
  }));

  const sent = await sendStockAlertEmail(
    shopAlertEmail,
    shop.name || "Mi Tienda",
    items
  );

  return { sent, count: lowStock.length };
}

export async function checkAllBranchesAndSendAlerts(shopId: string): Promise<{ branchId: string; count: number; sent: boolean }[]> {
  const branches = db.collection('branches');
  const branchList = await branches.find({ ShopId: new ObjectId(shopId) }).toArray();

  const results: { branchId: string; count: number; sent: boolean }[] = [];

  for (const branch of branchList) {
    const result = await checkAndSendStockAlerts(branch._id.toString(), shopId);
    results.push({
      branchId: branch._id.toString(),
      count: result.count,
      sent: result.sent,
    });
  }

  return results;
}
