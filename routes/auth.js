import express from "express";
import { body } from "express-validator";
import {
  register, verifyEmail, login, logout, token, forgotPassword, resetPassword
} from "../controllers/authController.js";

const router = express.Router();

router.post("/register",
  body("name").isLength({ min: 2 }).trim(),
  body("email").isEmail().normalizeEmail(),
  body("password").isLength({ min: 8, max: 32 }),
  register
);

router.get("/verify-email", verifyEmail);

router.post("/login",
  body("email").isEmail().normalizeEmail(),
  body("password").exists(),
  login
);

router.post("/logout", logout);

router.post("/token", token);

router.post("/forgot-password", body("email").isEmail().normalizeEmail(), forgotPassword);

router.post("/reset-password", resetPassword);

export default router;
