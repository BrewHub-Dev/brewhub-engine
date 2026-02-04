import { z } from "zod";
import { ObjectId } from "mongodb";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId")
  .transform((val) => new ObjectId(val));

export const userSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    lastName: z.string().min(1, "Last name is required"),
    username: z.string().min(3, "Username must have at least 3 characters"),
    password: z.string().min(6, "Password must have at least 6 characters"),
    address: z
      .object({
        street: z.string().min(1),
        city: z.string().min(1),
        state: z.string().min(1),
        zip: z.string().min(1),
        country: z.string().min(1),
      })
      .optional(),
    ShopId: objectIdSchema.optional(),
    BranchId: objectIdSchema.optional(),
    isClient: z.boolean(),
    phone: z.string().min(7, "Phone must have at least 7 digits"),
    emailAddress: z.email("Invalid email address"),
  })
  .refine(
    (data) => data.isClient || (data.ShopId && data.BranchId instanceof ObjectId),
    {
      message: "ShopId & BranchId are required when isClient is false",
      path: ["ShopId", "BranchId"],
    }
  );

export type User = z.infer<typeof userSchema>;
