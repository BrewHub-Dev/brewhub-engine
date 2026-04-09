import { z } from "zod";
import { ObjectId } from "mongodb";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId")
  .transform((val) => new ObjectId(val));

export const favoriteSchema = z.object({
  _id: objectIdSchema.optional(),
  userId: objectIdSchema,
  itemId: objectIdSchema,
  createdAt: z.date().default(() => new Date()),
});

export const createFavoriteSchema = z.object({
  itemId: z.string(),
});

export type Favorite = z.infer<typeof favoriteSchema>;
export type CreateFavoriteInput = z.infer<typeof createFavoriteSchema>;
