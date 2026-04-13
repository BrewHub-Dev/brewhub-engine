import { z } from "zod";

export const recipeIngredientSchema = z.object({
  stockItemId: z.string(),
  quantity: z.number().positive(),
  unit: z.string(),
});

export const recipeSchema = z.object({
  itemId: z.string(),
  branchId: z.string(),
  name: z.string(),
  ingredients: z.array(recipeIngredientSchema),
  yield: z.number().int().positive().default(1),
  prepTime: z.number().int().min(0).optional(),
  instructions: z.string().optional(),
  isActive: z.boolean().default(true),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type RecipeIngredient = z.infer<typeof recipeIngredientSchema>;
export type Recipe = z.infer<typeof recipeSchema>;

export const createRecipeSchema = recipeSchema.omit({
  createdAt: true,
  updatedAt: true,
});

export type CreateRecipeInput = z.infer<typeof createRecipeSchema>;

export const consumeInventorySchema = z.object({
  items: z.array(z.object({
    itemId: z.string(),
    quantity: z.number().int().positive(),
  })),
  branchId: z.string(),
});

export type ConsumeInventoryInput = z.infer<typeof consumeInventorySchema>;