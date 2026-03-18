import type { FastifyPluginAsync } from "fastify";
import { uploadRoutes } from "./upload.routes";

const plugin: FastifyPluginAsync = async (app) => {
  await app.register(uploadRoutes);
};

export default plugin;
