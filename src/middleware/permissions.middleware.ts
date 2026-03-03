import { FastifyRequest, FastifyReply } from "fastify";
import { hasAnyPermission, type Permission } from "../rbac";

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

    console.log(`[RBAC] Acceso concedido: ${userRole} → ${request.method} ${request.url}`);
  };
}

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
