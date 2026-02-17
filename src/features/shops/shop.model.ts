import { z } from "zod";

export const currencySchema = z.object({
  code: z.string().length(3), // MXN, USD, EUR
  symbol: z.string().min(1),
  exchangeRate: z.number().positive(),
  isDefault: z.boolean().optional(),
});

const paymentMethodSchema = z.object({
  provider: z.enum([
    "stripe",
    "paypal",
    "mercadopago",
    "adyen",
    "checkout",
    "manual"
  ]),
  type: z.enum([
    "card",
    "wallet",
    "bank_transfer",
    "cash",
    "voucher"
  ]),
  enabled: z.boolean(),
  countries: z.array(z.string().length(2)).optional(),
});


export const shopSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),

  active: z.boolean().default(true),

  address: z.object({
    street: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(1),
    zip: z.string().min(1),
    country: z.string().length(2),
  }),

  phone: z.string().min(7),
  emailAddress: z.email(),
  image: z.url().optional(),

  localization: z.object({
    country: z.string().length(2),
    language: z.string().min(2),
    timezone: z.string(),
  }),

  currency: z.object({
    baseCurrency: z.object({
      code: z.string().length(3),
      symbol: z.string(),
      decimals: z.number().int().min(0).max(4),
    }),
    supportedCurrencies: z.array(currencySchema),
  }),

  taxes: z.object({
    enabled: z.boolean(),
    type: z.enum(["VAT", "SALES_TAX", "NONE"]),
    percentage: z.number().min(0).max(100),
    includedInPrice: z.boolean(),
  }),

  pricing: z.object({
    roundingMode: z.enum(["UP", "DOWN", "HALF_UP"]),
    roundToDecimals: z.number().int().min(0).max(4),
  }),

  paymentMethods: z.array(
    paymentMethodSchema
  ),

  shipping: z.object({
    originCountry: z.string().length(2),
    international: z.boolean(),
    supportedCountries: z.array(z.string().length(2)),
  }),

    createdAt: z.date().optional(),
      updatedAt: z.date().optional(),
});

export type Shop = z.infer<typeof shopSchema>;
