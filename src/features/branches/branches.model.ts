import { z } from "zod";
import { ObjectId } from "mongodb";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId")
  .transform((val) => new ObjectId(val));

export const branchesSchema = z.object({
  name: z.string().min(1),

  address: z.object({
    street: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(1),
    zip: z.string().min(1),
    country: z.string().length(2), // ISO: MX, US
  }),

  phone: z.string().min(7),

  ShopId: objectIdSchema,

  active: z.boolean().default(true),

  location: z.object({
    lat: z
      .number()
      .min(-90)
      .max(90),
    lng: z
      .number()
      .min(-180)
      .max(180),
  }).optional(),

  timezone: z
    .string()
    .min(1)
    .default("America/Tijuana"),

});

export type Branches = z.infer<typeof branchesSchema>;
