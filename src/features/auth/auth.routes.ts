import "@fastify/rate-limit";
import { FastifyPluginAsync } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { ObjectId } from "mongodb";
import { db } from "@/db/mongo";
import { validateInvitation, acceptInvitation } from "../invitations/invitation.service";
import { getShopById } from "../shops/shop.service";

const registerSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  emailAddress: z.email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  inviteCode: z.string().min(1, "El código de invitación es requerido"),
});

export const authRoutes: FastifyPluginAsync = async (app) => {
  /**
   * POST /auth/register
   * Registro público con código de invitación
   */
  app.post("/auth/register", { rateLimit: { max: 5, timeWindow: "1 minute" } }, async (req, reply) => {
    try {
      const body = registerSchema.parse(req.body);
      const { name, emailAddress, password, inviteCode } = body;

      const validation = await validateInvitation(inviteCode);

      if (!validation.valid || !validation.invitation) {
        return reply.status(400).send({
          error: validation.error || "Código de invitación inválido o expirado",
        });
      }

      const invitation = validation.invitation;

      const users = db.collection("users");
      const existingUser = await users.findOne({ emailAddress });

      if (existingUser) {
        return reply.status(400).send({
          error: "Este correo electrónico ya está registrado",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser: any = {
        name,
        lastName: "",
        username: emailAddress.split('@')[0],
        emailAddress,
        password: hashedPassword,
        phone: "",
        role: "CLIENT",
        active: true,
        tenantId: invitation.tenantId,
        tenants: [
          {
            tenantId: invitation.tenantId,
            role: "CLIENT" as const,
            branchId: invitation.branchId,
            addedAt: new Date(),
          },
        ],
        ShopId: invitation.tenantId,
        BranchId: invitation.branchId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await users.insertOne(newUser);

      await acceptInvitation(inviteCode);

      console.log("[Auth] New user registered:", result.insertedId);

      reply.status(201).send({
        ok: true,
        message: "Usuario registrado exitosamente",
        userId: result.insertedId,
      });
    } catch (error: any) {
      console.error("Error en registro:", error);

      if (error.name === "ZodError") {
        return reply.status(400).send({
          error: "Datos inválidos",
          details: error.errors,
        });
      }

      reply.status(500).send({
        error: error.message || "Error al registrar usuario",
      });
    }
  });

  const registerDirectSchema = z.object({
    name: z.string().min(1, "El nombre es requerido"),
    emailAddress: z.email("Email inválido"),
    password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
    tenantId: z.string().min(1, "El tenantId es requerido"),
  });

  app.post("/auth/register-direct", { rateLimit: { max: 5, timeWindow: "1 minute" } }, async (req, reply) => {
    try {
      const body = registerDirectSchema.parse(req.body);
      const { name, emailAddress, password, tenantId } = body;

      const shop = await getShopById(tenantId);
      if (!shop) {
        return reply.status(400).send({ error: "Tienda no encontrada" });
      }

      const users = db.collection("users");
      const existingUser = await users.findOne({ emailAddress });

      if (existingUser) {
        return reply.status(400).send({
          error: "Este correo electrónico ya está registrado",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const tenantObjectId = new ObjectId(tenantId);

      const newUser: any = {
        name,
        lastName: "",
        username: emailAddress.split("@")[0],
        emailAddress,
        password: hashedPassword,
        phone: "",
        role: "CLIENT",
        active: true,
        tenantId: tenantObjectId,
        tenants: [
          {
            tenantId: tenantObjectId,
            role: "CLIENT" as const,
            addedAt: new Date(),
          },
        ],
        ShopId: tenantObjectId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await users.insertOne(newUser);

      console.log("[Auth] New user registered (direct):", result.insertedId);

      reply.status(201).send({
        ok: true,
        message: "Usuario registrado exitosamente",
        userId: result.insertedId,
      });
    } catch (error: any) {
      console.error("Error en registro directo:", error);

      if (error.name === "ZodError") {
        return reply.status(400).send({
          error: "Datos inválidos",
          details: error.errors,
        });
      }

      reply.status(500).send({
        error: error.message || "Error al registrar usuario",
      });
    }
  });
};
