/**
 * Script de Inserción de Datos de Prueba - Multi-Tenant
 * Ejecutar: bun scripts/seed-data.ts
 */

import { db } from "../src/db/mongo";
import { ObjectId } from "mongodb";
import mongoose from "mongoose";
import { hash } from "bcryptjs";

async function connectDB() {
  const mongoUrl = process.env.CONN_URL || process.env.MONGO_URL;
  if (!mongoUrl) throw new Error("Missing CONN_URL / MONGO_URL");

  await mongoose.connect(mongoUrl, {
    dbName: process.env.DB_NAME,
  });
  console.log("✅ Connected to MongoDB");
}

async function clearData() {
  console.log("\n🗑️  Clearing existing data...");

  await db.collection("shops").deleteMany({});
  await db.collection("branches").deleteMany({});
  await db.collection("categories").deleteMany({});
  await db.collection("items").deleteMany({});
  await db.collection("users").deleteMany({});
  await db.collection("invitations").deleteMany({});
  await db.collection("orders").deleteMany({});

  console.log("✅ Data cleared");
}

async function seedShops() {
  console.log("\n🏪 Creating shops...");

  await db.collection("shops").insertMany([
    {
      _id: new ObjectId("660000000000000000000001"),
      name: "Café del Centro",
      slug: "cafe-del-centro",
      active: true,
      address: {
        street: "Av. Reforma 123",
        city: "Ciudad de México",
        state: "CDMX",
        zip: "06600",
        country: "MX",
      },
      phone: "+52 55 1234 5678",
      emailAddress: "contacto@cafedelcentro.com",
      image: "https://via.placeholder.com/400x400?text=Cafe+Centro",
      localization: {
        country: "MX",
        language: "es",
        timezone: "America/Mexico_City",
      },
      currency: {
        baseCurrency: { code: "MXN", symbol: "$", decimals: 2 },
        supportedCurrencies: [
          { code: "MXN", symbol: "$", exchangeRate: 1, isDefault: true },
        ],
      },
      taxes: {
        enabled: true,
        type: "VAT",
        percentage: 16,
        includedInPrice: true,
      },
      pricing: {
        roundingMode: "HALF_UP",
        roundToDecimals: 2,
      },
      paymentMethods: [
        { provider: "manual", type: "cash", enabled: true },
        { provider: "stripe", type: "card", enabled: true },
      ],
      shipping: {
        originCountry: "MX",
        international: false,
        supportedCountries: ["MX"],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: new ObjectId("660000000000000000000002"),
      name: "Coffee House",
      slug: "coffee-house",
      active: true,
      address: {
        street: "Blvd. Insurgentes 456",
        city: "Guadalajara",
        state: "Jalisco",
        zip: "44100",
        country: "MX",
      },
      phone: "+52 33 9876 5432",
      emailAddress: "hola@coffeehouse.mx",
      image: "https://via.placeholder.com/400x400?text=Coffee+House",
      localization: {
        country: "MX",
        language: "es",
        timezone: "America/Mexico_City",
      },
      currency: {
        baseCurrency: { code: "MXN", symbol: "$", decimals: 2 },
        supportedCurrencies: [
          { code: "MXN", symbol: "$", exchangeRate: 1, isDefault: true },
        ],
      },
      taxes: {
        enabled: true,
        type: "VAT",
        percentage: 16,
        includedInPrice: true,
      },
      pricing: {
        roundingMode: "HALF_UP",
        roundToDecimals: 2,
      },
      paymentMethods: [
        { provider: "manual", type: "cash", enabled: true },
      ],
      shipping: {
        originCountry: "MX",
        international: false,
        supportedCountries: ["MX"],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);

  console.log("✅ Shops created: 2");
}

async function seedBranches() {
  console.log("\n🏢 Creating branches...");

  await db.collection("branches").insertMany([
    {
      _id: new ObjectId("661000000000000000000001"),
      name: "Sucursal Norte",
      address: {
        street: "Av. Polanco 789",
        city: "Ciudad de México",
        state: "CDMX",
        zip: "11560",
        country: "MX",
      },
      phone: "+52 55 1111 2222",
      ShopId: new ObjectId("660000000000000000000001"),
      active: true,
      location: { lat: 19.4326, lng: -99.1332 },
      timezone: "America/Mexico_City",
    },
    {
      _id: new ObjectId("661000000000000000000002"),
      name: "Sucursal Sur",
      address: {
        street: "Av. Insurgentes Sur 1500",
        city: "Ciudad de México",
        state: "CDMX",
        zip: "03900",
        country: "MX",
      },
      phone: "+52 55 3333 4444",
      ShopId: new ObjectId("660000000000000000000001"),
      active: true,
      location: { lat: 19.3629, lng: -99.1789 },
      timezone: "America/Mexico_City",
    },
    {
      _id: new ObjectId("661000000000000000000003"),
      name: "Principal",
      address: {
        street: "Blvd. Insurgentes 456",
        city: "Guadalajara",
        state: "Jalisco",
        zip: "44100",
        country: "MX",
      },
      phone: "+52 33 9876 5432",
      ShopId: new ObjectId("660000000000000000000002"),
      active: true,
      location: { lat: 20.6597, lng: -103.3496 },
      timezone: "America/Mexico_City",
    },
  ]);

  console.log("✅ Branches created: 3");
}

async function seedCategories() {
  console.log("\n📂 Creating categories...");

  await db.collection("categories").insertMany([
    {
      _id: new ObjectId("662000000000000000000001"),
      name: "Bebidas Calientes",
      description: "Café, té y bebidas calientes",
      ShopId: new ObjectId("660000000000000000000001"),
      active: true,
      order: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: new ObjectId("662000000000000000000002"),
      name: "Bebidas Frías",
      description: "Frappes, smoothies y bebidas heladas",
      ShopId: new ObjectId("660000000000000000000001"),
      active: true,
      order: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: new ObjectId("662000000000000000000003"),
      name: "Postres",
      description: "Pasteles, galletas y postres",
      ShopId: new ObjectId("660000000000000000000001"),
      active: true,
      order: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: new ObjectId("662000000000000000000004"),
      name: "Café",
      description: "Variedades de café",
      ShopId: new ObjectId("660000000000000000000002"),
      active: true,
      order: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: new ObjectId("662000000000000000000005"),
      name: "Snacks",
      description: "Bocadillos y snacks",
      ShopId: new ObjectId("660000000000000000000002"),
      active: true,
      order: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);

  console.log("✅ Categories created: 5");
}

async function seedItems() {
  console.log("\n☕ Creating items...");

  await db.collection("items").insertMany([
    {
      _id: new ObjectId("663000000000000000000001"),
      name: "Americano",
      description: "Café americano preparado con granos selectos",
      sku: "CAF-AME-001",
      barcode: "7501234567890",
      ShopId: new ObjectId("660000000000000000000001"),
      categoryId: new ObjectId("662000000000000000000001"),
      price: 35,
      cost: 15,
      active: true,
      taxIncluded: true,
      images: ["https://via.placeholder.com/400x400?text=Americano"],
      modifiers: [
        {
          name: "Tamaño",
          required: true,
          options: [
            { name: "Chico", extraPrice: 0 },
            { name: "Mediano", extraPrice: 5 },
            { name: "Grande", extraPrice: 10 },
          ],
        },
      ],
    },
    {
      _id: new ObjectId("663000000000000000000002"),
      name: "Latte",
      description: "Espresso con leche espumada",
      sku: "CAF-LAT-001",
      ShopId: new ObjectId("660000000000000000000001"),
      categoryId: new ObjectId("662000000000000000000001"),
      price: 45,
      cost: 20,
      active: true,
      taxIncluded: true,
      images: ["https://via.placeholder.com/400x400?text=Latte"],
    },
    {
      _id: new ObjectId("663000000000000000000003"),
      name: "Cappuccino",
      description: "Espresso con leche espumada y canela",
      sku: "CAF-CAP-001",
      ShopId: new ObjectId("660000000000000000000001"),
      categoryId: new ObjectId("662000000000000000000001"),
      price: 48,
      cost: 22,
      active: true,
      taxIncluded: true,
    },
    {
      _id: new ObjectId("663000000000000000000004"),
      name: "Frappe de Vainilla",
      description: "Bebida fría con café y vainilla",
      sku: "FRA-VAI-001",
      ShopId: new ObjectId("660000000000000000000001"),
      categoryId: new ObjectId("662000000000000000000002"),
      price: 55,
      cost: 25,
      active: true,
      taxIncluded: true,
    },
    {
      _id: new ObjectId("663000000000000000000005"),
      name: "Cheesecake",
      description: "Pastel de queso con frutos rojos",
      sku: "POS-CHE-001",
      ShopId: new ObjectId("660000000000000000000001"),
      categoryId: new ObjectId("662000000000000000000003"),
      price: 65,
      cost: 30,
      active: true,
      taxIncluded: true,
    },
    {
      _id: new ObjectId("663000000000000000000006"),
      name: "Espresso",
      description: "Café espresso intenso",
      sku: "ESP-001",
      ShopId: new ObjectId("660000000000000000000002"),
      categoryId: new ObjectId("662000000000000000000004"),
      price: 30,
      cost: 12,
      active: true,
      taxIncluded: true,
    },
    {
      _id: new ObjectId("663000000000000000000007"),
      name: "Croissant",
      description: "Croissant de mantequilla recién horneado",
      sku: "SNK-CRO-001",
      ShopId: new ObjectId("660000000000000000000002"),
      categoryId: new ObjectId("662000000000000000000005"),
      price: 40,
      cost: 18,
      active: true,
      taxIncluded: true,
    },
  ]);

  console.log("✅ Items created: 7");
}

async function seedUsers() {
  console.log("\n👥 Creating users...");

  const password = await hash("password123", 10);

  await db.collection("users").insertMany([
    {
      _id: new ObjectId("664000000000000000000001"),
      name: "Super",
      lastName: "Admin",
      username: "admin",
      password,
      emailAddress: "admin@brewhub.com",
      phone: "+52 55 0000 0000",
      role: "ADMIN",
      tenantId: null,
      tenants: [],
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: new ObjectId("664000000000000000000002"),
      name: "María",
      lastName: "González",
      username: "maria.gonzalez",
      password,
      emailAddress: "maria@cafedelcentro.com",
      phone: "+52 55 1234 5678",
      role: "SHOP_ADMIN",
      tenantId: new ObjectId("660000000000000000000001"),
      tenants: [
        {
          tenantId: new ObjectId("660000000000000000000001"),
          role: "SHOP_ADMIN",
          addedAt: new Date(),
        },
      ],
      ShopId: new ObjectId("660000000000000000000001"),
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: new ObjectId("664000000000000000000003"),
      name: "Carlos",
      lastName: "Ramírez",
      username: "carlos.ramirez",
      password,
      emailAddress: "carlos@cafedelcentro.com",
      phone: "+52 55 2222 3333",
      role: "BRANCH_ADMIN",
      tenantId: new ObjectId("660000000000000000000001"),
      tenants: [
        {
          tenantId: new ObjectId("660000000000000000000001"),
          role: "BRANCH_ADMIN",
          branchId: new ObjectId("661000000000000000000001"),
          addedAt: new Date(),
        },
      ],
      ShopId: new ObjectId("660000000000000000000001"),
      BranchId: new ObjectId("661000000000000000000001"),
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: new ObjectId("664000000000000000000004"),
      name: "Juan",
      lastName: "Pérez",
      username: "juan.perez",
      password,
      emailAddress: "juan@example.com",
      phone: "+52 55 9999 8888",
      role: "CLIENT",
      tenantId: new ObjectId("660000000000000000000001"),
      tenants: [
        {
          tenantId: new ObjectId("660000000000000000000001"),
          role: "CLIENT",
          addedAt: new Date(),
        },
      ],
      ShopId: new ObjectId("660000000000000000000001"),
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: new ObjectId("664000000000000000000005"),
      name: "Ana",
      lastName: "López",
      username: "ana.lopez",
      password,
      emailAddress: "ana@example.com",
      phone: "+52 33 7777 6666",
      role: "CLIENT",
      tenantId: new ObjectId("660000000000000000000001"),
      tenants: [
        {
          tenantId: new ObjectId("660000000000000000000001"),
          role: "CLIENT",
          addedAt: new Date(),
        },
        {
          tenantId: new ObjectId("660000000000000000000002"),
          role: "CLIENT",
          addedAt: new Date(),
        },
      ],
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);

  console.log("✅ Users created: 5 (password: password123)");
}

async function seedInvitations() {
  console.log("\n🎫 Creating invitations...");

  await db.collection("invitations").insertMany([
    {
      _id: new ObjectId("665000000000000000000001"),
      tenantId: new ObjectId("660000000000000000000001"),
      inviteCode: "CAFE-ABC-2024",
      type: "qr",
      branchId: null,
      maxUses: 100,
      usedCount: 2,
      expiresAt: new Date("2024-12-31"),
      metadata: {
        createdBy: new ObjectId("664000000000000000000002"),
        description: "QR para mostrador - Campaña 2024",
      },
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: new ObjectId("665000000000000000000002"),
      tenantId: new ObjectId("660000000000000000000002"),
      inviteCode: "COFFEE-XYZ-2024",
      type: "link",
      branchId: new ObjectId("661000000000000000000003"),
      maxUses: 50,
      usedCount: 0,
      expiresAt: new Date("2024-06-30"),
      metadata: {
        createdBy: new ObjectId("664000000000000000000002"),
        description: "Link para redes sociales",
      },
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: new ObjectId("665000000000000000000003"),
      tenantId: new ObjectId("660000000000000000000001"),
      inviteCode: "CAFE-PROMO-VIP",
      type: "qr",
      branchId: null,
      maxUses: null,
      usedCount: 15,
      expiresAt: null,
      metadata: {
        createdBy: new ObjectId("664000000000000000000002"),
        description: "QR permanente para clientes VIP",
      },
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);

  console.log("✅ Invitations created: 3");
}

async function showSummary() {
  console.log("\n📊 ===== RESUMEN =====");
  console.log(`Shops: ${await db.collection("shops").countDocuments()}`);
  console.log(`Branches: ${await db.collection("branches").countDocuments()}`);
  console.log(`Categories: ${await db.collection("categories").countDocuments()}`);
  console.log(`Items: ${await db.collection("items").countDocuments()}`);
  console.log(`Users: ${await db.collection("users").countDocuments()}`);
  console.log(`Invitations: ${await db.collection("invitations").countDocuments()}`);

  console.log("\n🔑 Credenciales de Prueba:");
  console.log("Admin: admin@brewhub.com / password123");
  console.log("SHOP_ADMIN: maria@cafedelcentro.com / password123");
  console.log("BRANCH_ADMIN: carlos@cafedelcentro.com / password123");
  console.log("CLIENT: juan@example.com / password123");
  console.log("CLIENT (Multi-Tenant): ana@example.com / password123");

  console.log("\n🎫 Códigos de Invitación:");
  console.log("CAFE-ABC-2024 (Café del Centro, QR, 100 usos)");
  console.log("COFFEE-XYZ-2024 (Coffee House, Link, 50 usos)");
  console.log("CAFE-PROMO-VIP (Café del Centro, QR, ilimitado)");
}

async function main() {
  try {
    await connectDB();

    const args = process.argv.slice(2);
    const shouldClear = args.includes("--clear");

    if (shouldClear) {
      await clearData();
    }

    await seedShops();
    await seedBranches();
    await seedCategories();
    await seedItems();
    await seedUsers();
    await seedInvitations();

    await showSummary();

    console.log("\n✅ ¡Seed completado con éxito!");
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

main();
