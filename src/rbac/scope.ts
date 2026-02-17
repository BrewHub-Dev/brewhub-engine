import { UserRole } from "./permissions";

export interface DataScope {
  shopIds?: string[];
  branchIds?: string[];
  canViewAllShops: boolean;
  canViewShop: boolean;
  onlyOwnBranch: boolean;
}

export interface User {
  _id: string;
  role: UserRole;
  ShopId?: string;
  BranchId?: string;
}

export function getUserDataScope(user: User | null): DataScope {
  if (!user) {
    return {
      canViewAllShops: false,
      canViewShop: false,
      onlyOwnBranch: false,
    };
  }

  switch (user.role) {
    case "ADMIN":
      return {
        canViewAllShops: true,
        canViewShop: true,
        onlyOwnBranch: false,
      };

    case "SHOP_ADMIN":
      return {
        shopIds: user.ShopId ? [user.ShopId] : undefined,
        canViewAllShops: false,
        canViewShop: true,
        onlyOwnBranch: false,
      };

    case "BRANCH_ADMIN":
      return {
        shopIds: user.ShopId ? [user.ShopId] : undefined,
        branchIds: user.BranchId ? [user.BranchId] : undefined,
        canViewAllShops: false,
        canViewShop: false,
        onlyOwnBranch: true,
      };

    case "CLIENT":
      return {
        canViewAllShops: false,
        canViewShop: false,
        onlyOwnBranch: false,
      };

    default:
      return {
        canViewAllShops: false,
        canViewShop: false,
        onlyOwnBranch: false,
      };
  }
}


export function applyScopeFilter(
  scope: DataScope,
  filters: Record<string, any> = {}
): Record<string, any> {
  const scopedFilters = { ...filters };

  if (scope.shopIds && scope.shopIds.length > 0) {
    if (scope.shopIds.length === 1) {
      scopedFilters.ShopId = scope.shopIds[0];
    } else {
      scopedFilters.ShopId = { $in: scope.shopIds };
    }
  }

  if (scope.branchIds && scope.branchIds.length > 0) {
    if (scope.branchIds.length === 1) {
      scopedFilters.BranchId = scope.branchIds[0];
    } else {
      scopedFilters.BranchId = { $in: scope.branchIds };
    }
  }

  return scopedFilters;
}

export function canAccessShop(scope: DataScope, shopId: string): boolean {
  if (scope.canViewAllShops) return true;
  if (!scope.shopIds) return false;
  return scope.shopIds.includes(shopId);
}

export function canAccessBranch(scope: DataScope, branchId: string): boolean {
  if (scope.canViewAllShops) return true;
  if (!scope.branchIds) return scope.canViewShop;
  return scope.branchIds.includes(branchId);
}
