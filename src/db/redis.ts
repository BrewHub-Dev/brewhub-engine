import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redis.on("connect", () => {
  console.log("[Redis] Connected");
});

redis.on("error", (err) => {
  console.error("[Redis] Error:", err.message);
});

export const redisKeys = {
  qrVerification: (hash: string) => `order:qr:${hash}`,
  dailyOrderCount: (branchId: string, date: string) =>
    `order:count:${branchId}:${date}`,
};
