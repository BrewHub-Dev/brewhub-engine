import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { stripe, createPaymentIntent } from "./stripe.service";
import { ObjectId } from "mongodb";
import { markOrderAsPaid, setStripePaymentIntentId, getOrderById } from "../orders/orders.service";

const createPaymentIntentSchema = z.object({
  orderId: z.string(),
  currency: z.string().length(3).default("mxn"),
});

export const stripeRoutes: FastifyPluginAsync = async (app) => {
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

      const { orderId, currency } = parsed.data;

      const order = await getOrderById(new ObjectId(orderId));
      if (!order) {
        return reply.status(404).send({ error: "Order not found" });
      }
      if (order.paymentStatus === "paid") {
        return reply.status(400).send({ error: "Order is already paid" });
      }

      const paymentIntent = await createPaymentIntent(order.total, currency, {
        orderId,
        ...(req.auth?.identity?.userId && { userId: req.auth.identity.userId.toString() }),
      });

      try {
        await setStripePaymentIntentId(new ObjectId(orderId), paymentIntent.id);
      } catch (err) {
        console.error("[Stripe] Could not link payment intent to order:", err);
      }

      return { clientSecret: paymentIntent.client_secret };
    }
  );

  app.register(async (webhookApp) => {
    webhookApp.removeAllContentTypeParsers();
    webhookApp.addContentTypeParser(
      "application/json",
      { parseAs: "buffer" },
      (_req, body, done) => done(null, body)
    );

    webhookApp.post(
      "/stripe/webhook",
      { config: { action: "stripe.webhook" } },
      async (req, reply) => {
        const sig = req.headers["stripe-signature"];
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

        if (!sig || !webhookSecret) {
          return reply.status(400).send({ error: "Missing stripe signature or webhook secret" });
        }

        let event: Awaited<ReturnType<typeof stripe.webhooks.constructEventAsync>>;
        try {
          event = await stripe.webhooks.constructEventAsync(
            req.body as Buffer,
            sig,
            webhookSecret
          );
        } catch (err: any) {
          console.error("[Stripe] Webhook signature error:", err.message);
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
  });
};
