import { Router } from "express";
import * as controller from "../controllers/links";
import { requireSession } from "../middlewares/session";
import { databaseRateLimit } from "../middlewares/rateLimit";
export const router = Router();
router.get("/s/:code", controller.redirect);
router.post("/internal/links/:id/ownership", controller.ownership);
router.post("/internal/links/summary", controller.summary);
router.use("/api/links", requireSession);
router.post(
  "/api/links",
  databaseRateLimit("create", 100, 3600),
  controller.create,
);
router.get("/api/links", controller.list);
router.get("/api/links/:id/qr", controller.qr);
router.get("/api/links/:id", controller.detail);
router.patch("/api/links/:id", controller.update);
