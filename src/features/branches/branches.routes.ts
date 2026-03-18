import { FastifyPluginAsync } from "fastify";
import { branchesSchema } from "./branches.model";
import {
  createBranch,
  getBranches,
  getBranchesByShopId,
  getBranchById,
  updateBranch,
  deleteBranch,
} from "./branches.service";
import { requirePermission } from "../../middleware/permissions.middleware";
import { applyScopeMiddleware } from "../../middleware/scope.middleware";

async function collect<T>(gen: AsyncIterable<T>): Promise<T[]> {
  const arr: T[] = [];
  for await (const item of gen) arr.push(item);
  return arr;
}

export const branchesRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    "/branches",
    {
      config: { action: "branches.create" },
      preHandler: [app.authenticate, requirePermission("branches:create")],
    },
    async (req, reply) => {
      try {
        if (!req.auth) {
          return reply.status(401).send({ error: "No auth context" });
        }

        let shopId: string | undefined;

        if (
          req.auth.scope.role === "SHOP_ADMIN" ||
          req.auth.scope.role === "BRANCH_ADMIN"
        ) {
          shopId = req.auth.scope.shopId?.toHexString();
        } else if (req.auth.scope.role === "ADMIN") {
          const header = req.headers["x-shop-id"] as string | undefined;
          if (!header) {
            return reply.status(400).send({
              error: "x-shop-id header is required for ADMIN",
            });
          }
          shopId = header;
        }

        if (!shopId) {
          return reply.status(400).send({ error: "ShopId is required" });
        }

        const parsed = branchesSchema.partial({ ShopId: true }).parse(req.body);
        const toCreate = { ...parsed, ShopId: shopId } as any;

        const branchCreated = await createBranch(toCreate);

        reply.status(200).send(branchCreated);
      } catch (error) {
        reply.status(400).send({ error: (error as Error).message });
        console.error("Error creating branch:", error);
      }
    }
  );

  app.get(
    "/branches",
    {
      config: { action: "branches.list" },
      preHandler: [
        app.authenticate,
        requirePermission("branches:view"),
        applyScopeMiddleware,
      ],
    },
    async (req, reply) => {
      try {
        if (!req.auth) {
          return reply.status(401).send({ error: "No auth context" });
        }

        let branches;

        if (req.auth.scope.role === "ADMIN") {
          const header = req.headers["x-shop-id"] as string | undefined;
          if (!header) {
            branches = await collect(getBranches());
          } else {
            branches = await collect(getBranchesByShopId(header));
          }
        } else if (
          req.auth.scope.role === "SHOP_ADMIN" ||
          req.auth.scope.role === "BRANCH_ADMIN"
        ) {
          const shopId = req.auth.scope.shopId?.toHexString();
          if (!shopId) {
            return reply.status(400).send({ error: "ShopId not found in scope" });
          }
          branches = await collect(getBranchesByShopId(shopId));

          if (req.auth.scope.role === "BRANCH_ADMIN") {
            const branchId = req.auth.scope.branchId.toHexString();
            branches = branches.filter((b) => b._id.toString() === branchId);
          }
        } else if (req.auth.scope.role === "CLIENT") {
          const tenantId = req.headers["x-tenant-id"] as string | undefined;
          if (tenantId) {
            branches = await collect(getBranchesByShopId(tenantId));
          } else {
            branches = await collect(getBranches());
          }
          branches = branches.filter((b) => b.active);
        } else {
          return reply.status(403).send({ error: "Not allowed to view branches" });
        }

        reply.send(branches);
      } catch (error) {
        reply.status(500).send({ error: (error as Error).message });
        console.error("Error fetching branches:", error);
      }
    }
  );

  app.get(
    "/branches/shop/:shopId",
    {
      config: { action: "branches.list_by_shop" },
      preHandler: [app.authenticate, requirePermission("branches:view")],
    },
    async (req, reply) => {
      try {
        const { shopId } = req.params as { shopId: string };

        if (!req.auth) {
          return reply.status(401).send({ error: "No auth context" });
        }

        const branches = await collect(getBranchesByShopId(shopId));

        if (req.auth.scope.role === "CLIENT") {
          const activeBranches = branches.filter((b) => b.active);
          return reply.send(activeBranches);
        }

        if (req.auth.scope.role !== "ADMIN") {
          const userShopId = req.auth.scope.shopId?.toHexString();
          if (shopId !== userShopId) {
            return reply.status(403).send({
              error: "No tienes acceso a las sucursales de esta tienda",
            });
          }
        }

        reply.send(branches);
      } catch (error) {
        reply.status(500).send({ error: (error as Error).message });
        console.error("Error fetching branches by shop:", error);
      }
    }
  );

  app.get(
    "/branches/:id",
    {
      config: { action: "branches.get" },
      preHandler: [
        app.authenticate,
        requirePermission("branches:view"),
        applyScopeMiddleware,
      ],
    },
    async (req, reply) => {
      try {
        const { id } = req.params as { id: string };
        const branch = await getBranchById(id);

        if (!branch) {
          return reply.status(404).send({ error: "Branch not found" });
        }

        if (!req.auth) {
          return reply.status(401).send({ error: "No auth context" });
        }

        if (req.auth.scope.role === "CLIENT") {
          if (!branch.active) {
            return reply.status(404).send({ error: "Branch not found" });
          }
        } else if (req.auth.scope.role !== "ADMIN") {
          const userShopId = req.auth.scope.shopId?.toHexString();
          if (branch.ShopId?.toString() !== userShopId) {
            return reply
              .status(403)
              .send({ error: "No tienes acceso a esta sucursal" });
          }

          if (req.auth.scope.role === "BRANCH_ADMIN") {
            const userBranchId = req.auth.scope.branchId.toHexString();
            if (branch._id.toString() !== userBranchId) {
              return reply
                .status(403)
                .send({ error: "No tienes acceso a esta sucursal" });
            }
          }
        }

        reply.send(branch);
      } catch (error) {
        reply.status(500).send({ error: (error as Error).message });
        console.error("Error fetching branch:", error);
      }
    }
  );

  app.patch(
    "/branches/:id",
    {
      config: { action: "branches.update" },
      preHandler: [
        app.authenticate,
        requirePermission("branches:edit"),
        applyScopeMiddleware,
      ],
    },
    async (req, reply) => {
      try {
        const { id } = req.params as { id: string };

        const existingBranch = await getBranchById(id);
        if (!existingBranch) {
          return reply.status(404).send({ error: "Branch not found" });
        }

        if (!req.auth) {
          return reply.status(401).send({ error: "No auth context" });
        }

        if (req.auth.scope.role !== "ADMIN" && req.auth.scope.role !== "CLIENT") {
          const userShopId = req.auth.scope.shopId?.toHexString();
          if (existingBranch.ShopId?.toString() !== userShopId) {
            return reply
              .status(403)
              .send({ error: "No tienes acceso a esta sucursal" });
          }
        }

        const parsed = branchesSchema.partial().parse(req.body);
        const updated = await updateBranch(id, parsed);

        reply.send(updated);
      } catch (error) {
        reply.status(400).send({ error: (error as Error).message });
        console.error("Error updating branch:", error);
      }
    }
  );

  app.delete(
    "/branches/:id",
    {
      config: { action: "branches.delete" },
      preHandler: [
        app.authenticate,
        requirePermission("branches:delete"),
        applyScopeMiddleware,
      ],
    },
    async (req, reply) => {
      try {
        const { id } = req.params as { id: string };

        const existingBranch = await getBranchById(id);
        if (!existingBranch) {
          return reply.status(404).send({ error: "Branch not found" });
        }

        if (!req.auth) {
          return reply.status(401).send({ error: "No auth context" });
        }

        if (req.auth.scope.role !== "ADMIN" && req.auth.scope.role !== "CLIENT") {
          const userShopId = req.auth.scope.shopId?.toHexString();
          if (existingBranch.ShopId?.toString() !== userShopId) {
            return reply
              .status(403)
              .send({ error: "No tienes acceso a esta sucursal" });
          }
        }

        await deleteBranch(id);
        reply.status(204).send();
      } catch (error) {
        reply.status(500).send({ error: (error as Error).message });
        console.error("Error deleting branch:", error);
      }
    }
  );
};
