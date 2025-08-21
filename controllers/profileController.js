import User from "../models/User.js";
import Token from "../models/Token.js";
import bcrypt from "bcrypt";
import { validationResult } from "express-validator";
import { genRandomToken, hashToken } from "../utils/tokens.js";
import { sendEmail } from "../utils/email.js";

const SALT_ROUNDS = 12;

// GET /api/profile
export async function getProfile(req, res, next) {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) { next(err); }
}

// PUT /api/profile
export async function updateProfile(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, email } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const now = new Date();
    const updates = [];

    if (name && name !== user.name) {
      updates.push({ field: "name", oldValue: user.name, newValue: name, updatedAt: now });
      user.name = name;
    }

    if (email && email !== user.email) {
      // check uniqueness
      const exists = await User.findOne({ email });
      if (exists) return res.status(400).json({ message: "Email already in use" });

      updates.push({ field: "email", oldValue: user.email, newValue: email, updatedAt: now });

      user.email = email;
      user.emailVerified = false;

      // send verification email (one-time)
      const rawToken = genRandomToken();
      const tokenHash = hashToken(rawToken);
      const expires = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24h
      await Token.create({ user: user._id, tokenHash, type: "verify", expiresAt: expires });

      const verifyUrl = `${process.env.BASE_URL}/api/auth/verify-email?token=${rawToken}&email=${encodeURIComponent(email)}`;
      await sendEmail({
        to: email,
        subject: "Verify your new email",
        text: `Please verify your new email: ${verifyUrl}`,
        html: `<p>Please verify your email by clicking <a href="${verifyUrl}">here</a></p>`
      });
    }

    if (updates.length) {
      user.profileUpdates = user.profileUpdates.concat(updates);
    }

    await user.save();
    res.json({ message: "Profile updated" });
  } catch (err) { next(err); }
}

// PUT /api/profile/password
export async function changePassword(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.isDeleted) return res.status(403).json({ message: "Account deactivated" });

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(400).json({ message: "Current password is incorrect" });

    const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
    user.password = hashed;

    // add profile update entry for password change (for audit — store no raw password)
    user.profileUpdates = user.profileUpdates.concat({
      field: "password",
      oldValue: "****",
      newValue: "****",
      updatedAt: new Date()
    });

    await user.save();

    // revoke all refresh tokens for this user (optional but recommended)
    await Token.updateMany({ user: user._id, type: "refresh" }, { revoked: true });

    // send notification email
    await sendEmail({
      to: user.email,
      subject: "Your password was changed",
      text: `Hi ${user.name},\n\nYour account password was changed. If this was not you, please contact support immediately.`,
      html: `<p>Hi ${user.name},</p><p>Your account password was changed. If this was not you, please contact support immediately.</p>`
    });

    res.json({ message: "Password updated" });
  } catch (err) { next(err); }
}

// DELETE /api/profile (soft-delete by user)
export async function softDeleteProfile(req, res, next) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.isDeleted) return res.status(400).json({ message: "Account already deactivated" });

    user.isDeleted = true;
    await user.save();

    // revoke tokens
    await Token.updateMany({ user: user._id }, { revoked: true });

    await sendEmail({
      to: user.email,
      subject: "Account deactivated",
      text: `Hi ${user.name},\n\nYour account was deactivated. To restore, contact admin or use the restore endpoint if available.`,
      html: `<p>Hi ${user.name},</p><p>Your account was deactivated.</p>`
    });

    res.json({ message: "Account deactivated" });
  } catch (err) { next(err); }
}
