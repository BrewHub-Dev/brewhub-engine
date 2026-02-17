import { FastifyRequest, FastifyReply } from "fastify";
import { getUserDataScope, applyScopeFilter, type User } from "../rbac";

/**
 * Extiende FastifyRequest para añadir helpers de scope
 */
declare module "fastify" {
  interface FastifyRequest {
    /**
     * Scope de datos del usuario autenticado
     */
    scope?: ReturnType<typeof getUserDataScope>;

    /**
     * Helper para aplicar filtros de scope a queries
     */
    scopedQuery?: (baseQuery?: Record<string, any>) => Record<string, any>;
  }
}

/**
 * Middleware que añade helpers de scope al request
 *
 * Uso:
 * ```typescript
 * app.get("/items",
 *   requirePermission("items:view"),
 *   applyScopeMiddleware,
 *   async (req, reply) => {
 *     const query = req.scopedQuery({ active: true });
 *     // Para ADMIN: { active: true }
 *     // Para SHOP_ADMIN: { active: true, ShopId: "shop123" }
 *     // Para BRANCH_ADMIN: { active: true, ShopId: "shop123", BranchId: "branch456" }
 *     const items = await Item.find(query);
 *     reply.send(items);
 *   }
 * );
 * ```
 */
export function applyScopeMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
  done: () => void
) {
  if (!request.auth) {
    return reply.status(401).send({
      error: "Unauthorized",
      message: "Debes estar autenticado",
    });
  }

  const user: User = {
    _id: request.auth.identity.userId.toHexString(),
    role: request.auth.scope.role,
    ShopId:
      request.auth.scope.role !== "ADMIN" && request.auth.scope.role !== "CLIENT"
        ? request.auth.scope.shopId?.toHexString()
        : undefined,
    BranchId:
      request.auth.scope.role === "BRANCH_ADMIN"
        ? request.auth.scope.branchId.toHexString()
        : request.auth.scope.role === "SHOP_ADMIN"
        ? request.auth.scope.branchId?.toHexString()
        : undefined,
  };

  const scope = getUserDataScope(user);
  request.scope = scope;

  request.scopedQuery = (baseQuery: Record<string, any> = {}) => {
    return applyScopeFilter(scope, baseQuery);
  };

  console.log(`[SCOPE] Usuario: ${user.role}`, {
    shopIds: scope.shopIds,
    branchIds: scope.branchIds,
    canViewAllShops: scope.canViewAllShops,
  });

  done();
}

/**
 * Middleware que valida que el recurso solicitado esté dentro del scope del usuario
 *
 * @example
 * app.get("/items/:id",
 *   requirePermission("items:view"),
 *   validateResourceScope("ShopId"), // Verifica que el item pertenezca al scope del usuario
 *   async (req, reply) => {
 *     const item = await Item.findById(req.params.id);
 *     reply.send(item);
 *   }
 * );aho
 */
export function validateResourceScope(shopIdField: string = "ShopId", branchIdField: string = "BranchId") {
  return async (request: FastifyRequest, reply: FastifyReply, done: () => void) => {
    if (!request.auth) {
      return reply.status(401).send({
        error: "Unauthorized",
        message: "Debes estar autenticado",
      });
    }

    const user: User = {
      _id: request.auth.identity.userId.toHexString(),
      role: request.auth.scope.role,
      ShopId:
        request.auth.scope.role !== "ADMIN" && request.auth.scope.role !== "CLIENT"
          ? request.auth.scope.shopId?.toHexString()
          : undefined,
      BranchId:
        request.auth.scope.role === "BRANCH_ADMIN"
          ? request.auth.scope.branchId.toHexString()
          : request.auth.scope.role === "SHOP_ADMIN"
          ? request.auth.scope.branchId?.toHexString()
          : undefined,
    };

    const scope = getUserDataScope(user);

    // Si puede ver todas las tiendas (ADMIN), permitir acceso
    if (scope.canViewAllShops) {
      done();
      return;
    }

    // Almacenar validador en request para uso posterior
    (request as any).validateScope = (resource: any) => {
      // Verificar ShopId
      if (scope.shopIds && resource[shopIdField]) {
        const resourceShopId = resource[shopIdField].toString();
        if (!scope.shopIds.includes(resourceShopId)) {
          return false;
        }
      }

      // Verificar BranchId si es necesario
      if (scope.branchIds && resource[branchIdField]) {
        const resourceBranchId = resource[branchIdField].toString();
        if (!scope.branchIds.includes(resourceBranchId)) {
          return false;
        }
      }

      return true;
    };

    done();
  };
}
