import jwt from "jsonwebtoken";
import User from "../models/User.js";

export default async function jwtAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Missing token" });

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    } catch (err) {
      return res.status(401).json({ message: "Invalid or expired access token" });
    }

    const user = await User.findById(payload.id).select("-password");
    if (!user || user.isDeleted) return res.status(401).json({ message: "User not found or deactivated" });

    req.user = {
      id: user._id,
      role: user.role,
      email: user.email,
      name: user.name
    };
    next();
  } catch (err) {
    next(err);
  }
}
