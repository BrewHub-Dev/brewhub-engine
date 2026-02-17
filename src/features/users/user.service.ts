import { db } from "@/db/mongo";
import { User } from "./user.model";
import * as bcrypt from "bcryptjs";
import { Branches } from "../branches/branches.model";
import { Shop } from "../shops/shop.model";
import { ObjectId, Filter } from "mongodb";
import { AuthScope } from "@/auth/scope";

export type UserDocument = User & {
  _id: ObjectId;
};

type BranchDocument = Branches & { _id: ObjectId };
type ShopDocument = Shop & { _id: ObjectId };

export async function createUser(user: User): Promise<UserDocument> {
  const validated = user;

  if (validated.role !== "CLIENT") {
    const shops = db.collection("shops");
    const shop = await shops.findOne({ _id: validated.ShopId });
    if (!shop) {
      throw new Error("Shop not found for provided ShopId");
    }
  }
  if (validated.password) {
    const salt = await bcrypt.genSalt(10);
    validated.password = await bcrypt.hash(validated.password, salt);
  }
  const users = db.collection<User>("users");
  const result = await users.insertOne(validated);
  const createdUser: UserDocument = {
    ...validated,
    _id: result.insertedId,
  };
  return createdUser;
}

export async function getUser(userId: string | ObjectId, scope: AuthScope) {
  const usersCollection = db.collection<User>("users");
  const _id = typeof userId === "string" ? new ObjectId(userId) : userId;

  const filter: Filter<User> = { _id };

  switch (scope.role) {
    case "ADMIN": {
      break;
    }
    case "SHOP_ADMIN": {
      filter.ShopId = scope.shopId;
      break;
    }
    case "BRANCH_ADMIN": {
      filter.ShopId = scope.shopId;
      filter.BranchId = scope.branchId;
      break;
    }
    case "CLIENT": {
      if (!_id.equals(scope.userId)) {
        return null;
      }
      break;
    }
  }

  const user = await usersCollection.findOne(filter);
  if (!user) return null;

  let branch: Branches | {} = {};
  let shop: Shop | {} = {};

  if (user.BranchId) {
    const branchDoc = await db
      .collection("branches")
      .findOne({ _id: user.BranchId });
    if (branchDoc) {
      branch = branchDoc;
    }
  }

  if (user.ShopId) {
    const shopDoc = await db
      .collection("shops")
      .findOne({ _id: user.ShopId });
    if (shopDoc) {
      shop = shopDoc;
    }
  }

  return {
    ...user,
    branch,
    shop,
  };
}

export async function getUsers(scope: AuthScope) {
  const usersCollection = db.collection<User>("users");
  const baseFilter: Filter<User> = {};

  switch (scope.role) {
    case "ADMIN": {
      break;
    }
    case "SHOP_ADMIN": {
      baseFilter.ShopId = scope.shopId;
      if (scope.branchId) {
        baseFilter.BranchId = scope.branchId;
      }
      break;
    }
    case "BRANCH_ADMIN": {
      baseFilter.ShopId = scope.shopId;
      baseFilter.BranchId = scope.branchId;
      break;
    }
    case "CLIENT": {
      baseFilter._id = scope.userId;
      break;
    }
  }

  const users = await usersCollection.find(baseFilter).toArray();

  if (users.length === 0) return [];

  const branchIds = Array.from(
    new Set(users.map((u) => u.BranchId).filter(Boolean))
  );

  const shopIds = Array.from(
    new Set(users.map((u) => u.ShopId).filter(Boolean))
  );

  const [branches, shops] = await Promise.all([
    branchIds.length
      ? db
          .collection<BranchDocument>("branches")
          .find({ _id: { $in: branchIds } })
          .toArray()
      : [],
    shopIds.length
      ? db
          .collection<ShopDocument>("shops")
          .find({ _id: { $in: shopIds } })
          .toArray()
      : [],
  ]);

  const branchMap = new Map<string, BranchDocument>(
    branches.map((b): [string, BranchDocument] => [b._id.toString(), b])
  );

  const shopMap = new Map<string, ShopDocument>(
    shops.map((s): [string, ShopDocument] => [s._id.toString(), s])
  );

  return users.map((user) => ({
    ...user,
    branch: user.BranchId
      ? branchMap.get(user.BranchId.toString())
      : {},
    shop: user.ShopId
      ? shopMap.get(user.ShopId.toString())
      : {},
  }));
}

export async function findUserByEmail(email: string) {
  const users = db.collection<User>("users");
  return users.findOne({ emailAddress: email });
}

export async function updateUser(userId: string, updates: Partial<User>) {
  const users = db.collection<User>("users");

  const toUpdate: any = { ...updates };
  delete toUpdate.password;

  if (updates.ShopId) {
    toUpdate.ShopId = new ObjectId(updates.ShopId);
  }
  if (updates.BranchId) {
    toUpdate.BranchId = new ObjectId(updates.BranchId);
  }

  const result = await users.findOneAndUpdate(
    { _id: new ObjectId(userId) },
    { $set: toUpdate },
    { returnDocument: "after" }
  );

  if (!result) {
    throw new Error("User not found");
  }

  return result;
}

export async function updateUserPassword(userId: string, newPassword: string) {
  const users = db.collection<User>("users");

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  const result = await users.findOneAndUpdate(
    { _id: new ObjectId(userId) },
    { $set: { password: hashedPassword } },
    { returnDocument: "after" }
  );

  if (!result) {
    throw new Error("User not found");
  }

  return result;
}

export async function deleteUser(userId: string) {
  const users = db.collection("users");
  const result = await users.deleteOne({ _id: new ObjectId(userId) });

  if (result.deletedCount === 0) {
    throw new Error("User not found");
  }

  return true;
}
