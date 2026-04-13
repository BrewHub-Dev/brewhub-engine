import type { FastifyPluginAsync } from "fastify";
import {
  createPromoCodeSchema,
  applyPromoCodeSchema,
} from "./promocodes.model";
import {
  createPromoCode,
  getPromoCodesByShop,
  getPromoCodeById,
  updatePromoCode,
  deletePromoCode,
  applyPromoCodeUsage,
  calculateDiscount,
  getPromoCodeByCode,
} from "./promocodes.service";
import { requirePermission } from "../../middleware/permissions.middleware";

function getShopId(req: any): string | null {
  return (
    req.auth?.scope?.shopId?.toString() ??
    (req.query as any)?.shopId ??
    (req.body as any)?.shopId ??
    null
  );
}

function getBranchId(req: any): string | null {
  return (
    req.auth?.scope?.branchId?.toString() ??
    (req.query as any)?.branchId ??
    (req.body as any)?.branchId ??
    null
  );
}

export const promoRoutes: FastifyPluginAsync = async (app) => {

  app.get(
    "/promocodes",
    {
      config: { action: "promocodes.list" },
      preHandler: [app.authenticate, requirePermission("promocodes:manage")],
    },
    async (req, reply) => {
      const shopId = getShopId(req);
      if (!shopId) return reply.status(400).send({ error: "No shop context" });
      const branchId = getBranchId(req);
      if (!branchId) return reply.status(400).send({ error: "No branch context" });
      const promos = await getPromoCodesByShop(shopId, branchId);
      reply.send(promos);
    }
  );

  app.post(
    "/promocodes",
    {
      config: { action: "promocodes.create" },
      preHandler: [app.authenticate, requirePermission("promocodes:manage")],
    },
    async (req, reply) => {
      const shopId = getShopId(req);
      if (!shopId) return reply.status(400).send({ error: "No shop context" });
      const parsed = createPromoCodeSchema.parse(req.body);
      const created = await createPromoCode({ ...parsed, shopId });
      reply.status(201).send(created);
    }
  );

  app.get(
    "/promocodes/validate/:code",
    {
      config: { action: "promocodes.validate" },
      preHandler: [app.authenticate],
    },
    async (req, reply) => {
      const { code } = req.params as { code: string };
      const shopId = getShopId(req);
      if (!shopId) return reply.status(400).send({ error: "No shop context" });
      const branchId = getBranchId(req);
      if (!branchId) return reply.status(400).send({ error: "No branch context" });
      const promo = await getPromoCodeByCode(code, shopId, branchId);
      if (!promo) {
        return reply.status(404).send({ valid: false, message: "Código no válido" });
      }
      if (!promo.isActive) {
        return reply.status(400).send({ valid: false, message: "El código no está activo" });
      }
      reply.send({ valid: true, promo });
    }
  );

  app.get(
    "/promocodes/:id",
    {
      config: { action: "promocodes.get" },
      preHandler: [app.authenticate, requirePermission("promocodes:manage")],
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const promo = await getPromoCodeById(id);
      if (!promo) return reply.status(404).send({ error: "Promo code not found" });
      reply.send(promo);
    }
  );

  app.patch(
    "/promocodes/:id",
    {
      config: { action: "promocodes.update" },
      preHandler: [app.authenticate, requirePermission("promocodes:manage")],
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const shopId = getShopId(req);
      if (!shopId) return reply.status(400).send({ error: "No shop context" });
      const parsed = createPromoCodeSchema.partial().parse(req.body);
      const updated = await updatePromoCode(id, shopId, parsed);
      reply.send(updated);
    }
  );

  app.delete(
    "/promocodes/:id",
    {
      config: { action: "promocodes.delete" },
      preHandler: [app.authenticate, requirePermission("promocodes:manage")],
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const shopId = getShopId(req);
      if (!shopId) return reply.status(400).send({ error: "No shop context" });
      await deletePromoCode(id, shopId);
      reply.status(204).send();
    }
  );

  app.post(
    "/promocodes/apply",
    {
      config: { action: "promocodes.apply" },
      preHandler: [app.authenticate],
    },
    async (req, reply) => {
      const shopId = getShopId(req);
      if (!shopId) return reply.status(400).send({ error: "No shop context" });
      const branchId = getBranchId(req);
      if (!branchId) return reply.status(400).send({ error: "No branch context" });
      const parsed = applyPromoCodeSchema.parse(req.body);
      const { code, subtotal, items } = parsed;

      const promo = await getPromoCodeByCode(code, shopId, branchId);
      if (!promo) {
        return reply.status(404).send({ valid: false, message: "Código no válido" });
      }

      const result = await calculateDiscount(promo as any, subtotal, items ?? []);
      if (result.valid) {
        await applyPromoCodeUsage(promo._id.toString());
      }
      reply.send(result);
    }
  );
};
