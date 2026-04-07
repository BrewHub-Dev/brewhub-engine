import { z } from "zod";

export const STOCK_UNITS = [
  "kg", "g", "l", "ml", "pcs",
  "caja", "bolsa", "botella", "lata", "sobre",
] as const;

export type StockUnit = typeof STOCK_UNITS[number];

export const stockItemSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  unit: z.enum(STOCK_UNITS),
  quantity: z.number().min(0).default(0),
  minQuantity: z.number().min(0).default(0),
  maxQuantity: z.number().min(0).optional(),
  branchId: z.string(),
  description: z.string().optional(),
  supplier: z.string().optional(),
  cost: z.number().min(0).optional(),
  active: z.boolean().default(true),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type StockItem = z.infer<typeof stockItemSchema>;
