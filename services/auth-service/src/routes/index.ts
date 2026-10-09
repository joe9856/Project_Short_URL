import { Router } from "express";
import * as controller from "../controllers/auth";
import { databaseRateLimit } from "../middlewares/rateLimit";
export const router = Router();
router.post(
  "/api/auth/register",
  databaseRateLimit("register", 10, 900),
  controller.register,
);
router.post(
  "/api/auth/login",
  databaseRateLimit("login", 30, 900),
  controller.login,
);
router.post("/api/auth/logout", controller.logout);
router.get("/api/auth/me", controller.me);
router.patch("/api/auth/me", controller.updateProfile);
router.post("/internal/sessions/verify", controller.me);
