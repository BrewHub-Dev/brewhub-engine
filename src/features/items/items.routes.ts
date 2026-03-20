import type { FastifyPluginAsync } from "fastify";
import { ObjectId } from "mongodb";
import { createItem, getItemsByShopIdPaginated, updateItem, deleteItem, getItemById } from "./items.service";
import { Items, itemsSchema } from "./items.model";
import { requirePermission } from "../../middleware/permissions.middleware";
import { applyScopeMiddleware } from "../../middleware/scope.middleware";
import { parsePagination } from "@/utils/pagination";

export const itemsRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/items",
    {
      config: { action: "items.list" },
      preHandler: [
        app.authenticate,
        requirePermission("items:view"),
        applyScopeMiddleware,
      ],
    },
    async (req, reply) => {
      try {
        const query = req.scopedQuery?.() || {};

        const qs = req.query as Record<string, string>;
        const pagination = parsePagination(qs);

        if (query.ShopId) {
          const shopId = new ObjectId(query.ShopId);
          const result = await getItemsByShopIdPaginated(shopId, pagination);
          return reply.send(result);
        }

        if (req.auth?.scope.role === "ADMIN") {
          const header = req.headers["x-shop-id"] as string | undefined;
          if (!header) {
            return reply.status(400).send({
              error: "x-shop-id header is required for ADMIN",
            });
          }
          const result = await getItemsByShopIdPaginated(new ObjectId(header), pagination);
          return reply.send(result);
        }

        reply.send([]);
      } catch (error) {
        reply.status(500).send({ error: (error as Error).message });
        console.error("Error fetching items:", error);
      }
    }
  );

  app.get(
    "/items/shop/:shopId",
    {
      config: { action: "items.list_by_shop" },
      preHandler: [app.authenticate, requirePermission("items:view")],
    },
    async (req, reply) => {
      try {
        const { shopId } = req.params as { shopId: string };

        if (!req.auth) {
          return reply.status(401).send({ error: "No auth context" });
        }

        const role = req.auth.scope.role;
        if (role !== "ADMIN" && role !== "CLIENT") {
          const userShopId = req.auth.scope.shopId?.toHexString();
          if (shopId !== userShopId) {
            return reply.status(403).send({
              error: "No tienes acceso a los items de esta tienda",
            });
          }
        }

        const qs = req.query as Record<string, string>;
        const pagination = parsePagination(qs);
        const result = await getItemsByShopIdPaginated(new ObjectId(shopId), pagination);

        if (req.auth.scope.role === "CLIENT") {
          return reply.send({
            ...result,
            data: result.data.filter((item) => (item as { active?: boolean }).active),
          });
        }

        reply.send(result);
      } catch (error) {
        reply.status(500).send({ error: (error as Error).message });
        console.error("Error fetching items by shop:", error);
      }
    }
  );

  app.post(
    "/items",
    {
      config: { action: "items.create" },
      preHandler: [app.authenticate, requirePermission("items:create")],
    },
    async (req, reply) => {
      try {
        if (!req.auth) {
          return reply.status(401).send({ error: "No auth context" });
        }

        let shopId: ObjectId | undefined;

        if (
          req.auth.scope.role === "SHOP_ADMIN" ||
          req.auth.scope.role === "BRANCH_ADMIN"
        ) {
          shopId = req.auth.scope.shopId;
        } else if (req.auth.scope.role === "ADMIN") {
          const header = req.headers["x-shop-id"] as string | undefined;
          if (!header) {
            return reply.status(400).send({
              error: "x-shop-id header is required for ADMIN",
            });
          }
          shopId = new ObjectId(header);
        }

        if (!shopId) {
          return reply.status(400).send({ error: "ShopId is required" });
        }

        const parsed = itemsSchema.partial({ ShopId: true }).parse(req.body);

        if (!parsed.categoryId) {
          return reply.status(400).send({ error: "categoryId is required" });
        }

        const toCreate = { ...parsed, ShopId: shopId.toHexString() } as any;
        const created = await createItem(toCreate);

        console.log("[Items] Item creado:", created._id);
        reply.status(200).send(created);
      } catch (error) {
        reply.status(400).send({ error: (error as Error).message });
        console.error("Error creating item:", error);
      }
    }
  );

  app.get(
    "/items/:id",
    {
      config: { action: "items.get" },
      preHandler: [
        app.authenticate,
        requirePermission("items:view"),
        applyScopeMiddleware,
      ],
    },
    async (req, reply) => {
      try {
        const { id } = req.params as { id: string };
        const item = await getItemById(new ObjectId(id));

        if (!item) {
          return reply.status(404).send({ error: "Item no encontrado" });
        }

        const query = req.scopedQuery?.({ _id: item._id }) || {};
        if (query.ShopId && item.ShopId !== query.ShopId) {
          return reply.status(403).send({
            error: "No tienes acceso a este item",
          });
        }

        reply.send(item);
      } catch (error) {
        reply.status(500).send({ error: (error as Error).message });
        console.error("Error fetching item:", error);
      }
    }
  );

  app.patch(
    "/items/:id",
    {
      config: { action: "items.update" },
      preHandler: [
        app.authenticate,
        requirePermission("items:edit"),
        applyScopeMiddleware,
      ],
    },
    async (req, reply) => {
      try {
        const { id } = req.params as { id: string };

        const existingItem = await getItemById(new ObjectId(id));
        if (!existingItem) {
          return reply.status(404).send({ error: "Item no encontrado" });
        }

        const query = req.scopedQuery?.({}) || {};
        if (query.ShopId && existingItem.ShopId !== query.ShopId) {
          return reply.status(403).send({
            error: "No tienes acceso a este item",
          });
        }

        const parsed = itemsSchema.partial().parse(req.body);
        const updated = await updateItem(new ObjectId(id), parsed);
        reply.send(updated);
      } catch (error) {
        reply.status(400).send({ error: (error as Error).message });
        console.error("Error updating item:", error);
      }
    }
  );

  app.delete(
    "/items/:id",
    {
      config: { action: "items.delete" },
      preHandler: [
        app.authenticate,
        requirePermission("items:delete"),
        applyScopeMiddleware,
      ],
    },
    async (req, reply) => {
      try {
        const { id } = req.params as { id: string };

        const existingItem = await getItemById(new ObjectId(id));
        if (!existingItem) {
          return reply.status(404).send({ error: "Item no encontrado" });
        }

        const query = req.scopedQuery?.({}) || {};
        if (query.ShopId && existingItem.ShopId !== query.ShopId) {
          return reply.status(403).send({
            error: "No tienes acceso a este item",
          });
        }

        await deleteItem(new ObjectId(id));
        reply.status(204).send();
      } catch (error) {
        reply.status(500).send({ error: (error as Error).message });
        console.error("Error deleting item:", error);
      }
    }
  );
};
