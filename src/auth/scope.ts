import { ObjectId } from "mongodb";
import { db } from "@/db/mongo";
import { Branches } from "@/features/branches/branches.model";

export type UserRole = "ADMIN" | "SHOP_ADMIN" | "BRANCH_ADMIN" | "CLIENT";

export interface AuthTokenPayload {
  sub: string; // userId
  role: UserRole;
  shopId?: string;
  branchId?: string;
  defaultBranchId?: string;
}

export interface AuthIdentity {
  userId: ObjectId;
  role: UserRole;
  shopId?: ObjectId;
  branchId?: ObjectId;
  defaultBranchId?: ObjectId;
}

export type AdminScope = {
  role: "ADMIN";
};

export type ShopAdminScope = {
  role: "SHOP_ADMIN";
  shopId: ObjectId;
  branchId?: ObjectId;
};

export type BranchAdminScope = {
  role: "BRANCH_ADMIN";
  shopId: ObjectId;
  branchId: ObjectId;
};

export type ClientScope = {
  role: "CLIENT";
  userId: ObjectId;
};

export type AuthScope = AdminScope | ShopAdminScope | BranchAdminScope | ClientScope;

export async function buildScope(
  identity: AuthIdentity,
  requestedBranchId?: string | null
): Promise<AuthScope> {
  switch (identity.role) {
    case "ADMIN": {
      return { role: "ADMIN" };
    }
    case "SHOP_ADMIN": {
      if (!identity.shopId) {
        throw new Error("SHOP_ADMIN identity is missing shopId in token");
      }

      if (!requestedBranchId) {
        return {
          role: "SHOP_ADMIN",
          shopId: identity.shopId,
        };
      }

      const branchObjectId = new ObjectId(requestedBranchId);
      const branches = db.collection<Branches>("branches");
      const branch = await branches.findOne({
        _id: branchObjectId,
        ShopId: identity.shopId,
      });

      if (!branch) {
        throw new Error("Invalid branch for SHOP_ADMIN scope");
      }

      return {
        role: "SHOP_ADMIN",
        shopId: identity.shopId,
        branchId: branchObjectId,
      };
    }
    case "BRANCH_ADMIN": {
      if (!identity.shopId || !identity.branchId) {
        throw new Error("BRANCH_ADMIN identity is missing shopId/branchId");
      }
      // BRANCH_ADMIN cannot change branch, ignore requestedBranchId entirely
      return {
        role: "BRANCH_ADMIN",
        shopId: identity.shopId,
        branchId: identity.branchId,
      };
    }
    case "CLIENT": {
      return {
        role: "CLIENT",
        userId: identity.userId,
      };
    }
    default: {
      const _never: never = identity.role;
      throw new Error(`Unsupported role in scope builder: ${_never}`);
    }
  }
}
