import { z } from "zod";

export const userSchema = z.object({
  name: z.string().min(1),
  lastName: z.string().min(1),
  username: z.string().min(3),
  password: z.string().min(6),
  address: z.object({
    street: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(1),
    zip: z.string().min(1),
    country: z.string().min(1),
  }).optional(),
  coffeeShopId: z.string().min(1).optional(),
  isClient: z.boolean(),
  phone: z.string().min(7),
  emailAddress: z.string().email(),
}).refine(
  (data) => data.isClient || (!!data.coffeeShopId && data.coffeeShopId.length > 0),
  {
    message: "coffeeShopId is required when isClient is false",
    path: ["coffeeShopId"],
  }
);

export type User = z.infer<typeof userSchema>;
