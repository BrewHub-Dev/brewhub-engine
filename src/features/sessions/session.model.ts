import { Schema, model, Types, Document } from "mongoose";

export interface ISession extends Document {
  user: Types.ObjectId;
  token: string;
  expiresAt: Date;
}

const sessionSchema = new Schema<ISession>(
  {
    user: { type: Types.ObjectId, ref: "User", required: true },
    token: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session = model<ISession>("sessions", sessionSchema);
