import { z } from "zod";
import { ObjectId } from "mongodb";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId")
  .transform((val) => new ObjectId(val));

export const categoriesSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  ShopId: objectIdSchema,
  parentId: objectIdSchema.optional(),
});

export type Categories = z.infer<typeof categoriesSchema>;
