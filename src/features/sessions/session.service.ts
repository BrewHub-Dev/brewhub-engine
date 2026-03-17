import { Types } from "mongoose";
import { randomBytes } from "node:crypto";
import { Session } from "./session.model";

export const generateRefreshToken = () => randomBytes(40).toString("hex");

export const createSession = async (
  userId: Types.ObjectId | string,
  token: string,
  expiresAt: Date,
  refreshToken: string,
  refreshExpiresAt: Date
) => {
  try {
    const user = new Types.ObjectId(userId);
    const session = await Session.create({ user, token, expiresAt, refreshToken, refreshExpiresAt });
    return session;
  } catch (err) {
    console.error("createSession error:", err);
    throw err;
  }
};

export const findSessionByToken = async (token: string) => {
  return Session.findOne({ token }).exec();
};

export const findSessionByRefreshToken = async (refreshToken: string) => {
  return Session.findOne({ refreshToken }).exec();
};

export const rotateSession = async (
  refreshToken: string,
  newToken: string,
  newExpiresAt: Date,
  newRefreshToken: string,
  newRefreshExpiresAt: Date
) => {
  return Session.findOneAndUpdate(
    { refreshToken },
    { token: newToken, expiresAt: newExpiresAt, refreshToken: newRefreshToken, refreshExpiresAt: newRefreshExpiresAt },
    { new: true }
  ).exec();
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
