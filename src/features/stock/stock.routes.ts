import type { FastifyPluginAsync } from "fastify";
import { stockItemSchema } from "./stock.model";
import {
  createStockItem,
  getStockItemsByShop,
  getStockItemById,
  updateStockItem,
  adjustStockQuantity,
  deleteStockItem,
  getLowStockItems,
} from "./stock.service";
import { requirePermission } from "../../middleware/permissions.middleware";
import { parsePagination } from "@/utils/pagination";

function getShopId(req: any): string | null {
  return req.auth?.scope.shopId?.toHexString() ?? null;
}

export const stockRoutes: FastifyPluginAsync = async (app) => {

  app.get(
    "/stock/low",
    {
      config: { action: "stock.low" },
      preHandler: [app.authenticate, requirePermission("items:manage_inventory")],
    },
    async (req, reply) => {
      try {
        const shopId = getShopId(req);
        if (!shopId) return reply.status(400).send({ error: "No shop context" });
        const items = await getLowStockItems(shopId);
        reply.send(items);
      } catch (error) {
        reply.status(500).send({ error: (error as Error).message });
      }
    }
  );

  app.get(
    "/stock",
    {
      config: { action: "stock.list" },
      preHandler: [app.authenticate, requirePermission("items:manage_inventory")],
    },
    async (req, reply) => {
      try {
        const shopId = getShopId(req);
        if (!shopId) return reply.status(400).send({ error: "No shop context" });
        const qs = req.query as Record<string, string>;
        const pagination = parsePagination(qs);
        const data = await getStockItemsByShop(shopId, pagination);
        reply.send(data);
      } catch (error) {
        reply.status(500).send({ error: (error as Error).message });
      }
    }
  );

  app.post(
    "/stock",
    {
      config: { action: "stock.create" },
      preHandler: [app.authenticate, requirePermission("items:manage_inventory")],
    },
    async (req, reply) => {
      try {
        const shopId = getShopId(req);
        if (!shopId) return reply.status(400).send({ error: "No shop context" });
        const parsed = stockItemSchema.omit({ shopId: true }).parse(req.body);
        const created = await createStockItem({ ...parsed, shopId });
        reply.status(201).send(created);
      } catch (error) {
        reply.status(400).send({ error: (error as Error).message });
      }
    }
  );

  app.patch(
    "/stock/:id/adjust",
    {
      config: { action: "stock.adjust" },
      preHandler: [app.authenticate, requirePermission("items:manage_inventory")],
    },
    async (req, reply) => {
      try {
        const { id } = req.params as { id: string };
        const shopId = getShopId(req);
        if (!shopId) return reply.status(400).send({ error: "No shop context" });
        const { delta } = req.body as { delta: number };
        if (typeof delta !== "number") {
          return reply.status(400).send({ error: "delta must be a number" });
        }
        const updated = await adjustStockQuantity(id, shopId, delta);
        reply.send(updated);
      } catch (error) {
        reply.status(400).send({ error: (error as Error).message });
      }
    }
  );

  app.get(
    "/stock/:id",
    {
      config: { action: "stock.get" },
      preHandler: [app.authenticate, requirePermission("items:manage_inventory")],
    },
    async (req, reply) => {
      try {
        const { id } = req.params as { id: string };
        const shopId = getShopId(req);
        const item = await getStockItemById(id);
        if (!item || item.shopId !== shopId) {
          return reply.status(404).send({ error: "Stock item not found" });
        }
        reply.send(item);
      } catch (error) {
        reply.status(500).send({ error: (error as Error).message });
      }
    }
  );

  app.patch(
    "/stock/:id",
    {
      config: { action: "stock.update" },
      preHandler: [app.authenticate, requirePermission("items:manage_inventory")],
    },
    async (req, reply) => {
      try {
        const { id } = req.params as { id: string };
        const shopId = getShopId(req);
        if (!shopId) return reply.status(400).send({ error: "No shop context" });
        const parsed = stockItemSchema.partial().parse(req.body);
        const updated = await updateStockItem(id, shopId, parsed);
        reply.send(updated);
      } catch (error) {
        reply.status(400).send({ error: (error as Error).message });
      }
    }
  );

  app.delete(
    "/stock/:id",
    {
      config: { action: "stock.delete" },
      preHandler: [app.authenticate, requirePermission("items:manage_inventory")],
    },
    async (req, reply) => {
      try {
        const { id } = req.params as { id: string };
        const shopId = getShopId(req);
        if (!shopId) return reply.status(400).send({ error: "No shop context" });
        await deleteStockItem(id, shopId);
        reply.status(204).send();
      } catch (error) {
        reply.status(500).send({ error: (error as Error).message });
      }
    }
  );
};
