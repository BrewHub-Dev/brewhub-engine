/**
 * Sistema RBAC (Role-Based Access Control) para BrewHub Backend
 * Permisos granulares en formato "recurso:acción"
 */

export type UserRole = "ADMIN" | "SHOP_ADMIN" | "BRANCH_ADMIN" | "CLIENT";

export type Permission =
  | "dashboard:view"
  | "dashboard:view_all_shops"
  | "dashboard:view_shop"
  | "dashboard:view_branch"

  | "pos:use"
  | "pos:refund"
  | "pos:cancel_order"
  | "pos:apply_discount"

  | "items:view"
  | "items:create"
  | "items:edit"
  | "items:delete"
  | "items:manage_inventory"

  | "users:view"
  | "users:create"
  | "users:edit"
  | "users:delete"
  | "users:assign_roles"

  | "branches:view"
  | "branches:create"
  | "branches:edit"
  | "branches:delete"

  | "shops:view"
  | "shops:create"
  | "shops:edit"
  | "shops:delete"

  | "analytics:view"
  | "analytics:export"
  | "analytics:view_all_shops"
  | "analytics:view_shop"

  | "orders:view"
  | "orders:view_all"
  | "orders:create"
  | "orders:cancel"

  | "profile:view"
  | "profile:edit"

  | "categories:view"
  | "categories:create"
  | "categories:edit"
  | "categories:delete";

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  ADMIN: [
    "dashboard:view",
    "dashboard:view_all_shops",
    "dashboard:view_shop",
    "dashboard:view_branch",

    "pos:use",
    "pos:refund",
    "pos:cancel_order",
    "pos:apply_discount",

    "items:view",
    "items:create",
    "items:edit",
    "items:delete",
    "items:manage_inventory",

    "users:view",
    "users:create",
    "users:edit",
    "users:delete",
    "users:assign_roles",

    // Sucursales
    "branches:view",
    "branches:create",
    "branches:edit",
    "branches:delete",

    // Tiendas
    "shops:view",
    "shops:create",
    "shops:edit",
    "shops:delete",

    // Analíticas
    "analytics:view",
    "analytics:export",
    "analytics:view_all_shops",
    "analytics:view_shop",

    // Órdenes
    "orders:view",
    "orders:view_all",
    "orders:create",
    "orders:cancel",

    // Perfil
    "profile:view",
    "profile:edit",

    // Categorías
    "categories:view",
    "categories:create",
    "categories:edit",
    "categories:delete",
  ],

  SHOP_ADMIN: [
    "dashboard:view",
    "dashboard:view_shop",
    "dashboard:view_branch",

    "pos:use",
    "pos:refund",
    "pos:cancel_order",
    "pos:apply_discount",

    "items:view",
    "items:create",
    "items:edit",
    "items:delete",
    "items:manage_inventory",

    "users:view",
    "users:create",
    "users:edit",

    "branches:view",
    "branches:create",
    "branches:edit",
    "branches:delete",

    "shops:view",
    "shops:edit",

    "analytics:view",
    "analytics:export",
    "analytics:view_shop",

    "orders:view",
    "orders:create",
    "orders:cancel",

    "profile:view",
    "profile:edit",

    "categories:view",
    "categories:create",
    "categories:edit",
    "categories:delete",
  ],

  BRANCH_ADMIN: [
    "dashboard:view",
    "dashboard:view_branch",

    "pos:use",
    "pos:refund",
    "pos:apply_discount",

    "items:view",
    "items:edit",
    "items:manage_inventory",

    "users:view",

    "analytics:view",

    "orders:view",
    "orders:create",

    "profile:view",
    "profile:edit",

    "categories:view",
  ],

  CLIENT: [
    "dashboard:view",
    "orders:view",
    "orders:create",
    "profile:view",
    "profile:edit",
  ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  return permissions?.includes(permission) ?? false;
}

export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}

export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every((permission) => hasPermission(role, permission));
}
