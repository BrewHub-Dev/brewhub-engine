import type { FastifyPluginAsync } from "fastify";
import { ObjectId } from "mongodb";
import { requirePermission } from "../../middleware/permissions.middleware";
import { applyScopeMiddleware } from "../../middleware/scope.middleware";
import { parsePagination } from "@/utils/pagination";
import {
  createAppOrderSchema,
  createPosOrderSchema,
} from "./orders.model";
import {
  createAppOrder,
  createPosOrder,
  getOrderById,
  getOrdersWithDetailsPaginated,
  getOrderByQRToken,
  getOrderByQRTokenHash,
  updateOrderStatus,
  markOrderAsPaid,
  refundOrder,
  applyDiscount,
  ensureOrderIndexes,
  getOrdersByShopIdPaginated,
  getActiveOrdersByUserIdPaginated,
  getOrderCountsForDashboard,
  getDashboardStats,
  getAdminDashboardStats,
} from "./orders.service";

export const ordersRoutes: FastifyPluginAsync = async (app) => {
  ensureOrderIndexes().catch((err) =>
    console.error("[Orders] Failed to create indexes:", err)
  );


  app.get(
    "/orders/dashboard-stats",
    {
      config: { action: "orders.dashboard_stats" },
      preHandler: [app.authenticate, requirePermission("orders:view"), applyScopeMiddleware],
    },
    async (req, reply) => {
      try {
        if (!req.auth) return reply.status(401).send({ error: "No auth context" });

        const role = req.auth.scope.role;
        const filter: { ShopId?: ObjectId; BranchId?: ObjectId } = {};

        if (role === "BRANCH_ADMIN") {
          filter.ShopId = req.auth.scope.shopId;
          filter.BranchId = req.auth.scope.branchId;
        } else if (role === "SHOP_ADMIN") {
          filter.ShopId = req.auth.scope.shopId;
          const branchHeader = req.headers["x-branch-id"] as string | undefined;
          if (branchHeader) filter.BranchId = new ObjectId(branchHeader);
        } else if (role === "ADMIN") {
          const shopHeader = req.headers["x-shop-id"] as string | undefined;
          if (!shopHeader) return reply.status(400).send({ error: "x-shop-id header required for ADMIN" });
          filter.ShopId = new ObjectId(shopHeader);
          const branchHeader = req.headers["x-branch-id"] as string | undefined;
          if (branchHeader) filter.BranchId = new ObjectId(branchHeader);
        } else {
          return reply.status(403).send({ error: "Not allowed" });
        }

        const stats = await getDashboardStats(filter);
        reply.send(stats);
      } catch (error) {
        reply.status(500).send({ error: (error as Error).message });
        console.error("Error fetching dashboard stats:", error);
      }
    }
  );

  app.get(
    "/admin/dashboard-stats",
    {
      config: { action: "admin.dashboard_stats" },
      preHandler: [app.authenticate, requirePermission("shops:view")],
    },
    async (req, reply) => {
      try {
        if (!req.auth) return reply.status(401).send({ error: "No auth context" });
        if (req.auth.scope.role !== "ADMIN") {
          return reply.status(403).send({ error: "Solo ADMIN puede acceder a estas estadísticas" });
        }
        const [adminStats, dashboardStats] = await Promise.all([
          getAdminDashboardStats(),
          getDashboardStats({}), // empty filter = all orders across all shops
        ]);
        reply.send({ ...adminStats, ...dashboardStats });
      } catch (error) {
        reply.status(500).send({ error: (error as Error).message });
        console.error("Error fetching admin dashboard stats:", error);
      }
    }
  );

  app.post(
    "/orders/app",
    {
      config: { action: "orders.create.app" },
      preHandler: [app.authenticate, requirePermission("orders:create")],
    },
    async (req, reply) => {
      try {
        if (!req.auth) {
          return reply.status(401).send({ error: "No auth context" });
        }

        if (req.auth.scope.role !== "CLIENT") {
          return reply.status(403).send({
            error: "Solo clientes pueden crear órdenes desde la app",
          });
        }

        const parsed = createAppOrderSchema.parse(req.body);
        const customerId = req.auth.identity.userId.toHexString();

        const order = await createAppOrder(parsed, customerId);

        req.log.info({ orderNumber: order.orderNumber }, "[Orders] App order created");
        reply.status(200).send(order);
      } catch (error) {
        reply.status(400).send({ error: (error as Error).message });
        req.log.error({ err: error }, "Error creating app order");
      }
    }
  );

  app.post(
    "/orders/pos",
    {
      config: { action: "orders.create.pos" },
      preHandler: [
        app.authenticate,
        requirePermission("orders:create"),
        requirePermission("pos:use"),
      ],
    },
    async (req, reply) => {
      try {
        if (!req.auth) {
          return reply.status(401).send({ error: "No auth context" });
        }

        const parsed = createPosOrderSchema.parse(req.body);
        const staffId = req.auth.identity.userId.toHexString();
        const staffRole = req.auth.scope.role;

        if (staffRole === "BRANCH_ADMIN") {
          const branchId = req.auth.scope.branchId.toHexString();
          if (parsed.BranchId !== branchId) {
            return reply.status(403).send({
              error: "Solo puedes crear órdenes en tu sucursal",
            });
          }
        }

        const order = await createPosOrder(parsed, staffId, staffRole);

        req.log.info({ orderNumber: order.orderNumber }, "[Orders] POS order created");
        reply.status(200).send(order);
      } catch (error) {
        reply.status(400).send({ error: (error as Error).message });
        req.log.error({ err: error }, "Error creating POS order");
      }
    }
  );

  app.get(
    "/orders",
    {
      config: { action: "orders.list" },
      preHandler: [
        app.authenticate,
        requirePermission("orders:view"),
        applyScopeMiddleware,
      ],
    },
    async (req, reply) => {
      try {
        if (!req.auth) {
          return reply.status(401).send({ error: "No auth context" });
        }

        let filter: Record<string, any> = {};

        const role = req.auth.scope.role;

        if (role === "CLIENT") {
          filter.customerId = req.auth.identity.userId;
        } else if (role === "BRANCH_ADMIN") {
          filter.ShopId = req.auth.scope.shopId;
          filter.BranchId = req.auth.scope.branchId;
        } else if (role === "SHOP_ADMIN") {
          filter.ShopId = req.auth.scope.shopId;
          const branchHeader = req.headers["x-branch-id"] as string | undefined;
          if (branchHeader) {
            filter.BranchId = new ObjectId(branchHeader);
          }
        } else if (role === "ADMIN") {
          const shopHeader = req.headers["x-shop-id"] as string | undefined;
          if (!shopHeader) {
            return reply.status(400).send({
              error: "x-shop-id header is required for ADMIN",
            });
          }
          filter.ShopId = new ObjectId(shopHeader);
          const branchHeader = req.headers["x-branch-id"] as string | undefined;
          if (branchHeader) {
            filter.BranchId = new ObjectId(branchHeader);
          }
        }

        const qs = req.query as Record<string, string>;
        if (qs.status) filter.status = qs.status;
        if (qs.paymentStatus) filter.paymentStatus = qs.paymentStatus;

        const pagination = parsePagination(qs);
        const result = await getOrdersWithDetailsPaginated(filter, pagination);
        reply.send(result);
      } catch (error) {
        reply.status(500).send({ error: (error as Error).message });
        console.error("Error listing orders:", error);
      }
    }
  );

  app.get(
    "/orders/:id",
    {
      config: { action: "orders.get" },
      preHandler: [
        app.authenticate,
        requirePermission("orders:view"),
        applyScopeMiddleware,
      ],
    },
    async (req, reply) => {
      try {
        if (!req.auth) {
          return reply.status(401).send({ error: "No auth context" });
        }

        const { id } = req.params as { id: string };
        const order = await getOrderById(new ObjectId(id));
        if (!order) {
          return reply.status(404).send({ error: "Orden no encontrada" });
        }

        const role = req.auth.scope.role;
        if (role === "CLIENT") {
          if (
            order.customerId?.toString() !==
            req.auth.identity.userId.toHexString()
          ) {
            return reply.status(403).send({ error: "No tienes acceso a esta orden" });
          }
        } else if (role === "BRANCH_ADMIN") {
          if (
            order.BranchId.toString() !==
            req.auth.scope.branchId.toHexString()
          ) {
            return reply.status(403).send({ error: "No tienes acceso a esta orden" });
          }
        } else if (role === "SHOP_ADMIN") {
          if (
            order.ShopId.toString() !== req.auth.scope.shopId.toHexString()
          ) {
            return reply.status(403).send({ error: "No tienes acceso a esta orden" });
          }
        }

        reply.send(order);
      } catch (error) {
        reply.status(500).send({ error: (error as Error).message });
        console.error("Error fetching order:", error);
      }
    }
  );

  app.post(
    "/orders/verify-qr",
    {
      config: { action: "orders.verify-qr" },
      preHandler: [app.authenticate, requirePermission("pos:use")],
    },
    async (req, reply) => {
      try {
        const { qrToken } = req.body as { qrToken: string };
        if (!qrToken) {
          return reply.status(400).send({ error: "qrToken is required" });
        }

        const order = await getOrderByQRToken(qrToken);
        if (!order) {
          return reply
            .status(404)
            .send({ error: "QR inválido o expirado" });
        }

        reply.send(order);
      } catch (error) {
        reply.status(500).send({ error: (error as Error).message });
        console.error("Error verifying QR:", error);
      }
    }
  );

  app.post(
    "/orders/verify-qr-hash",
    {
      config: { action: "orders.verify-qr-hash" },
      preHandler: [app.authenticate, requirePermission("pos:use")],
    },
    async (req, reply) => {
      try {
        const { qrTokenHash } = req.body as { qrTokenHash: string };
        if (!qrTokenHash) {
          return reply.status(400).send({ error: "qrTokenHash is required" });
        }

        const order = await getOrderByQRTokenHash(qrTokenHash);
        if (!order) {
          return reply
            .status(404)
            .send({ error: "QR inválido o expirado" });
        }

        reply.send(order);
      } catch (error) {
        reply.status(500).send({ error: (error as Error).message });
        console.error("Error verifying QR hash:", error);
      }
    }
  );

  const transitionEndpoints = [
    { path: "confirm", target: "confirmed" as const, permission: "pos:use" as const },
    { path: "prepare", target: "preparing" as const, permission: "pos:use" as const },
    { path: "ready", target: "ready" as const, permission: "pos:use" as const },
    { path: "complete", target: "completed" as const, permission: "pos:use" as const },
  ];

  for (const endpoint of transitionEndpoints) {
    app.patch(
      `/orders/:id/${endpoint.path}`,
      {
        config: { action: `orders.${endpoint.path}` },
        preHandler: [
          app.authenticate,
          requirePermission(endpoint.permission),
        ],
      },
      async (req, reply) => {
        try {
          if (!req.auth) {
            return reply.status(401).send({ error: "No auth context" });
          }

          const { id } = req.params as { id: string };
          const { notes } = (req.body as { notes?: string }) || {};

          const updated = await updateOrderStatus(
            new ObjectId(id),
            endpoint.target,
            {
              userId: req.auth.identity.userId.toHexString(),
              role: req.auth.scope.role,
            },
            notes
          );

          reply.send(updated);
        } catch (error) {
          reply.status(400).send({ error: (error as Error).message });
          console.error(`Error transitioning to ${endpoint.target}:`, error);
        }
      }
    );
  }

  app.patch(
    "/orders/:id/cancel",
    {
      config: { action: "orders.cancel" },
      preHandler: [app.authenticate, requirePermission("orders:cancel")],
    },
    async (req, reply) => {
      try {
        if (!req.auth) {
          return reply.status(401).send({ error: "No auth context" });
        }

        const { id } = req.params as { id: string };
        const { notes } = (req.body as { notes?: string }) || {};

        const updated = await updateOrderStatus(
          new ObjectId(id),
          "cancelled",
          {
            userId: req.auth.identity.userId.toHexString(),
            role: req.auth.scope.role,
          },
          notes
        );

        console.log(`[Orders] ${updated.orderNumber} → cancelled`);
        reply.send(updated);
      } catch (error) {
        reply.status(400).send({ error: (error as Error).message });
        console.error("Error cancelling order:", error);
      }
    }
  );

  app.post(
    "/orders/:id/pay",
    {
      config: { action: "orders.pay" },
      preHandler: [app.authenticate, requirePermission("pos:use")],
    },
    async (req, reply) => {
      try {
        const { id } = req.params as { id: string };
        const { paymentMethod } = req.body as { paymentMethod: string };

        if (!paymentMethod) {
          return reply
            .status(400)
            .send({ error: "paymentMethod is required" });
        }

        const updated = await markOrderAsPaid(
          new ObjectId(id),
          paymentMethod
        );

        console.log(`[Orders] ${updated.orderNumber} → paid`);
        reply.send(updated);
      } catch (error) {
        reply.status(400).send({ error: (error as Error).message });
        console.error("Error marking order as paid:", error);
      }
    }
  );

  app.post(
    "/orders/:id/refund",
    {
      config: { action: "orders.refund" },
      preHandler: [app.authenticate, requirePermission("pos:refund")],
    },
    async (req, reply) => {
      try {
        const { id } = req.params as { id: string };
        const updated = await refundOrder(new ObjectId(id));

        console.log(`[Orders] ${updated.orderNumber} → refunded`);
        reply.send(updated);
      } catch (error) {
        reply.status(400).send({ error: (error as Error).message });
        console.error("Error refunding order:", error);
      }
    }
  );


  app.post(
    "/orders/:id/discount",
    {
      config: { action: "orders.discount" },
      preHandler: [
        app.authenticate,
        requirePermission("pos:apply_discount"),
      ],
    },
    async (req, reply) => {
      try {
        const { id } = req.params as { id: string };
        const { amount } = req.body as { amount: number };

        if (amount == null || amount < 0) {
          return reply
            .status(400)
            .send({ error: "amount is required and must be >= 0" });
        }
        const updated = await applyDiscount(new ObjectId(id), amount);
        reply.send(updated);
      } catch (error) {
        reply.status(400).send({ error: (error as Error).message });
        console.error("Error applying discount:", error);
      }
    }
  );

  app.get(
    "/orders/shop/:shopId",
    {
      config: { action: "orders.by_shop" },
      preHandler: [
        app.authenticate,
        requirePermission("orders:view"),
        applyScopeMiddleware,
      ],
    },
    async (req, reply) => {
      try {
        if (!req.auth) {
          return reply.status(401).send({ error: "No auth context" });
        }

        const { shopId } = req.params as { shopId: string };
        const qs = req.query as Record<string, string>;
        const pagination = parsePagination(qs);
        const result = await getOrdersByShopIdPaginated(new ObjectId(shopId), pagination);
        reply.send(result);
      } catch (error) {
        reply.status(500).send({ error: (error as Error).message });
        console.error("Error fetching orders by shop:", error);
      }
    }
  )

  app.get(
    '/orders/user/:userId',
    {
      config: { action: 'orders.by_user' },
      preHandler: [
        app.authenticate,
        requirePermission('orders:view'),
        applyScopeMiddleware,
      ],
    },
    async (req, reply) => {
      try {
        if (!req.auth) {
          return reply.status(401).send({ error: 'No auth context' });
        }
        
        const { userId } = req.params as { userId: string };

        if (req.auth.scope.role === 'CLIENT') {
          const authUserId = req.auth.identity.userId.toHexString();
          if (userId !== authUserId) {
            return reply.status(403).send({ error: 'No tienes acceso a las órdenes de este usuario' });
          }
        }

        const qs = req.query as Record<string, string>;
        const pagination = parsePagination(qs);
        const result = await getActiveOrdersByUserIdPaginated(new ObjectId(userId), pagination);
        reply.send(result);
      } catch (error) {
        reply.status(500).send({ error: (error as Error).message });
        console.error('Error fetching orders by user:', error);
      }
    }
  )

  app.get(
    '/orders/user/:userId/dashboard-counts',
    {
      config: { action: 'orders.dashboard_counts' },
      preHandler: [
        app.authenticate,
        requirePermission('orders:view'),
        applyScopeMiddleware,
      ],
    },
    async (req, reply) => {
      try {
        if (!req.auth) {
          return reply.status(401).send({ error: 'No auth context' });
        }
        const { userId } = req.params as { userId: string };
        if (req.auth.scope.role === 'CLIENT') {
          const authUserId = req.auth.identity.userId.toHexString();
          if (userId !== authUserId) {
            return reply.status(403).send({ error: 'You do not have access to this resource' });
          }
        }
        const counts = await getOrderCountsForDashboard(new ObjectId(userId));
        reply.send(counts);
      } catch (error) {
        reply.status(500).send({ error: (error as Error).message });
        console.error('Error fetching dashboard order counts:', error);
      }
    }
  );
};
