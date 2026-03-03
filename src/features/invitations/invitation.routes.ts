import { FastifyPluginAsync } from "fastify";
import { ObjectId } from "mongodb";
import {
  createInvitation,
  getInvitationsByTenant,
  validateInvitation,
  acceptInvitation,
  deactivateInvitation,
} from "./invitation.service";
import { getShopById } from "../shops/shop.service";
import { updateUserTenants } from "../users/user.service"

export const invitationRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    "/invitations",
    {
      preHandler: app.authenticate,
      config: { action: "invitations.create" },
    },
    async (req, reply) => {
      try {
        const auth = req.auth;
        if (!auth || auth.scope.role === 'CLIENT') {
          return reply.status(403).send({ error: 'Forbidden' });
        }

        const { type, branchId, maxUses, expiresAt, description } = req.body as {
          type: 'qr' | 'link';
          branchId?: string;
          maxUses?: number;
          expiresAt?: string;
          description?: string;
        };

        const tenantId = auth.identity.tenantId || ('shopId' in auth.scope ? auth.scope.shopId : undefined);

        if (!tenantId) {
          return reply.status(400).send({ error: 'Missing tenant context' });
        }

        const invitation = await createInvitation({
          tenantId,
          createdBy: auth.identity.userId,
          type,
          branchId: branchId ? new ObjectId(branchId) : undefined,
          maxUses,
          expiresAt: expiresAt ? new Date(expiresAt) : undefined,
          description,
        });

        reply.send({ ok: true, invitation });
      } catch (e) {
        reply.status(500).send({ error: (e as Error).message });
      }
    }
  );

  app.get(
    "/invitations",
    {
      preHandler: app.authenticate,
      config: { action: "invitations.list" },
    },
    async (req, reply) => {
      try {
        const auth = req.auth;
        if (!auth || auth.scope.role === 'CLIENT') {
          return reply.status(403).send({ error: 'Forbidden' });
        }

        const tenantId = auth.identity.tenantId || ('shopId' in auth.scope ? auth.scope.shopId : undefined);

        if (!tenantId) {
          return reply.status(400).send({ error: 'Missing tenant context' });
        }

        const invitations = await getInvitationsByTenant(tenantId);
        reply.send(invitations);
      } catch (e) {
        reply.status(500).send({ error: (e as Error).message });
      }
    }
  );

  app.post("/invitations/validate", async (req, reply) => {
    try {
      const { inviteCode } = req.body as { inviteCode: string };

      if (!inviteCode) {
        return reply.status(400).send({ error: 'Missing inviteCode' });
      }

      const validation = await validateInvitation(inviteCode);

      if (!validation.valid) {
        return reply.status(400).send({ error: validation.error });
      }

      const shop = await getShopById(validation.invitation.tenantId.toString());

      if (!shop) {
        return reply.status(404).send({ error: 'Shop not found' });
      }

      reply.send({
        ok: true,
        tenant: {
          tenantId: shop._id,
          name: shop.name,
          logo: shop.image,
          branchId: validation.invitation.branchId,
        },
      });
    } catch (e) {
      reply.status(500).send({ error: (e as Error).message });
    }
  });


  app.post(
    "/invitations/accept",
    {
      preHandler: app.authenticate,
      config: { action: "invitations.accept" },
    },
    async (req, reply) => {
      try {
        const auth = req.auth;
        if (!auth) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }

        const { inviteCode } = req.body as { inviteCode: string };

        if (!inviteCode) {
          return reply.status(400).send({ error: 'Missing inviteCode' });
        }

        const result = await acceptInvitation(inviteCode);

        await updateUserTenants(auth.identity.userId, {
          tenantId: result.tenantId,
          role: 'CLIENT',
          branchId: result.branchId,
        });

        reply.send({
          ok: true,
          tenantId: result.tenantId,
          branchId: result.branchId,
        });
      } catch (e) {
        reply.status(500).send({ error: (e as Error).message });
      }
    }
  );

  app.delete(
    "/invitations/:id",
    {
      preHandler: app.authenticate,
      config: { action: "invitations.delete" },
    },
    async (req, reply) => {
      try {
        const auth = req.auth;
        if (!auth || auth.scope.role === 'CLIENT') {
          return reply.status(403).send({ error: 'Forbidden' });
        }

        const { id } = req.params as { id: string };

        await deactivateInvitation(new ObjectId(id));

        reply.send({ ok: true });
      } catch (e) {
        reply.status(500).send({ error: (e as Error).message });
      }
    }
  );
};
