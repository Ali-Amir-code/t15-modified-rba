import mongoose from "mongoose";

const tokenSchema = new mongoose.Schema({
  tokenId: { type: String },            // for refresh tokens (uuid)
  tokenHash: { type: String },          // for one-time tokens (verify/reset) hashed
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: { type: String, enum: ["refresh", "verify", "reset"], required: true },
  expiresAt: { type: Date, required: true },
  revoked: { type: Boolean, default: false },
  used: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model("Token", tokenSchema);
