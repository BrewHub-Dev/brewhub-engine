import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyCookie from "@fastify/cookie";
import AutoLoad from "@fastify/autoload";
import * as path from "node:path";
import mongoose from "mongoose";
import { authPlugin } from "@/auth/auth.plugin";
const app = Fastify({ logger: true });

app.addHook("onRoute", (routeOptions: any) => {
  const methods = Array.isArray(routeOptions.method)
    ? routeOptions.method.join(",")
    : routeOptions.method;
  const handlerName =
    routeOptions.config?.action || routeOptions.handler?.name || "anonymous";
  const timestamp = new Date().toISOString();

  console.log(
    `[${timestamp}] INFO  brewhub/API: ${String(methods).padStart(6)} ${routeOptions.url} => ${handlerName}`
  );
});

app.register(cors, {
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  credentials: true,
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
});
app.register(fastifyCookie);

void authPlugin(app, {});

app.register(AutoLoad, {
  dir: path.join(__dirname, "features"),
  dirNameRoutePrefix: false,
});

const PORT = process.env.PORT || 3001;

const start = async () => {
  try {
    const mongoUrl = process.env.CONN_URL || process.env.MONGO_URL;
    if (!mongoUrl) throw new Error("Missing CONN_URL / MONGO_URL environment variable");
    await mongoose.connect(mongoUrl, {
      dbName: process.env.DB_NAME,
    });
    console.log("Mongoose connected");

    const address = await app.listen({ port: Number(PORT), host: "0.0.0.0" });
    console.log(`Backend corriendo en ${address}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();
