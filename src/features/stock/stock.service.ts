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
