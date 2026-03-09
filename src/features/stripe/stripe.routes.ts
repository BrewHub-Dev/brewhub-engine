import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { stripe, createPaymentIntent } from "./stripe.service";
import { ObjectId } from "mongodb";
import { markOrderAsPaid } from "../orders/orders.service";

const createPaymentIntentSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().length(3).default("usd"),
  orderId: z.string().optional(),
});

export const stripeRoutes: FastifyPluginAsync = async (app) => {
  app.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (req, body, done) => {
      (req as any).rawBody = body;
      try {
        done(null, JSON.parse(body.toString()));
      } catch (err) {
        done(err as Error, undefined);
      }
    }
  );

  app.post(
    "/stripe/create-payment-intent",
    {
      config: { action: "stripe.createPaymentIntent" },
      preHandler: [app.authenticate],
    },
    async (req, reply) => {
      const parsed = createPaymentIntentSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }

      const { amount, currency, orderId } = parsed.data;

      const paymentIntent = await createPaymentIntent(amount, currency, {
        ...(orderId && { orderId }),
        ...(req.auth?.token && { userId: req.auth.token }),
      });

      return { clientSecret: paymentIntent.client_secret };
    }
  );

  app.post(
    "/stripe/webhook",
    { config: { action: "stripe.webhook" } },
    async (req, reply) => {
      const sig = req.headers["stripe-signature"];
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      if (!sig || !webhookSecret) {
        return reply.status(400).send({ error: "Missing stripe signature or webhook secret" });
      }

      let event: ReturnType<typeof stripe.webhooks.constructEvent>;
      try {
        event = stripe.webhooks.constructEvent(
          (req as any).rawBody,
          sig,
          webhookSecret
        );
      } catch (err: any) {
        return reply.status(400).send({ error: `Webhook Error: ${err.message}` });
      }

      switch (event.type) {
        case "payment_intent.succeeded": {
          const paymentIntent = event.data.object as any;
          console.log("[Stripe] Payment succeeded:", paymentIntent.id, "| orderId:", paymentIntent.metadata?.orderId);

          const orderIdStr = paymentIntent.metadata?.orderId;
          if (orderIdStr) {
            try {
              const orderId = new ObjectId(orderIdStr);
              await markOrderAsPaid(orderId, "card");
              console.log(`[Stripe] Successfully marked order ${orderIdStr} as paid`);
            } catch (err: any) {
              console.error(`[Stripe] Error marking order ${orderIdStr} as paid:`, err.message);
            }
          }
          break;
        }
        case "payment_intent.payment_failed": {
          const paymentIntent = event.data.object as any;
          console.warn("[Stripe] Payment failed:", paymentIntent.id);
          break;
        }
        default:
          console.log("[Stripe] Unhandled event type:", event.type);
      }

      return { received: true };
    }
  );
};
