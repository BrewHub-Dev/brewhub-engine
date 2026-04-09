import { db } from "@/db/mongo";
import { Favorite } from "./favorites.model";
import { ObjectId } from "mongodb";

const favorites = () => db.collection<Favorite>("favorites");
const items = () => db.collection("items");

export async function createFavorite(userId: ObjectId, itemId: ObjectId): Promise<Favorite> {
  const existing = await favorites().findOne({ userId, itemId });
  if (existing) {
    return existing;
  }

  const favorite: Favorite = {
    userId,
    itemId,
    createdAt: new Date(),
  };

  await favorites().insertOne(favorite as Favorite);
  return favorite;
}

export async function getFavoritesByUserId(userId: ObjectId): Promise<Favorite[]> {
  return favorites()
    .find({ userId })
    .sort({ createdAt: -1 })
    .toArray() as Promise<Favorite[]>;
}

export interface FavoriteWithItem extends Favorite {
  item?: {
    _id: string;
    name: string;
    description?: string;
    price: number;
    images?: string[];
    rating?: number;
  };
}

export async function getFavoritesWithItems(userId: ObjectId, shopId?: string): Promise<FavoriteWithItem[]> {
  const favs = await favorites()
    .find({ userId })
    .sort({ createdAt: -1 })
    .toArray();

  const itemIds = favs.map(f => f.itemId).filter(Boolean);
  
  if (itemIds.length === 0) return [];

  const filter: any = { _id: { $in: itemIds } };
  if (shopId) {
    filter.ShopId = new ObjectId(shopId);
  }

  const itemsCursor = await items().find(filter);
  const itemsList = await itemsCursor.toArray();
  
  const itemsMap = new Map(itemsList.map(i => [
    i._id.toString(),
    {
      _id: i._id.toString(),
      name: i.name,
      description: i.description,
      price: i.price,
      images: i.images,
      rating: i.rating,
      ShopId: i.ShopId?.toString(),
    }
  ]));

  return favs
    .map(fav => ({
      ...fav,
      item: itemsMap.get(fav.itemId.toString())
    }))
    .filter(fav => !shopId || fav.item?.ShopId === shopId);
}

export async function deleteFavorite(userId: ObjectId, itemId: ObjectId): Promise<boolean> {
  const result = await favorites().deleteOne({ userId, itemId });
  return result.deletedCount > 0;
}

export async function isFavorite(userId: ObjectId, itemId: ObjectId): Promise<boolean> {
  const favorite = await favorites().findOne({ userId, itemId });
  return !!favorite;
}
