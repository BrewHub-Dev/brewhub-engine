import { Verrou } from "@verrou/core";
import { redisStore } from "@verrou/core/drivers/redis";
import { redis } from "./redis";

// Duration: number in ms, or string like "5s", "2m", "1h", or null (no expiry)
type Duration = number | string | null;

export const verrou = new Verrou({
  default: "redis",
  stores: {
    redis: {
      driver: redisStore({ connection: redis }),
    },
  },
});

const predefinedDurations: Record<string, string> = {
  short: "2s",
  default: "5s",
  long: "10s",
};

type LockOptions = {
  duration?: Duration;
};

function resolveDuration(duration: Duration = "default"): Duration {
  if (typeof duration === "string" && duration in predefinedDurations) {
    return predefinedDurations[duration];
  }
  return duration;
}

export const createLock = (resource: string, options: LockOptions = {}) =>
  verrou.createLock(`LOCK#${resource}`, resolveDuration(options.duration));

// ─── withLock — acquires, runs fn, always releases ──────────

export async function withLock<T>(
  resource: string,
  fn: () => Promise<T>,
  options?: LockOptions
): Promise<T> {
  const lock = createLock(resource, options);
  await lock.acquire();
  try {
    return await fn();
  } finally {
    await lock.release().catch(() => {});
  }
}

// ─── Lock key helpers ───────────────────────────────────────

export const lockKeys = {
  orderCreate: (userId: string, branchId: string) =>
    `order:create:${userId}:${branchId}`,
};
