import { db } from "@/db/mongo";
import { Categories, categoriesSchema } from "./categories.model";
import { ObjectId } from "mongodb";

export async function createCategory(category: Categories) {
  const validated = categoriesSchema.parse(category);
  const categories = db.collection("categories");
  const result = await categories.insertOne(validated);
  return { ...validated, _id: result.insertedId };
}

export async function getCategoriesByShopId(ShopId: ObjectId) {
  const categories = db.collection("categories");
  const result = await categories
    .find({ ShopId })
    .toArray();
  return result;
}

