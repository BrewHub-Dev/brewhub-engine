import { z } from "zod";
import { ObjectId } from "mongodb";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId")
  .transform((val) => new ObjectId(val));

export const userSchema = z
  .object({
    name: z.string().min(1),
    lastName: z.string().min(1),
    username: z.string().min(3),
    password: z.string().min(6),

    emailAddress: z.email(),
    phone: z.string().min(7),

    role: z.enum([
      "ADMIN",
      "SHOP_ADMIN",
      "BRANCH_ADMIN",
      "CLIENT",
    ]),

    address: z
      .object({
        street: z.string().min(1),
        city: z.string().min(1),
        state: z.string().min(1),
        zip: z.string().min(1),
        country: z.string().length(2),
      })
      .optional(),

    ShopId: objectIdSchema.optional(),
    BranchId: objectIdSchema.optional(),

    tenantId: objectIdSchema.optional(),
    tenants: z.array(
      z.object({
        tenantId: objectIdSchema,
        role: z.enum(['CLIENT', 'SHOP_ADMIN', 'BRANCH_ADMIN']),
        branchId: objectIdSchema.optional(),
        addedAt: z.date().default(() => new Date()),
      })
    ).optional(),

    active: z.boolean().default(true),

    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === "ADMIN") {
      return;
    }

    if (data.role === "SHOP_ADMIN") {
      if (!data.tenantId && !data.ShopId) {
        ctx.addIssue({
          path: ["tenantId"],
          code: "custom",
          message: "tenantId is required for SHOP_ADMIN",
        });
      }

      if (data.tenants && data.tenants.length === 0) {
        ctx.addIssue({
          path: ["tenants"],
          code: "custom",
          message: "SHOP_ADMIN must have at least one tenant",
        });
      }
    }

    if (data.role === "BRANCH_ADMIN") {
      if (!data.tenantId && !data.ShopId) {
        ctx.addIssue({
          path: ["tenantId"],
          code: "custom",
          message: "tenantId is required for BRANCH_ADMIN",
        });
      }

      const hasValidTenant = data.tenants?.some(
        t => t.role === 'BRANCH_ADMIN' && t.branchId
      );

      if (!hasValidTenant && !data.BranchId) {
        ctx.addIssue({
          path: ["tenants"],
          code: "custom",
          message: "BRANCH_ADMIN must have a tenant with branchId",
        });
      }
    }

    if (data.role === "CLIENT") {
      return;
    }
  });


export type User = z.infer<typeof userSchema>;
