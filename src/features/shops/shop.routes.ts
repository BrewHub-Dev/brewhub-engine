import { FastifyPluginAsync } from "fastify";
import { shopSchema } from "./shop.model";
import { createShop } from "./shop.service";

export const shopRoutes: FastifyPluginAsync = async (app) => {
  app.post("/shops", { config: { action: "shops.create" } }, async (req, reply) => {
    try {
      const shopData = shopSchema.parse(req.body);
      const shopCreated = await createShop(shopData);
      reply.send(shopCreated);
    } catch (error) {
      reply.status(400).send({ error: (error as Error).message });
      console.error("Error creating shop:", error);
    }
  });
}
