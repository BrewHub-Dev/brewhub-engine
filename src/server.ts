import os from "node:os";
import { buildApp } from "./app";
import { connectDB } from "@/db/mongo";
import { redis } from "@/db/redis";
import { initWebSockets } from "./websockets";
import { logger } from "@/utils/logger";

const PORT = Number(process.env.PORT) || 3001;

const app = buildApp();

app.addHook("onRoute", (routeOptions: any) => {
  const methods = Array.isArray(routeOptions.method)
    ? routeOptions.method.join(",")
    : routeOptions.method;
  const action =
    routeOptions.config?.action ||
    routeOptions.handler?.name ||
    "anonymous";
  app.log.debug({ method: methods, url: routeOptions.url, action }, "route registered");
});

function printAvailableIPs() {
  const interfaces = os.networkInterfaces();
  logger.info("\n API disponible en:");
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.internal) continue;
      if (net.family === "IPv4") logger.info(`   http://${net.address}:${PORT}`);
      if (net.family === "IPv6") logger.info(`   http://[${net.address}]:${PORT}`);
    }
  }
}

const start = async () => {
  try {
    await connectDB();
    logger.info("MongoDB connected");

    await redis.ping();
    logger.info("[Redis] Ping OK");

    const address = await app.listen({ port: PORT, host: "::" });
    logger.info({ address }, "Backend corriendo");

    const corsOrigin = process.env.CORS_ORIGIN || "*";
    initWebSockets(app.server, corsOrigin);
    logger.info("WebSockets listos");

    printAvailableIPs();
  } catch (err) {
    logger.error({ err }, "Error al iniciar el servidor");
    process.exit(1);
  }
};

start();
