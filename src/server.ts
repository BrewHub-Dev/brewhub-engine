import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyCookie from "@fastify/cookie";
import mongoose from "mongoose";
import { userRoutes } from "@/features/users/user.routes";
import { sessionRoutes } from "@/features/sessions/session.routes";
import { shopRoutes } from "@/features/shops/shop.routes";
import { branchesRoutes } from "./features/branches/branches.routes";
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

app.register(cors, { origin: "*" });
app.register(fastifyCookie);
app.register(userRoutes);
app.register(sessionRoutes);
app.register(shopRoutes);
app.register(branchesRoutes)

const PORT = 3001;

const start = async () => {
  try {
    const mongoUrl = process.env.CONN_URL || process.env.MONGO_URL;
    if (!mongoUrl) throw new Error("Missing CONN_URL / MONGO_URL environment variable");
    await mongoose.connect(mongoUrl, {
      dbName: process.env.DB_NAME,
    });
    console.log("Mongoose connected");

    const address = await app.listen({ port: PORT });
    console.log(`Backend corriendo en ${address}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();
