import { FastifyRequest, FastifyReply } from "fastify";
import { getUserDataScope, applyScopeFilter, type User } from "../rbac";

declare module "fastify" {
  interface FastifyRequest {
    scope?: ReturnType<typeof getUserDataScope>;

    scopedQuery?: (baseQuery?: Record<string, any>) => Record<string, any>;
  }
}

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

    if (scope.canViewAllShops) {
      done();
      return;
    }

    (request as any).validateScope = (resource: any) => {
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
