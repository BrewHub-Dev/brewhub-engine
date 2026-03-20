import { MongoClient } from "mongodb";
import mongoose from "mongoose";

let _client: MongoClient | null = null;
let _db: ReturnType<MongoClient["db"]> | null = null;

/**
 * Lazy proxy for `db`.
 * Accessing any property will throw a clear error if connectDB() hasn't been called yet.
 */
export const db = new Proxy({} as ReturnType<MongoClient["db"]>, {
  get(_target, prop: string) {
    if (!_db) {
      throw new Error(
        "[DB] Database not connected. Call connectDB() before using db."
      );
    }
    return (_db as any)[prop];
  },
});

export async function connectDB(url?: string, dbName?: string): Promise<ReturnType<MongoClient["db"]>> {
  const connUrl = url || process.env.CONN_URL || process.env.MONGO_URL;
  if (!connUrl) throw new Error("Missing CONN_URL / MONGO_URL environment variable");

  const name = dbName || process.env.DB_NAME;

  _client = new MongoClient(connUrl);
  await _client.connect();
  _db = _client.db(name);

  await mongoose.connect(connUrl, { dbName: name });

  return _db;
}

export async function disconnectDB(): Promise<void> {
  if (_client) {
    await _client.close();
    _client = null;
    _db = null;
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
