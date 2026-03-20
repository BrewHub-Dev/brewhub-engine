import type { FastifyPluginAsync } from "fastify";
import multipart from "@fastify/multipart";
import { uploadImageBuffer } from "@/services/cloudinary.service";
import { requirePermission } from "@/middleware/permissions.middleware";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export const uploadRoutes: FastifyPluginAsync = async (app) => {
  await app.register(multipart, {
    limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  });

  app.post(
    "/upload/image",
    {
      config: { action: "upload.image" },
      preHandler: [app.authenticate, requirePermission("items:create")],
    },
    async (req, reply) => {
      try {
        const data = await req.file();

        if (!data) {
          return reply.status(400).send({ error: "No se recibió ningún archivo" });
        }

        if (!ALLOWED_MIME.has(data.mimetype)) {
          return reply.status(400).send({
            error: "Tipo de archivo no permitido. Solo JPEG, PNG, WebP o GIF.",
          });
        }

        const buffer = await data.toBuffer();

        const shopId = req.auth?.identity.shopId?.toString() ?? "shared";
        const folder = `${shopId}/items`;
        const publicId = `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const result = await uploadImageBuffer(buffer, { folder, publicId });

        reply.send({ url: result.url, publicId: result.publicId });
      } catch (error) {
        console.error("[Upload] Error uploading image:", error);
        reply.status(500).send({ error: (error as Error).message });
      }
    }
  );
};
