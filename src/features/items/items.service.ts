import { db } from "@/db/mongo";
import { Items, itemsSchema } from "./items.model";
import { ObjectId } from "mongodb";

export async function createItem(item: Items) {
  const validated = itemsSchema.parse(item);
  const categories = db.collection("categories");
  const category = await categories.findOne({
    _id: new ObjectId(validated.categoryId),
    ShopId: new ObjectId(validated.ShopId),
  });
  if (!category) {
    throw new Error("Category not found for this shop");
  }
  const items = db.collection("items");
  const toInsert = {
    ...validated,
    ShopId: new ObjectId(validated.ShopId),
    categoryId: new ObjectId(validated.categoryId),
  };
  const result = await items.insertOne(toInsert);

  return { ...toInsert, _id: result.insertedId };
}
export async function getItemsByShopId(ShopId: ObjectId) {
  const items = db.collection("items");
  const categories = db.collection("categories");

  const result = await items
    .find({ ShopId: new ObjectId(ShopId) })
    .toArray();

  const categoryIds = Array.from(
    new Set(result.map(item => item.categoryId?.toString()).filter(Boolean))
  ).map(id => new ObjectId(id));

  const categoriesMap = new Map<string, any>();
  if (categoryIds.length > 0) {
    const cats = await categories.find({ _id: { $in: categoryIds } }).toArray();
    cats.forEach(cat => categoriesMap.set(cat._id.toString(), cat));
  }

  const itemsWithCategory = result.map(item => ({
    ...item,
    category: categoriesMap.get(item.categoryId?.toString()) || null,
  }));

  return itemsWithCategory;
}

export async function getItemById(id: ObjectId) {
  const items = db.collection("items");
  const categories = db.collection("categories");

  const item = await items.findOne({ _id: id });

  if (!item) return null;

  // Obtener categoría si existe
  if (item.categoryId) {
    const category = await categories.findOne({ _id: new ObjectId(item.categoryId) });
    return {
      ...item,
      category: category || null,
    };
  }

  return item;
}

export async function updateItem(id: ObjectId, updates: Partial<Items>) {
  const items = db.collection("items");

  // Convertir campos a ObjectId si es necesario
  const toUpdate: any = { ...updates };
  if (updates.categoryId) {
    toUpdate.categoryId = new ObjectId(updates.categoryId);
  }
  if (updates.ShopId) {
    toUpdate.ShopId = new ObjectId(updates.ShopId);
  }

  const result = await items.findOneAndUpdate(
    { _id: id },
    { $set: toUpdate },
    { returnDocument: "after" }
  );

  if (!result) {
    throw new Error("Item not found");
  }

  // Obtener con categoría
  return getItemById(id);
}

export async function deleteItem(id: ObjectId) {
  const items = db.collection("items");

  const result = await items.deleteOne({ _id: id });

  if (result.deletedCount === 0) {
    throw new Error("Item not found");
  }

  return true;
}
