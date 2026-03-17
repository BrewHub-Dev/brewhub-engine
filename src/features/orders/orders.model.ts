import { z } from "zod";
import { ObjectId } from "mongodb";

export const orderStatusEnum = z.enum([
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "completed",
  "cancelled",
]);
export type OrderStatus = z.infer<typeof orderStatusEnum>;

export const paymentStatusEnum = z.enum(["pending", "paid", "refunded"]);
export type PaymentStatus = z.infer<typeof paymentStatusEnum>;

export const paymentMethodEnum = z.enum([
  "card",
  "cash",
  "wallet",
  "bank_transfer",
]);
export type PaymentMethod = z.infer<typeof paymentMethodEnum>;

export const orderSourceEnum = z.enum(["pos", "app"]);
export type OrderSource = z.infer<typeof orderSourceEnum>;

export const userRoleEnum = z.enum([
  "ADMIN",
  "SHOP_ADMIN",
  "BRANCH_ADMIN",
  "CLIENT",
]);

export const orderModifierSchema = z.object({
  name: z.string().min(1),
  optionName: z.string().min(1),
  extraPrice: z.number().min(0).optional().nullable(),
});

export const orderItemSchema = z.object({
  itemId: z.instanceof(ObjectId),
  name: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().min(0),
  modifiers: z.array(orderModifierSchema).optional(),
  itemTotal: z.number().min(0),
  notes: z.string().optional(),
});
export type OrderItem = z.infer<typeof orderItemSchema>;

export const statusHistoryEntrySchema = z.object({
  status: orderStatusEnum,
  changedAt: z.date(),
  changedBy: z.string(),
  changedByRole: userRoleEnum,
  notes: z.string().optional(),
});

export const createOrderItemInput = z.object({
  itemId: z.string(),
  quantity: z.number().int().positive(),
  modifiers: z
    .array(
      z.object({
        name: z.string().min(1),
        optionName: z.string().min(1),
      })
    )
    .optional(),
  notes: z.string().optional(),
});

export const createAppOrderSchema = z.object({
  BranchId: z.string(),
  items: z.array(createOrderItemInput).min(1),
  paymentMethod: paymentMethodEnum,
  paymentStatus: paymentStatusEnum.optional(),
  customerNotes: z.string().optional(),
});
export type CreateAppOrderInput = z.infer<typeof createAppOrderSchema>;

export const createPosOrderSchema = z
  .object({
    BranchId: z.string(),
    items: z.array(createOrderItemInput).min(1),
    paymentMethod: paymentMethodEnum,
    paymentStatus: paymentStatusEnum.optional(),
    customerId: z.string().optional(),
    guestName: z.string().min(1).optional(),
    notes: z.string().optional(),
    discount: z.number().min(0).optional(),
  })
  .refine((data) => !!data.customerId || !!data.guestName, {
    message: "Se requiere customerId o guestName para identificar al cliente",
    path: ["guestName"],
  });
export type CreatePosOrderInput = z.infer<typeof createPosOrderSchema>;

export const orderSchema = z.object({
  orderNumber: z.string(),
  ShopId: z.string(),
  BranchId: z.string(),
  customerId: z.string().optional(),
  source: orderSourceEnum,
  createdBy: z.object({
    userId: z.string(),
    role: userRoleEnum,
  }),
  items: z.array(orderItemSchema).min(1),
  subtotal: z.number().min(0),
  tax: z.number().min(0),
  discount: z.number().min(0).default(0),
  total: z.number().min(0),
  paymentMethod: paymentMethodEnum,
  paymentStatus: paymentStatusEnum,
  paidAt: z.date().optional(),
  status: orderStatusEnum,
  qrTokenHash: z.string().optional(),
  notes: z.string().optional(),
  customerNotes: z.string().optional(),
  guestName: z.string().optional(),
  statusHistory: z.array(statusHistoryEntrySchema),
  timezone: z.string().default("UTC"),
  createdAt: z.date(),
  updatedAt: z.date(),
  confirmedAt: z.date().optional(),
  preparingAt: z.date().optional(),
  readyAt: z.date().optional(),
  completedAt: z.date().optional(),
  cancelledAt: z.date().optional(),
});
export type Order = z.infer<typeof orderSchema>;

export const STATE_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};
