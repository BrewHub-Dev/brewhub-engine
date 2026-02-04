import { db } from "@/db/mongo";
import { shopSchema, Shop } from "./shop.model";

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
