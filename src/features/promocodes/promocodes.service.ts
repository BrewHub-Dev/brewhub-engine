import { db } from "@/db/mongo";
import { ObjectId } from "mongodb";
import {
  promoCodeSchema,
  type PromoCode,
  type CreatePromoCodeInput,
} from "./promocodes.model";

export async function createPromoCode(data: CreatePromoCodeInput) {
  const validated = promoCodeSchema.parse(data);
  const col = db.collection("promocodes");

  const existing = await col.findOne({
    code: validated.code,
    shopId: new ObjectId(validated.shopId),
  });
  if (existing) {
    throw new Error("Ya existe un código con ese nombre");
  }

  const toInsert = {
    ...validated,
    shopId: new ObjectId(validated.shopId as string),
    branchId: validated.branchId
      ? new ObjectId(validated.branchId)
      : undefined,
    applicableItems: validated.applicableItems?.map((id) => id.toString()),
    applicableCategories: validated.applicableCategories?.map((id) => id.toString()),
    usesCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await col.insertOne(toInsert);
  return { ...toInsert, _id: result.insertedId };
}

export async function getPromoCodesByShop(shopId: string, branchId?: string) {
  const col = db.collection("promocodes");
  const filter: Record<string, unknown> = {
    shopId: new ObjectId(shopId),
  };

  if (branchId) {
    filter.$or = [
      { branchId: new ObjectId(branchId) },
      { branchId: { $exists: false } },
    ];
  } else {
    filter.branchId = { $exists: false };
  }

  return col.find(filter).sort({ createdAt: -1 }).toArray();
}

export async function getPromoCodeById(id: string) {
  const col = db.collection("promocodes");
  return col.findOne({ _id: new ObjectId(id) });
}

export async function getPromoCodeByCode(code: string, shopId: string, branchId?: string) {
  const col = db.collection("promocodes");
  const filter: Record<string, unknown> = {
    code: code.toUpperCase(),
    shopId: new ObjectId(shopId),
    isActive: true,
  };

  if (branchId) {
    filter.$or = [
      { branchId: new ObjectId(branchId) },
      { branchId: { $exists: false } },
    ];
  }

  return col.findOne(filter);
}

export async function updatePromoCode(
  id: string,
  shopId: string,
  updates: Partial<CreatePromoCodeInput>
) {
  const col = db.collection("promocodes");
  const toUpdate: Record<string, unknown> = { ...updates, updatedAt: new Date() };

  if (updates.shopId) {
    toUpdate.shopId = new ObjectId(updates.shopId);
  }
  if (updates.branchId) {
    toUpdate.branchId = new ObjectId(updates.branchId);
  }
  if (updates.applicableItems) {
    toUpdate.applicableItems = updates.applicableItems.map((id) => id.toString());
  }
  if (updates.applicableCategories) {
    toUpdate.applicableCategories = updates.applicableCategories.map((id) => id.toString());
  }

  delete toUpdate.code;
  delete toUpdate._id;
  delete toUpdate.usesCount;

  const result = await col.findOneAndUpdate(
    { _id: new ObjectId(id), shopId: new ObjectId(shopId) },
    { $set: toUpdate },
    { returnDocument: "after" }
  );
  if (!result) throw new Error("Promo code not found");
  return result;
}

export async function deletePromoCode(id: string, shopId: string) {
  const col = db.collection("promocodes");
  const result = await col.deleteOne({
    _id: new ObjectId(id),
    shopId: new ObjectId(shopId),
  });
  if (result.deletedCount === 0) throw new Error("Promo code not found");
  return true;
}

export async function invalidatePromoCode(id: string, shopId: string) {
  const col = db.collection("promocodes");
  const result = await col.findOneAndUpdate(
    { _id: new ObjectId(id), shopId: new ObjectId(shopId) },
    { $set: { isActive: false, updatedAt: new Date() } },
    { returnDocument: "after" }
  );
  if (!result) throw new Error("Promo code not found");
  return result;
}

function isWithinSchedule(promo: PromoCode): boolean {
  if (!promo.schedule) return true;

  const now = new Date();
  const dayOfWeek = now.getDay();
  const currentTime = now.toTimeString().slice(0, 5);

  if (promo.schedule.dayOfWeek?.length && !promo.schedule.dayOfWeek.includes(dayOfWeek)) {
    return false;
  }

  if (promo.schedule.startTime && currentTime < promo.schedule.startTime) {
    return false;
  }
  if (promo.schedule.endTime && currentTime > promo.schedule.endTime) {
    return false;
  }

  return true;
}

export async function calculateDiscount(
  promo: PromoCode,
  subtotal: number,
  items: { itemId: string; quantity: number; price: number; categoryId?: string }[]
): Promise<{ valid: boolean; discount: number; message: string }> {
  const now = new Date();

  if (!promo.isActive) {
    return { valid: false, discount: 0, message: "El código no está activo" };
  }

  if (promo.validFrom && now < promo.validFrom) {
    return { valid: false, discount: 0, message: "El código aún no es válido" };
  }

  if (promo.validUntil && now > promo.validUntil) {
    return { valid: false, discount: 0, message: "El código ha expirado" };
  }

  if (!isWithinSchedule(promo)) {
    return { valid: false, discount: 0, message: "El código no está disponible en este horario" };
  }

  if (promo.maxUses && promo.usesCount >= promo.maxUses) {
    return { valid: false, discount: 0, message: "Límite de usos alcanzado" };
  }

  if (promo.minOrderAmount && subtotal < promo.minOrderAmount) {
    return {
      valid: false,
      discount: 0,
      message: `Monto mínimo requerido: $${promo.minOrderAmount}`,
    };
  }

  let eligibleItems = items;
  if (promo.target === "items" && promo.applicableItems?.length) {
    eligibleItems = items.filter((item) =>
      promo.applicableItems?.includes(item.itemId)
    );
  } else if (promo.target === "categories" && promo.applicableCategories?.length) {
    eligibleItems = items.filter((item) =>
      promo.applicableCategories?.includes(item.categoryId ?? "")
    );
  }

  const eligibleSubtotal = eligibleItems.reduce(
    (sum, item) => sum + (item.price ?? 0) * item.quantity,
    0
  );

  let discount = 0;

  switch (promo.type) {
    case "percentage":
      discount = (eligibleSubtotal * promo.value) / 100;
      break;
    case "fixed":
      discount = promo.value;
      break;
    case "buy_x_get_y":
      if (promo.applicableItems?.length) {
        const itemCounts = eligibleItems.map((item) => ({
          itemId: item.itemId,
          quantity: item.quantity,
          price: item.price ?? 0,
        }));
        const buyQty = promo.value;
        const freeQty = Math.min(1, promo.maxDiscount ?? 1);
        for (const ic of itemCounts) {
          const sets = Math.floor(ic.quantity / (buyQty + freeQty));
          discount += ic.price * freeQty * sets;
        }
      }
      break;
  }

  if (promo.maxDiscount && discount > promo.maxDiscount) {
    discount = promo.maxDiscount;
  }

  const cappedDiscount = Math.min(discount, subtotal);

  return { valid: true, discount: Math.round(cappedDiscount * 100) / 100, message: "Aplicado" };
}

export async function applyPromoCodeUsage(id: string) {
  const col = db.collection("promocodes");
  await col.updateOne(
    { _id: new ObjectId(id) },
    { $inc: { usesCount: 1 }, $set: { updatedAt: new Date() } }
  );
}