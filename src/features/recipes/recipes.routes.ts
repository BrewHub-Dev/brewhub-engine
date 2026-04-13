import type { FastifyPluginAsync } from "fastify";
import {
  createRecipeSchema,
  consumeInventorySchema,
} from "./recipes.model";
import {
  createRecipe,
  getRecipesByBranch,
  getRecipeById,
  getRecipeByItemId,
  updateRecipe,
  deleteRecipe,
  consumeInventoryForOrder,
  checkInventoryAvailability,
  getRecipesWithLowStock,
} from "./recipes.service";
import { requirePermission } from "../../middleware/permissions.middleware";

function getBranchId(req: any): string | null {
  return (
    req.auth?.scope?.branchId?.toString() ??
    (req.query as any)?.branchId ??
    (req.body as any)?.branchId ??
    null
  );
}

export const recipeRoutes: FastifyPluginAsync = async (app) => {

  app.get(
    "/recipes",
    {
      config: { action: "recipes.list" },
      preHandler: [app.authenticate, requirePermission("items:manage_inventory")],
    },
    async (req, reply) => {
      const branchId = getBranchId(req);
      if (!branchId) return reply.status(400).send({ error: "No branch context" });
      const recipes = await getRecipesByBranch(branchId);
      reply.send(recipes);
    }
  );

  app.post(
    "/recipes",
    {
      config: { action: "recipes.create" },
      preHandler: [app.authenticate, requirePermission("items:manage_inventory")],
    },
    async (req, reply) => {
      const branchId = getBranchId(req);
      if (!branchId) return reply.status(400).send({ error: "No branch context" });
      const parsed = createRecipeSchema.parse(req.body);
      const created = await createRecipe({ ...parsed, branchId });
      reply.status(201).send(created);
    }
  );

  app.get(
    "/recipes/by-item/:itemId",
    {
      config: { action: "recipes.by_item" },
      preHandler: [app.authenticate, requirePermission("items:manage_inventory")],
    },
    async (req, reply) => {
      const { itemId } = req.params as { itemId: string };
      const branchId = getBranchId(req);
      if (!branchId) return reply.status(400).send({ error: "No branch context" });
      const recipe = await getRecipeByItemId(itemId, branchId);
      if (!recipe) return reply.status(404).send({ error: "Recipe not found" });
      reply.send(recipe);
    }
  );

  app.get(
    "/recipes/low-stock",
    {
      config: { action: "recipes.low_stock" },
      preHandler: [app.authenticate, requirePermission("items:manage_inventory")],
    },
    async (req, reply) => {
      const branchId = getBranchId(req);
      if (!branchId) return reply.status(400).send({ error: "No branch context" });
      const recipes = await getRecipesWithLowStock(branchId);
      reply.send(recipes);
    }
  );

  app.get(
    "/recipes/check",
    {
      config: { action: "recipes.check" },
      preHandler: [app.authenticate],
    },
    async (req, reply) => {
      const branchId = getBranchId(req);
      if (!branchId) return reply.status(400).send({ error: "No branch context" });
      const { items } = req.query as unknown as {
        items: { itemId: string; quantity: number }[];
      };
      const result = await checkInventoryAvailability(items, branchId);
      reply.send(result);
    }
  );

  app.get(
    "/recipes/:id",
    {
      config: { action: "recipes.get" },
      preHandler: [app.authenticate, requirePermission("items:manage_inventory")],
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const recipe = await getRecipeById(id);
      if (!recipe) return reply.status(404).send({ error: "Recipe not found" });
      reply.send(recipe);
    }
  );

  app.patch(
    "/recipes/:id",
    {
      config: { action: "recipes.update" },
      preHandler: [app.authenticate, requirePermission("items:manage_inventory")],
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const branchId = getBranchId(req);
      if (!branchId) return reply.status(400).send({ error: "No branch context" });
      const parsed = createRecipeSchema.partial().parse(req.body);
      const updated = await updateRecipe(id, branchId, parsed);
      reply.send(updated);
    }
  );

  app.delete(
    "/recipes/:id",
    {
      config: { action: "recipes.delete" },
      preHandler: [app.authenticate, requirePermission("items:manage_inventory")],
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const branchId = getBranchId(req);
      if (!branchId) return reply.status(400).send({ error: "No branch context" });
      await deleteRecipe(id, branchId);
      reply.status(204).send();
    }
  );

  app.post(
    "/recipes/consume",
    {
      config: { action: "recipes.consume" },
      preHandler: [app.authenticate, requirePermission("items:manage_inventory")],
    },
    async (req, reply) => {
      const branchId = getBranchId(req);
      if (!branchId) return reply.status(400).send({ error: "No branch context" });
      const parsed = consumeInventorySchema.parse(req.body);
      const result = await consumeInventoryForOrder(parsed.items, branchId);
      reply.send(result);
    }
  );
};