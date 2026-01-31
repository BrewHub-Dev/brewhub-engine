import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.CONN_URL);
export const db = client.db(process.env.DB_NAME);

export async function connectDB() {
  if (!client.connect()) await client.connect();
  console.log("MongoDB connected");
  return db;
}
