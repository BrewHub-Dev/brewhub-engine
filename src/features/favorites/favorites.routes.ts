import { FastifyPluginAsync } from "fastify";
import { ObjectId } from "mongodb";
import {
  createFavorite,
  getFavoritesWithItems,
  deleteFavorite,
} from "./favorites.service";

export const favoritesRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/favorites",
    {
      preHandler: app.authenticate,
      config: { action: "favorites.list" },
    },
    async (req, reply) => {
      try {
        const auth = req.auth;
        if (!auth) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        const { shopId } = req.query as { shopId?: string };
        const userId = auth.identity.userId;
        const favorites = await getFavoritesWithItems(userId, shopId);

        reply.send(favorites);
      } catch (e) {
        reply.status(500).send({ error: (e as Error).message });
      }
    }
  );

  app.post(
    "/favorites",
    {
      preHandler: app.authenticate,
      config: { action: "favorites.create" },
    },
    async (req, reply) => {
      try {
        const auth = req.auth;
        if (!auth) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        const { itemId } = req.body as { itemId: string };

        if (!itemId) {
          return reply.status(400).send({ error: "itemId is required" });
        }

        const userId = auth.identity.userId;
        const favorite = await createFavorite(userId, new ObjectId(itemId));

        reply.send(favorite);
      } catch (e) {
        reply.status(500).send({ error: (e as Error).message });
      }
    }
  );

  app.delete(
    "/favorites/:itemId",
    {
      preHandler: app.authenticate,
      config: { action: "favorites.delete" },
    },
    async (req, reply) => {
      try {
        const auth = req.auth;
        if (!auth) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        const { itemId } = req.params as { itemId: string };

        if (!itemId) {
          return reply.status(400).send({ error: "itemId is required" });
        }

        const userId = auth.identity.userId;
        const deleted = await deleteFavorite(userId, new ObjectId(itemId));

        if (!deleted) {
          return reply.status(404).send({ error: "Favorite not found" });
        }

        reply.send({ ok: true });
      } catch (e) {
        reply.status(500).send({ error: (e as Error).message });
      }
    }
  );
};
