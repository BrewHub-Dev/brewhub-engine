import { db } from "../../db/mongo";
import { userSchema, User } from "./user.model";
import * as bcrypt from "bcryptjs";

export async function createUser(user: User) {
  const validated = userSchema.parse(user);
  if (validated.password) {
    const salt = await bcrypt.genSalt(10);
    validated.password = await bcrypt.hash(validated.password, salt);
  }
  const users = db.collection("users");
  const result = await users.insertOne(validated);
  return { ...validated, _id: result.insertedId };
}

export async function getUsers() {
  const users = db.collection("users");
  return users.find().toArray();
}

export async function findUserByEmail(email: string) {
  const users = db.collection("users");
  return users.findOne({ emailAddress: email });
}
