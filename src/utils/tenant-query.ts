import { Filter } from "mongodb";
import { AuthScope } from "@/auth/scope";
import { ObjectId } from "mongodb";

export function filterByTenantScope<T>(
  scope: AuthScope,
  query: Filter<T> = {}
): Filter<T> {
  if (scope.role === 'ADMIN') {
    return query;
  }

  if ('shopId' in scope && scope.shopId) {
    (query as any).ShopId = scope.shopId;
  }

  if (scope.role === 'BRANCH_ADMIN' && scope.branchId) {
    (query as any).BranchId = scope.branchId;
  }

  return query;
}

export function filterByExplicitTenant<T>(
  tenantId: ObjectId,
  query: Filter<T> = {}
): Filter<T> {
  (query as any).ShopId = tenantId;
  return query;
}

export function validateTenantOwnership(
  document: { ShopId?: ObjectId } | null,
  scope: AuthScope
): boolean {
  if (!document) return false;
  if (scope.role === 'ADMIN') return true;

  if ('shopId' in scope && scope.shopId) {
    return document.ShopId?.toString() === scope.shopId.toString();
  }

  return false;
}
