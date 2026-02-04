import { Types } from "mongoose";
import { Session } from "./session.model";

export const createSession = async (
  userId: Types.ObjectId | string,
  token: string,
  expiresAt: Date
) => {
  try {
    const user = new Types.ObjectId(userId);
    const session = await Session.create({ user: user, token, expiresAt });
    return session;
  } catch (err) {
    console.error("createSession error:", err);
    throw err;
  }
};

export const findSessionByToken = async (token: string) => {
  return Session.findOne({ token }).exec();
};

export const deleteSessionByToken = async (token: string) => {
  return Session.deleteOne({ token }).exec();
};

export const deleteSessionsByUser = async (userId: Types.ObjectId | string) => {
  return Session.deleteMany({ user: userId }).exec();
};

export const findSessionsByUser = async (userId: Types.ObjectId | string) => {
  return Session.find({ user: userId }).exec();
};

export const findActiveSessionsByUser = async (userId: Types.ObjectId | string) => {
  const user = new Types.ObjectId(userId);
  return Session.find({ user, expiresAt: { $gt: new Date() } }).exec();
};
