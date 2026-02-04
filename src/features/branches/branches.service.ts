import { db } from "@/db/mongo";
import { Branches } from "./branches.model";

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
