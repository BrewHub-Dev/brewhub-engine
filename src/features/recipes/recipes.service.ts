import { db } from "@/db/mongo";
import { ObjectId } from "mongodb";
import {
  recipeSchema,
  type Recipe,
  type RecipeIngredient,
  type CreateRecipeInput,
} from "./recipes.model";
import { getStockItemById, adjustStockQuantity } from "../stock/stock.service";
import { getItemById } from "../items/items.service";

export async function createRecipe(data: CreateRecipeInput) {
  const validated = recipeSchema.parse(data);
  const col = db.collection("recipes");

  const existing = await col.findOne({
    itemId: new ObjectId(validated.itemId),
    branchId: new ObjectId(validated.branchId),
  });
  if (existing) {
    throw new Error("Ya existe una receta para este producto en esta sucursal");
  }

  const toInsert = {
    ...validated,
    branchId: new ObjectId(validated.branchId),
    itemId: new ObjectId(validated.itemId),
    ingredients: validated.ingredients.map((ing) => ({
      ...ing,
      stockItemId: new ObjectId(ing.stockItemId),
    })),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await col.insertOne(toInsert);
  return { ...toInsert, _id: result.insertedId };
}

export async function getRecipesByBranch(branchId: string) {
  const col = db.collection("recipes");
  return col
    .find({ branchId: new ObjectId(branchId), isActive: true })
    .toArray();
}

export async function getRecipeByItemId(itemId: string, branchId: string) {
  const col = db.collection("recipes");
  return col.findOne({
    itemId: new ObjectId(itemId),
    branchId: new ObjectId(branchId),
    isActive: true,
  });
}

export async function getRecipeById(id: string) {
  const col = db.collection("recipes");
  return col.findOne({ _id: new ObjectId(id) });
}

export async function updateRecipe(
  id: string,
  branchId: string,
  updates: Partial<CreateRecipeInput>
) {
  const col = db.collection("recipes");
  const toUpdate: Record<string, unknown> = { ...updates, updatedAt: new Date() };

  if (updates.ingredients) {
    toUpdate.ingredients = updates.ingredients.map((ing) => ({
      ...ing,
      stockItemId: new ObjectId(ing.stockItemId),
    }));
  }

  if (updates.itemId) {
    toUpdate.itemId = new ObjectId(updates.itemId);
  }

  delete toUpdate.branchId;
  delete toUpdate._id;

  const result = await col.findOneAndUpdate(
    { _id: new ObjectId(id), branchId: new ObjectId(branchId) },
    { $set: toUpdate },
    { returnDocument: "after" }
  );
  if (!result) throw new Error("Recipe not found");
  return result;
}

export async function deleteRecipe(id: string, branchId: string) {
  const col = db.collection("recipes");
  const result = await col.deleteOne({
    _id: new ObjectId(id),
    branchId: new ObjectId(branchId),
  });
  if (result.deletedCount === 0) throw new Error("Recipe not found");
  return true;
}

export async function consumeInventoryForOrder(
  items: { itemId: string; quantity: number }[],
  branchId: string
): Promise<{
  success: boolean;
  consumed: { stockItemId: string; quantity: number; remaining: number }[];
  insufficient: { stockItemId: string; name: string; needed: number; available: number }[];
}> {
  const consumed: { stockItemId: string; quantity: number; remaining: number }[] = [];
  const insufficient: { stockItemId: string; name: string; needed: number; available: number }[] = [];

  for (const orderItem of items) {
    const recipe = await getRecipeByItemId(orderItem.itemId, branchId);
    if (!recipe) continue;

    for (const ingredient of recipe.ingredients) {
      const neededQuantity = ingredient.quantity * orderItem.quantity;
      const stockItem = await getStockItemById(ingredient.stockItemId.toString());

      if (!stockItem) {
        insufficient.push({
          stockItemId: ingredient.stockItemId.toString(),
          name: "Unknown",
          needed: neededQuantity,
          available: 0,
        });
        continue;
      }

      if (stockItem.quantity < neededQuantity) {
        insufficient.push({
          stockItemId: ingredient.stockItemId.toString(),
          name: stockItem.name,
          needed: neededQuantity,
          available: stockItem.quantity,
        });
      } else {
        const remaining = stockItem.quantity - neededQuantity;
        await adjustStockQuantity(
          ingredient.stockItemId.toString(),
          branchId,
          -neededQuantity
        );
        consumed.push({
          stockItemId: ingredient.stockItemId.toString(),
          quantity: neededQuantity,
          remaining,
        });
      }
    }
  }

  return {
    success: insufficient.length === 0,
    consumed,
    insufficient,
  };
}

export async function checkInventoryAvailability(
  items: { itemId: string; quantity: number }[],
  branchId: string
): Promise<{
  available: boolean;
  details: { itemId: string; name: string; status: "ok" | "low" | "out"; 
    ingredients: { name: string; needed: number; available: number }[];
  }[];
}> {
  const details: {
    itemId: string;
    name: string;
    status: "ok" | "low" | "out";
    ingredients: { name: string; needed: number; available: number }[];
  }[] = [];

  for (const orderItem of items) {
    const recipe = await getRecipeByItemId(orderItem.itemId, branchId);
    if (!recipe) {
      details.push({
        itemId: orderItem.itemId,
        name: "Sin receta",
        status: "ok",
        ingredients: [],
      });
      continue;
    }

    const item = await getItemById(new ObjectId(orderItem.itemId));
    const ingredientDetails: { name: string; needed: number; available: number }[] = [];
    let status: "ok" | "low" | "out" = "ok";

    for (const ingredient of recipe.ingredients) {
      const neededQuantity = ingredient.quantity * orderItem.quantity;
      const stockItem = await getStockItemById(ingredient.stockItemId.toString());

      if (!stockItem) {
        status = "out";
        ingredientDetails.push({
          name: ingredient.stockItemId.toString(),
          needed: neededQuantity,
          available: 0,
        });
      } else if (stockItem.quantity < neededQuantity) {
        status = status === "ok" ? "low" : status;
        ingredientDetails.push({
          name: stockItem.name,
          needed: neededQuantity,
          available: stockItem.quantity,
        });
      } else {
        ingredientDetails.push({
          name: stockItem.name,
          needed: neededQuantity,
          available: stockItem.quantity,
        });
      }
    }

    details.push({
      itemId: orderItem.itemId,
      name: item?.name ?? "Unknown",
      status,
      ingredients: ingredientDetails,
    });
  }

  const available = !details.some((d) => d.status === "out");

  return { available, details };
}

export async function getRecipesWithLowStock(branchId: string) {
  const col = db.collection("recipes");
  const recipes = await col
    .find({ branchId: new ObjectId(branchId), isActive: true } as any)
    .toArray();

  const lowStockRecipes: {
    recipe: Recipe;
    ingredients: { name: string; needed: number; available: number }[];
  }[] = [];

  for (const recipe of recipes) {
    const lowIngredients: { name: string; needed: number; available: number }[] = [];

    for (const ingredient of recipe.ingredients) {
      const stockItem = await getStockItemById(ingredient.stockItemId.toString());
      if (stockItem && stockItem.quantity <= stockItem.minQuantity) {
        lowIngredients.push({
          name: stockItem.name,
          needed: ingredient.quantity,
          available: stockItem.quantity,
        });
      }
    }

    if (lowIngredients.length > 0) {
      lowStockRecipes.push({
        recipe: recipe as any,
        ingredients: lowIngredients,
      });
    }
  }

  return lowStockRecipes;
}