import { z } from "zod";

export const promoCodeTypeEnum = z.enum([
  "percentage",
  "fixed",
  "buy_x_get_y",
]);
export type PromoCodeType = z.infer<typeof promoCodeTypeEnum>;

export const promoTargetEnum = z.enum([
  "all",
  "items",
  "categories",
]);
export type PromoTarget = z.infer<typeof promoTargetEnum>;

export const promoScheduleSchema = z.object({
  dayOfWeek: z.array(z.number().min(0).max(6)).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

export const promoCodeSchema = z.object({
  code: z.string().min(3).max(20).toUpperCase(),
  type: promoCodeTypeEnum,
  value: z.number().positive(),
  description: z.string().optional(),
  shopId: z.string(),
  branchId: z.string().optional(),
  target: promoTargetEnum.default("all"),
  applicableItems: z.array(z.string()).optional(),
  applicableCategories: z.array(z.string()).optional(),
  minOrderAmount: z.number().min(0).optional(),
  maxDiscount: z.number().min(0).optional(),
  maxUses: z.number().int().positive().optional(),
  usesCount: z.number().int().min(0).default(0),
  perUserLimit: z.number().int().positive().optional(),
  validFrom: z.date().optional(),
  validUntil: z.date().optional(),
  schedule: promoScheduleSchema.optional(),
  isActive: z.boolean().default(true),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type PromoCode = z.infer<typeof promoCodeSchema>;

export const createPromoCodeSchema = promoCodeSchema.omit({
  usesCount: true,
  createdAt: true,
  updatedAt: true,
}).required({ code: true, type: true, value: true, shopId: true });

export const applyPromoCodeSchema = z.object({
  code: z.string().min(3).max(20).toUpperCase(),
  orderId: z.string().optional(),
  items: z.array(z.object({
    itemId: z.string(),
    quantity: z.number().int().positive(),
    price: z.number().min(0),
    categoryId: z.string().optional(),
  })).optional(),
  subtotal: z.number().min(0),
});

export type CreatePromoCodeInput = z.infer<typeof createPromoCodeSchema>;
export type ApplyPromoCodeInput = z.infer<typeof applyPromoCodeSchema>;