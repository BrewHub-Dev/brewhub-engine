import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyCookie from "@fastify/cookie";
import mongoose from "mongoose";
import { userRoutes } from "./features/users/user.routes";
import { sessionRoutes } from "./features/sessions/session.routes";

const app = Fastify();

app.register(cors, { origin: "*" });
app.register(fastifyCookie);
app.register(userRoutes);
app.register(sessionRoutes);

const PORT = 3001;

const start = async () => {
  try {
    const mongoUrl = process.env.CONN_URL || process.env.MONGO_URL;
    if (!mongoUrl) throw new Error("Missing CONN_URL / MONGO_URL environment variable");
    await mongoose.connect(mongoUrl);
    console.log("Mongoose connected");

    const address = await app.listen({ port: PORT });
    console.log(`Backend corriendo en ${address}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();
