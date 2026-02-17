import { FastifyPluginAsync } from "fastify";
import { createCategory, getCategoriesByShopId, updateCategory } from "./categories.service";
import { categoriesSchema } from "./categories.model";
import { ObjectId } from "mongodb";
import { requirePermission } from "@/middleware/permissions.middleware";
import { applyScopeMiddleware } from "@/middleware/scope.middleware";

export const categoriesRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    "/categories",
    {
      config: { action: "categories.create" },
      preHandler: [app.authenticate, requirePermission("categories:create")],
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

        const parsed = categoriesSchema.partial({ ShopId: true }).parse(req.body);
        const toCreate = { ...parsed, ShopId: shopId.toHexString() } as any;

        const categoryCreated = await createCategory(toCreate);

        console.log("[Categories] Category created:", categoryCreated._id);
        reply.status(201).send(categoryCreated);
      } catch (error) {
        reply.status(400).send({ error: (error as Error).message });
        console.error("Error creating category:", error);
      }
    }
  );

  app.get(
    "/categories",
    {
      config: { action: "categories.list" },
      preHandler: [
        app.authenticate,
        requirePermission("categories:view"),
        applyScopeMiddleware,
      ],
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

        console.log("[Categories] GET /categories", {
          role: req.auth.scope.role,
          shopId: shopId.toHexString(),
        });

        const categories = await getCategoriesByShopId(shopId);
        reply.send(categories);
      } catch (error) {
        reply.status(500).send({ error: (error as Error).message });
        console.error("Error fetching categories:", error);
      }
    }
  )

  app.put(
    "/categories/:id",
    {
      config: { action: "categories.update" },
      preHandler: [app.authenticate, requirePermission("categories:edit")],
    },
    async (req, reply) => {
      try {
        if (!req.auth) {
          return reply.status(401).send({ error: "No auth context" });
        }

        const { id } = req.params as { id: string };
        const parsed = categoriesSchema.partial().parse(req.body);
        const categoryUpdated = await updateCategory(new ObjectId(id), parsed);
        reply.send(categoryUpdated);
      } catch (error) {
        reply.status(400).send({ error: (error as Error).message });
        console.error("Error updating category:", error);
      }
    }
  );
};
