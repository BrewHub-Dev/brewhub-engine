import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyCookie from "@fastify/cookie";
import AutoLoad from "@fastify/autoload";
import * as path from "node:path";
import mongoose from "mongoose";
import os from "node:os";
import { authPlugin } from "@/auth/auth.plugin";
import { redis } from "@/db/redis";
import { initWebSockets } from "./websockets";

const PORT = Number(process.env.PORT) || 3001;

const app = Fastify({
  logger: true,
  connectionTimeout: 30000,
  keepAliveTimeout: 72000,
});

app.addHook("onRoute", (routeOptions: any) => {
  const methods = Array.isArray(routeOptions.method)
    ? routeOptions.method.join(",")
    : routeOptions.method;

  const handlerName =
    routeOptions.config?.action ||
    routeOptions.handler?.name ||
    "anonymous";

  const timestamp = new Date().toISOString();

  console.log(
    `[${timestamp}] INFO  brewhub/API: ${String(methods).padStart(6)} ${routeOptions.url} => ${handlerName}`
  );
});

app.register(cors, {
  origin: process.env.CORS_ORIGIN || "*",
  credentials: true,
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
});

app.register(fastifyCookie);

void authPlugin(app, {});

app.register(AutoLoad, {
  dir: path.join(__dirname, "features"),
  dirNameRoutePrefix: false,
});

function printAvailableIPs() {
  const interfaces = os.networkInterfaces();

  console.log("\n API disponible en:");

  for (const name of Object.keys(interfaces)) {
    const nets = interfaces[name] || [];

    for (const net of nets) {
      if (net.internal) continue;

      if (net.family === "IPv4") {
        console.log(`   http://${net.address}:${PORT}`);
      }

      if (net.family === "IPv6") {
        console.log(`   http://[${net.address}]:${PORT}`);
      }
    }
  }

  console.log("");
}

const start = async () => {
  try {
    const mongoUrl = process.env.CONN_URL || process.env.MONGO_URL;

    if (!mongoUrl) {
      throw new Error("Missing CONN_URL / MONGO_URL environment variable");
    }

    await mongoose.connect(mongoUrl, {
      dbName: process.env.DB_NAME,
    });

    console.log("🍃 Mongoose connected");

    await redis.ping();
    console.log("[Redis] Ping OK");

    const address = await app.listen({
      port: PORT,
      host: "::",
    });

    console.log(`Backend corriendo en ${address}`);

    const corsOrigin = process.env.CORS_ORIGIN || "*";
    initWebSockets(app.server, corsOrigin);
    console.log("WebSockets listos en el servidor");

    printAvailableIPs();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();
