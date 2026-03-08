import { MongoClient } from "mongodb";
import mongoose from "mongoose";

const client = new MongoClient(process.env.CONN_URL);
export const db = client.db(process.env.DB_NAME);

export async function connectDB() {
  if (!client.connect()) await client.connect();
  await mongoose.connect(process.env.CONN_URL, { dbName: process.env.DB_NAME });
  console.log("MongoDB connected");
  return db;
}
