import { FastifyPluginAsync } from "fastify";
import { branchesSchema } from "./branches.model";
import { createBranch } from "./branches.service";

export const branchesRoutes: FastifyPluginAsync = async (app) => {
  app.post("/branches", { config: { action: "branches.create" } }, async (req, reply) => {
    try {
      const branchData = branchesSchema.parse(req.body);
      const branchCreated = await createBranch(branchData);
      reply.send(branchCreated);
    } catch (error) {
      reply.status(400).send({ error: (error as Error).message });
      console.error("Error creating branch:", error);
    }
  });
}
