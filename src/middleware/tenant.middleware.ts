import { FastifyRequest, FastifyReply } from "fastify";
import { ObjectId } from "mongodb";

declare module "fastify" {
  interface FastifyRequest {
    tenantId?: ObjectId;
  }
}

export async function tenantIsolation(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const requestedTenantId = request.headers['x-tenant-id'] as string;

  if (!requestedTenantId) {
    return reply.status(400).send({ error: 'Missing X-Tenant-Id header' });
  }

  const auth = request.auth;
  if (!auth) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  if (auth.scope.role === 'ADMIN') {
    request.tenantId = new ObjectId(requestedTenantId);
    return;
  }

  if (!/^[0-9a-fA-F]{24}$/.test(requestedTenantId)) {
    return reply.status(400).send({ error: 'Invalid X-Tenant-Id format' });
  }

  const belongsToTenant = auth.identity.tenants?.some(
    t => t.tenantId.toString() === requestedTenantId
  ) || auth.identity.tenantId?.toString() === requestedTenantId;

  if (!belongsToTenant) {
    return reply.status(403).send({
      error: 'Access denied to this tenant',
    });
  }

  request.tenantId = new ObjectId(requestedTenantId);
}

export async function optionalTenantContext(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const requestedTenantId = request.headers['x-tenant-id'] as string;

  if (requestedTenantId && /^[0-9a-fA-F]{24}$/.test(requestedTenantId)) {
    request.tenantId = new ObjectId(requestedTenantId);
  }
}
