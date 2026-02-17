import { db } from "@/db/mongo";
import { Branches } from "./branches.model";
import { ObjectId } from "mongodb";

export async function createBranch(branch: Branches) {
  const validated = branch;

  if (!validated.ShopId) {
    throw new Error("ShopId is required for non-client users");
  }

  const shops = db.collection("shops");
  const shop = await shops.findOne({ _id: validated.ShopId });
  if (!shop) {
    throw new Error("Shop not found for provided ShopId");
  }
  const branches = db.collection("branches");
  const result = await branches.insertOne(validated);
  return { ...validated, _id: result.insertedId };
}

export async function getBranches() {
  const branches = db.collection("branches");
  return branches.find().toArray();
}

export async function getBranchesByShopId(shopId: string) {
  const branches = db.collection("branches");
  return branches.find({ ShopId: new ObjectId(shopId) }).toArray();
}

export async function getBranchById(id: string) {
  const branches = db.collection("branches");
  return branches.findOne({ _id: new ObjectId(id) });
}

export async function updateBranch(id: string, updates: Partial<Branches>) {
  const branches = db.collection("branches");
  const result = await branches.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: updates },
    { returnDocument: "after" }
  );
  if (!result) {
    throw new Error("Branch not found");
  }
  return result;
}

export async function deleteBranch(id: string) {
  const branches = db.collection("branches");
  const result = await branches.deleteOne({ _id: new ObjectId(id) });
  if (result.deletedCount === 0) {
    throw new Error("Branch not found");
  }
  return true;
}
