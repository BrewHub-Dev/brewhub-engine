import { FastifyPluginAsync } from "fastify";
import { createCategory, getCategoriesByShopId } from "./categories.service";
import { categoriesSchema } from "./categories.model";
import { ObjectId } from "mongodb";
import { requirePermission } from "../../middleware/permissions.middleware";
import { applyScopeMiddleware } from "../../middleware/scope.middleware";

export const categoriesRoutes: FastifyPluginAsync = async (app) => {
  /**
   * POST /categories - Crear categoría
   * Permisos: categories:create
   * Scope: Se crea en la ShopId del usuario
   */
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

        // Determinar ShopId según el rol
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

        // Validar datos
        const parsed = categoriesSchema.partial({ ShopId: true }).parse(req.body);
        const toCreate = { ...parsed, ShopId: shopId.toHexString() } as any;

        // Crear categoría
        const categoryCreated = await createCategory(toCreate);

        console.log("[Categories] Category created:", categoryCreated._id);
        reply.status(201).send(categoryCreated);
      } catch (error) {
        reply.status(400).send({ error: (error as Error).message });
        console.error("Error creating category:", error);
      }
    }
  );

  /**
   * GET /categories - Listar categorías
   * Permisos: categories:view
   * Scope: Filtra por ShopId según el rol
   */
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

        // Determinar ShopId según el rol
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
};
