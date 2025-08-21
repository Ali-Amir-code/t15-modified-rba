import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

export function genAccessToken(payload) {
  const secret = process.env.JWT_ACCESS_SECRET;
  const opts = { expiresIn: process.env.ACCESS_TOKEN_EXPIRES || "15m" };
  return jwt.sign(payload, secret, opts);
}

export function genRefreshTokenTokenId() {
  return uuidv4();
}

export function genRefreshTokenJWT(userId, tokenId) {
  const secret = process.env.JWT_REFRESH_SECRET;
  const opts = { expiresIn: process.env.REFRESH_TOKEN_EXPIRES || "7d" };
  return jwt.sign({ userId, tokenId }, secret, opts);
}

export function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}

export function genRandomToken() {
  // for email verify and password reset (single-use token string)
  return crypto.randomBytes(32).toString("hex");
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
