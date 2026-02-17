/**
 * Sistema RBAC (Role-Based Access Control) para BrewHub Backend
 */

export type { Permission, UserRole } from "./permissions";
export {
  ROLE_PERMISSIONS,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
} from "./permissions";

export type { DataScope, User } from "./scope";
export {
  getUserDataScope,
  applyScopeFilter,
  canAccessShop,
  canAccessBranch,
} from "./scope";
