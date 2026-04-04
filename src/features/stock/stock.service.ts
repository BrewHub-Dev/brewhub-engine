import { db } from "@/db/mongo";
import { ObjectId } from "mongodb";
import { stockItemSchema, StockItem } from "./stock.model";
import { type PaginationParams, paginatedResult } from "@/utils/pagination";

export async function createStockItem(data: StockItem) {
  const validated = stockItemSchema.parse(data);
  const col = db.collection('stock_ingredients');
  const toInsert = { ...validated, createdAt: new Date(), updatedAt: new Date() };
  const result = await col.insertOne(toInsert);
  return { ...toInsert, _id: result.insertedId };
}

export async function getStockItemsByShop(shopId: string, pagination: PaginationParams) {
  const col = db.collection('stock_ingredients');
  const filter = { shopId };

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

export async function updateStockItem(id: string, shopId: string, updates: Partial<StockItem>) {
  const col = db.collection('stock_ingredients');
  const toUpdate: Record<string, unknown> = { ...updates, updatedAt: new Date() };
  delete toUpdate.shopId;
  delete toUpdate._id;

  const result = await col.findOneAndUpdate(
    { _id: new ObjectId(id), shopId },
    { $set: toUpdate },
    { returnDocument: "after" }
  );
  if (!result) throw new Error("Stock item not found");
  return result;
}

export async function adjustStockQuantity(id: string, shopId: string, delta: number) {
  const col = db.collection('stock_ingredients');
  const item = await col.findOne({ _id: new ObjectId(id), shopId });
  if (!item) throw new Error("Stock item not found");

  const newQuantity = Math.max(0, (item.quantity ?? 0) + delta);

  const result = await col.findOneAndUpdate(
    { _id: new ObjectId(id), shopId },
    { $set: { quantity: newQuantity, updatedAt: new Date() } },
    { returnDocument: "after" }
  );
  return result;
}

export async function deleteStockItem(id: string, shopId: string) {
  const col = db.collection('stock_ingredients');
  const result = await col.deleteOne({ _id: new ObjectId(id), shopId });
  if (result.deletedCount === 0) throw new Error("Stock item not found");
  return true;
}

export async function getLowStockItems(shopId: string) {
  const col = db.collection('stock_ingredients');
  return col
    .find({
      shopId,
      active: true,
      $expr: { $lte: ["$quantity", "$minQuantity"] },
    })
    .toArray();
}
