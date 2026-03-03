import { z } from "zod";
import { ObjectId } from "mongodb";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId")
  .transform((val) => new ObjectId(val));

export const invitationSchema = z.object({
  _id: objectIdSchema.optional(),
  tenantId: objectIdSchema,
  inviteCode: z.string().min(8).max(50),
  type: z.enum(['qr', 'link']),

  branchId: objectIdSchema.optional(),

  maxUses: z.number().int().min(1).optional(),
  usedCount: z.number().int().default(0),

  expiresAt: z.date().optional(),

  metadata: z.object({
    createdBy: objectIdSchema,
    description: z.string().optional(),
  }),

  active: z.boolean().default(true),

  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

export type Invitation = z.infer<typeof invitationSchema>;
