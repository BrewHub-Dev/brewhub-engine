import { z } from "zod";

export const shopSchema = z.object({
  name: z.string().min(1),
  address: z.object({
    street: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(1),
    zip: z.string().min(1),
    country: z.string().min(1),
  }),
  phone: z.string().min(7),
  emailAddress: z.email(),
});

export type Shop = z.infer<typeof shopSchema>;
