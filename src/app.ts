import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyCookie from "@fastify/cookie";
import AutoLoad from "@fastify/autoload";
import rateLimit from "@fastify/rate-limit";
import * as path from "node:path";
import { authPlugin } from "@/auth/auth.plugin";
import { fastifyLoggerOptions } from "@/utils/logger";

export function buildApp() {
  const app = Fastify({
    logger: fastifyLoggerOptions,
    connectionTimeout: 30_000,
    keepAliveTimeout: 72_000,
  });

  app.register(cors, {
    origin: process.env.CORS_ORIGIN || "*",
    credentials: true,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
  });

  app.register(fastifyCookie);

  // Global rate limit: 200 req/min per IP
  app.register(rateLimit, {
    global: true,
    max: 200,
    timeWindow: "1 minute",
    errorResponseBuilder: () => ({
      error: "Too many requests — slow down",
      statusCode: 429,
    }),
  });

  app.register(authPlugin);

  app.register(AutoLoad, {
    dir: path.join(__dirname, "features"),
    dirNameRoutePrefix: false,
  });

  return app;
}
