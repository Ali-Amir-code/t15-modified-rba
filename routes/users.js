import express from "express";
import jwtAuth from "../middleware/auth.js";
import permit from "../middleware/permit.js";
import { listUsers, updateRole, softDeleteUser, restoreUser } from "../controllers/userController.js";

const router = express.Router();

router.use(jwtAuth, permit("Admin"));

router.get("/", listUsers);
router.put("/:id/role", updateRole);
router.delete("/:id", softDeleteUser);
router.put("/:id/restore", restoreUser);

export default router;
