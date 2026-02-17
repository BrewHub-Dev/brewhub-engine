import { db } from "@/db/mongo";
import { shopSchema, Shop } from "./shop.model";
import { ObjectId } from "mongodb";

export async function createShop(shop: Shop) {
  const validated = shopSchema.parse(shop);
  const shops = db.collection("shops");
  const result = await shops.insertOne(validated);
  return { ...validated, _id: result.insertedId };
}

export async function getShops() {
  const shops = db.collection<Shop>("shops");
  return shops.find().toArray();
}

export async function getShopById(id: string) {
  const shops = db.collection<Shop>("shops");
  return shops.findOne({ _id: new ObjectId(id) });
}

export async function updateShop(id: string, updates: Partial<Shop>) {
  const shops = db.collection<Shop>("shops");
  const result = await shops.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: updates },
    { returnDocument: "after" }
  );
  if (!result) {
    throw new Error("Shop not found");
  }
  return result;
}

export async function deleteShop(id: string) {
  const shops = db.collection("shops");
  const result = await shops.deleteOne({ _id: new ObjectId(id) });
  if (result.deletedCount === 0) {
    throw new Error("Shop not found");
  }
  return true;
}
