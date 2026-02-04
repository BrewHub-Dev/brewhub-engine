import { db } from "@/db/mongo";
import { User } from "./user.model";
import * as bcrypt from "bcryptjs";
import { Branches } from "../branches/branches.model";
import { Shop } from "../shops/shop.model";

export async function createUser(user: User) {
  const validated = user;

  if (!validated.isClient) {
    if (!validated.ShopId || !validated.BranchId) {
      throw new Error("ShopId and BranchId are required for non-client users");
    }

    const shops = db.collection("shops");
    const shop = await shops.findOne({ _id: validated.ShopId });
    if (!shop) {
      throw new Error("Shop not found for provided ShopId");
    }

    const branches = db.collection("branches");
    const branch = await branches.findOne({ _id: validated.BranchId });
    if (!branch) {
      throw new Error("Branch not found for provided BranchId");
    }
  }
  if (validated.password) {
    const salt = await bcrypt.genSalt(10);
    validated.password = await bcrypt.hash(validated.password, salt);
  }
  const users = db.collection<User>("users");
  const result = await users.insertOne(validated);
  return { ...validated, _id: result.insertedId };
}

export async function getUsers() {
  const usersCollection = db.collection<User>("users");
  const users = await usersCollection.find().toArray();

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
          .collection("branches")
          .find({ _id: { $in: branchIds } })
          .toArray()
      : [],
    shopIds.length
      ? db
          .collection("shops")
          .find({ _id: { $in: shopIds } })
          .toArray()
      : [],
  ]);

  const branchMap = new Map<string, Branches>(
    branches.map((b: { _id: { toString: () => string; }; }) => [b._id.toString(), b] as [string, any])
  );

  const shopMap = new Map<string, Shop>(
    shops.map((s: { _id: { toString: () => string; }; }) => [s._id.toString(), s] as [string, any])
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
