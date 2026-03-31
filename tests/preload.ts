/// <reference types="bun-types" />
import { mock } from "bun:test";


process.env.JWT_SECRET = "test-jwt-secret-brewhub";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
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

mock.module("@/features/stripe/stripe.service", () => ({
  stripe: {
    webhooks: {
      constructEventAsync: async (body: Buffer) => JSON.parse(body.toString()),
    },
    refunds: {
      create: async ({ payment_intent }: { payment_intent: string }) => ({
        id: "re_test_mock",
        payment_intent,
        status: "succeeded",
      }),
    },
  },
  createPaymentIntent: async (
    amount: number,
    currency: string,
    metadata: Record<string, string> = {}
  ) => ({
    id: "pi_test_mock",
    client_secret: "pi_test_mock_secret",
    amount: Math.round(amount * 100),
    currency,
    metadata,
  }),
  refundPaymentIntent: async (paymentIntentId: string) => ({
    id: "re_test_mock",
    payment_intent: paymentIntentId,
    status: "succeeded",
  }),
}));
