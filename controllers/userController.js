import User from "../models/User.js";
import Token from "../models/Token.js";

export async function listUsers(req, res, next) {
  try {
    const includeDeleted = req.query.includeDeleted === "true";
    const filter = includeDeleted ? {} : { isDeleted: false };
    const users = await User.find(filter).select("-password").lean();
    res.json(users);
  } catch (err) {
    next(err);
  }
}

export async function updateRole(req, res, next) {
  try {
    const { id } = req.params;
    const { role } = req.body;
    if (!["Admin", "Editor", "Viewer"].includes(role)) return res.status(400).json({ message: "Invalid role" });
    const user = await User.findByIdAndUpdate(id, { role }, { new: true }).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    // revoke existing sessions (recommended)
    await Token.updateMany({ user: id, type: "refresh" }, { revoked: true });

    res.json(user);
  } catch (err) {
    next(err);
  }
}

export async function softDeleteUser(req, res, next) {
  try {
    const { id } = req.params;
    const user = await User.findByIdAndUpdate(id, { isDeleted: true }, { new: true }).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    // revoke tokens
    await Token.updateMany({ user: id }, { revoked: true });
    res.json({ message: "User deactivated (soft deleted)" });
  } catch (err) {
    next(err);
  }
}

// Restore user (Admin)
export async function restoreUser(req, res, next) {
  try {
    const { id } = req.params;
    const user = await User.findByIdAndUpdate(id, { isDeleted: false }, { new: true }).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ message: "User restored", user });
  } catch (err) {
    next(err);
  }
}
