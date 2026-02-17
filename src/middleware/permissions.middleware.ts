import { FastifyRequest, FastifyReply } from "fastify";
import { hasAnyPermission, type Permission } from "../rbac";

/**
 * Middleware para requerir uno o más permisos
 *
 * @example
 * app.get("/items", requirePermission("items:view"), handler)
 *
 * @example
 * app.delete("/items/:id", requirePermission("items:delete"), handler)
 */
export function requirePermission(...permissions: Permission[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) {
      return reply.status(401).send({
        error: "Unauthorized",
        message: "Debes estar autenticado para acceder a este recurso",
      });
    }

    const userRole = request.auth.scope.role;

    const hasAccess = hasAnyPermission(userRole, permissions);

    if (!hasAccess) {
      console.warn(`[RBAC] Usuario con rol ${userRole} intentó acceder sin permisos`, {
        userId: request.auth.identity.userId.toString(),
        requiredPermissions: permissions,
        path: request.url,
        method: request.method,
      });

      return reply.status(403).send({
        error: "Forbidden",
        message: "No tienes permisos suficientes para realizar esta acción",
        requiredPermissions: permissions,
      });
    }

    // Usuario tiene permisos, continuar
    console.log(`[RBAC] Acceso concedido: ${userRole} → ${request.method} ${request.url}`);
  };
}

/**
 * Middleware para requerir un rol específico
 *
 * @example
 * app.get("/admin", requireRole("ADMIN"), handler)
 */
export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) {
      return reply.status(401).send({
        error: "Unauthorized",
        message: "Debes estar autenticado",
      });
    }

    const userRole = request.auth.scope.role;

    if (!roles.includes(userRole)) {
      return reply.status(403).send({
        error: "Forbidden",
        message: `Se requiere uno de estos roles: ${roles.join(", ")}`,
        requiredRoles: roles,
      });
    }

    console.log(`[RBAC] Rol verificado: ${userRole} → ${request.method} ${request.url}`);
  };
}
