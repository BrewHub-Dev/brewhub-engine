import { FastifyPluginAsync } from "fastify";
import { ObjectId } from "mongodb";
import { shopSchema } from "./shop.model";
import { createShop, getShops, getShopById, updateShop, deleteShop } from "./shop.service";
import { requirePermission } from "../../middleware/permissions.middleware";
import { applyScopeMiddleware } from "../../middleware/scope.middleware";

export const shopRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    "/shops",
    {
      config: { action: "shops.create" },
      preHandler: [app.authenticate, requirePermission("shops:create")],
    },
    async (req, reply) => {
      try {
        const shopData = shopSchema.parse(req.body);
        const shopCreated = await createShop(shopData);
        console.log("[Shops] Shop created:", shopCreated._id);
        reply.status(201).send(shopCreated);
      } catch (error) {
        reply.status(400).send({ error: (error as Error).message });
        console.error("Error creating shop:", error);
      }
    }
  );

  app.get(
    "/shops",
    {
      config: { action: "shops.list" },
      preHandler: [
        app.authenticate,
        requirePermission("shops:view"),
        applyScopeMiddleware,
      ],
    },
    async (req, reply) => {
      try {
        if (!req.auth) {
          return reply.status(401).send({ error: "No auth context" });
        }

        const shops = await getShops();

        if (req.auth.scope.role !== "ADMIN") {
          const userShopId =
            req.auth.scope.role !== "CLIENT"
              ? req.auth.scope.shopId?.toHexString()
              : undefined;
          const filtered = shops.filter(
            (shop) => shop._id.toString() === userShopId
          );
          return reply.send(filtered);
        }

        reply.send(shops);
      } catch (error) {
        reply.status(500).send({ error: (error as Error).message });
        console.error("Error fetching shops:", error);
      }
    }
  );

  app.get(
    "/shops/:id",
    {
      config: { action: "shops.get" },
      preHandler: [
        app.authenticate,
        requirePermission("shops:view"),
        applyScopeMiddleware,
      ],
    },
    async (req, reply) => {
      try {
        const { id } = req.params as { id: string };
        const shop = await getShopById(id);
        if (!shop) {
          return reply.status(404).send({ error: "Shop not found" });
        }

        if (!req.auth) {
          return reply.status(401).send({ error: "No auth context" });
        }

        if (req.auth.scope.role !== "ADMIN") {
          const userShopId =
            req.auth.scope.role !== "CLIENT"
              ? req.auth.scope.shopId?.toHexString()
              : undefined;
          if (shop._id.toString() !== userShopId) {
            return reply.status(403).send({ error: "No tienes acceso a esta tienda" });
          }
        }

        reply.send(shop);
      } catch (error) {
        reply.status(500).send({ error: (error as Error).message });
        console.error("Error fetching shop by ID:", error);
      }
    }
  );

  app.patch(
    "/shops/:id",
    {
      config: { action: "shops.update" },
      preHandler: [
        app.authenticate,
        requirePermission("shops:edit"),
        applyScopeMiddleware,
      ],
    },
    async (req, reply) => {
      try {
        const { id } = req.params as { id: string };

        const existingShop = await getShopById(id);
        if (!existingShop) {
          return reply.status(404).send({ error: "Shop not found" });
        }

        if (!req.auth) {
          return reply.status(401).send({ error: "No auth context" });
        }

        if (req.auth.scope.role !== "ADMIN") {
          const userShopId =
            req.auth.scope.role !== "CLIENT"
              ? req.auth.scope.shopId?.toHexString()
              : undefined;
          if (existingShop._id.toString() !== userShopId) {
            return reply.status(403).send({ error: "No tienes acceso a esta tienda" });
          }
        }

        const parsed = shopSchema.partial().parse(req.body);
        const updated = await updateShop(id, parsed);

        console.log("[Shops] Shop updated:", id);
        reply.send(updated);
      } catch (error) {
        reply.status(400).send({ error: (error as Error).message });
        console.error("Error updating shop:", error);
      }
    }
  );

  app.delete(
    "/shops/:id",
    {
      config: { action: "shops.delete" },
      preHandler: [app.authenticate, requirePermission("shops:delete")],
    },
    async (req, reply) => {
      try {
        const { id } = req.params as { id: string };

        const existingShop = await getShopById(id);
        if (!existingShop) {
          return reply.status(404).send({ error: "Shop not found" });
        }

        await deleteShop(id);

        console.log("[Shops] Shop deleted:", id);
        reply.status(204).send();
      } catch (error) {
        reply.status(500).send({ error: (error as Error).message });
        console.error("Error deleting shop:", error);
      }
    }
  );
};
