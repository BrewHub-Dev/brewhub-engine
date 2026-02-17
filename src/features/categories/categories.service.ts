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

export async function updateCategory(id: ObjectId, update: Partial<Categories>) {
  const validated = categoriesSchema.partial().parse(update);
  const categories = db.collection("categories");
  const result = await categories.findOneAndUpdate(
    { _id: id },
    { $set: validated },
    { returnDocument: "after" }
  );
  return result.value;
}

