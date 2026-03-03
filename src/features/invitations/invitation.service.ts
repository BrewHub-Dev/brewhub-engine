import { db } from "@/db/mongo";
import { Invitation } from "./invitation.model";
import { ObjectId } from "mongodb";
import { randomBytes } from "node:crypto";

const invitations = () => db.collection<Invitation>("invitations");

/**
 * Genera un código de invitación único
 * Formato: ABC123-XYZ789
 */
export function generateInviteCode(): string {
  const random = randomBytes(6).toString('base64url');
  const timestamp = Date.now().toString(36);
  return `${random}-${timestamp}`.toUpperCase();
}

export async function createInvitation(data: {
  tenantId: ObjectId;
  createdBy: ObjectId;
  type: 'qr' | 'link';
  branchId?: ObjectId;
  maxUses?: number;
  expiresAt?: Date;
  description?: string;
}): Promise<Invitation> {
  const inviteCode = generateInviteCode();

  const invitation: Invitation = {
    tenantId: data.tenantId,
    inviteCode,
    type: data.type,
    branchId: data.branchId,
    maxUses: data.maxUses,
    usedCount: 0,
    expiresAt: data.expiresAt,
    metadata: {
      createdBy: data.createdBy,
      description: data.description,
    },
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await invitations().insertOne(invitation as any);
  return invitation;
}

export async function getInvitationByCode(code: string): Promise<Invitation | null> {
  return invitations().findOne({ inviteCode: code }) as Promise<Invitation | null>;
}

export async function validateInvitation(code: string): Promise<{
  valid: boolean;
  invitation?: Invitation;
  error?: string;
}> {
  const invitation = await getInvitationByCode(code);

  if (!invitation) {
    return { valid: false, error: 'Invalid invitation code' };
  }

  if (!invitation.active) {
    return { valid: false, error: 'Invitation is no longer active' };
  }

  if (invitation.expiresAt && invitation.expiresAt < new Date()) {
    return { valid: false, error: 'Invitation has expired' };
  }

  if (invitation.maxUses && invitation.usedCount >= invitation.maxUses) {
    return { valid: false, error: 'Invitation has reached maximum uses' };
  }

  return { valid: true, invitation };
}

export async function acceptInvitation(
  code: string,
): Promise<{ tenantId: ObjectId; branchId?: ObjectId }> {
  const validation = await validateInvitation(code);

  if (!validation.valid || !validation.invitation) {
    throw new Error(validation.error || 'Invalid invitation');
  }

  const invitation = validation.invitation;

  await invitations().updateOne(
    { _id: invitation._id },
    {
      $inc: { usedCount: 1 },
      $set: { updatedAt: new Date() },
    }
  );

  return {
    tenantId: invitation.tenantId,
    branchId: invitation.branchId,
  };
}

/**
 * Obtiene todas las invitaciones de un tenant
 */
export async function getInvitationsByTenant(tenantId: ObjectId): Promise<Invitation[]> {
  return invitations()
    .find({ tenantId })
    .sort({ createdAt: -1 })
    .toArray() as Promise<Invitation[]>;
}

/**
 * Desactiva una invitación
 */
export async function deactivateInvitation(invitationId: ObjectId): Promise<void> {
  await invitations().updateOne(
    { _id: invitationId },
    {
      $set: {
        active: false,
        updatedAt: new Date(),
      },
    }
  );
}

/**
 * Busca una invitación por ID
 */
export async function getInvitationById(invitationId: ObjectId): Promise<Invitation | null> {
  return invitations().findOne({ _id: invitationId }) as Promise<Invitation | null>;
}

/**
 * Actualiza una invitación
 */
export async function updateInvitation(
  invitationId: ObjectId,
  updates: Partial<Invitation>
): Promise<void> {
  await invitations().updateOne(
    { _id: invitationId },
    {
      $set: {
        ...updates,
        updatedAt: new Date(),
      },
    }
  );
}
