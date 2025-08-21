import express from "express";
import jwtAuth from "../middleware/auth.js";
import { body } from "express-validator";
import { getProfile, updateProfile, changePassword, softDeleteProfile } from "../controllers/profileController.js";

const router = express.Router();

router.use(jwtAuth);

router.get("/", getProfile);

router.put("/",
  body("name").optional().isLength({ min: 2 }).trim().escape(),
  body("email").optional().isEmail().normalizeEmail(),
  updateProfile
);

router.put("/password",
  body("currentPassword").exists().isLength({ min: 8 }),
  body("newPassword").isStrongPassword({ minLength: 8 }),
  changePassword
);

router.delete("/", softDeleteProfile);

export default router;
