import Redis from "ioredis";

const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = Number(process.env.REDIS_PORT) || 6379;


export const redis = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redis.on("connect", () => {
  console.log("[Redis] Connected");
});

redis.on("ready", () => {
  console.log("[Redis] Ready to accept commands");
});

redis.on("error", (err) => {
  console.error("[Redis] Error:", err.message);
});

redis.on("close", () => {
  console.warn("[Redis] Connection closed");
});

redis.on("reconnecting", (time) => {
  console.log(`[Redis] Reconnecting in ${time}ms`);
});

export const redisKeys = {
  qrVerification: (hash: string) => `order:qr:${hash}`,
  dailyOrderCount: (branchId: string, date: string) =>
    `order:count:${branchId}:${date}`,
  userSession: (userId: string) => `user:session:${userId}`,
  productCache: (productId: string) => `product:cache:${productId}`,
};
