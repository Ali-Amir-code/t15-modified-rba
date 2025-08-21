import express from "express";
import jwtAuth from "../middleware/auth.js";
import permit from "../middleware/permit.js";
import { listContent, createContent, updateContent, deleteContent } from "../controllers/contentController.js";

const router = express.Router();

router.use(jwtAuth);

router.get("/", listContent);
router.post("/", permit("Admin", "Editor"), createContent);
router.put("/:id", permit("Admin", "Editor"), updateContent);
router.delete("/:id", permit("Admin", "Editor"), deleteContent);

export default router;
