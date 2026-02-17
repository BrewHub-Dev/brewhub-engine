import { z } from "zod";

export const itemsSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  ShopId: z.string(),
  price: z.number().min(0),
  cost: z.number().min(0).optional(),
  active: z.boolean().default(true),
  categoryId: z.string(),
  taxIncluded: z.boolean().default(false),
  images: z.array(z.string()).optional(),
  modifiers: z.array(
    z.object({
      name: z.string().min(1),
      required: z.boolean().default(false),
      options: z.array(
        z.object({
          name: z.string().min(1),
          extraPrice: z.number().min(0),
        })
      ),
    })
  ).optional(),
});

export type Items = z.infer<typeof itemsSchema>;
