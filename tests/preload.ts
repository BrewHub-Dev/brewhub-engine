import { mock } from "bun:test";

// ── Environment — must be set BEFORE any src module is imported ────────────
// auth.plugin.ts captures JWT_SECRET at module-load time; setting it here
// ensures it matches the value used by makeToken() in test helpers.
process.env.JWT_SECRET = "test-jwt-secret-brewhub";
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";

const _store = new Map<string, string>();

mock.module("@/db/redis", () => ({
  redis: {
    get:    async (key: string) => _store.get(key) ?? null,
    set:    async (key: string, value: string) => { _store.set(key, value); return "OK"; },
    setex:  async (key: string, _ttl: number, value: string) => { _store.set(key, value); return "OK"; },
    del:    async (...keys: string[]) => { keys.forEach((k) => _store.delete(k)); return keys.length; },
    ping:   async () => "PONG",
    keys:   async () => [],
  },
  redisKeys: {
    qrVerification: (hash: string) => `qr:${hash}`,
    dailyOrderCount: (id: string, d: string) => `count:${id}:${d}`,
    userSession: (id: string) => `sess:${id}`,
    productCache: (id: string) => `prod:${id}`,
  },
}));

mock.module("@/db/lock", () => ({
  withLock: async (_key: string, fn: () => Promise<unknown>) => fn(),
  lockKeys: {
    orderCreate: (userId: string, branchId: string) => `lock:${userId}:${branchId}`,
  },
}));

mock.module("@/websockets", () => ({
  initWebSockets: () => {},
  emitToUser:   () => {},
  emitToBranch: () => {},
  emitToShop:   () => {},
}));

mock.module("@/services/push.service", () => ({
  sendPushNotification: async () => {},
}));
