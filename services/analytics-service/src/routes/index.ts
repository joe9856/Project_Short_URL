import { Router } from "express";
import * as controller from "../controllers/analytics";
import { requireSession } from "../middlewares/session";
export const router = Router();
router.post("/internal/visits", controller.visit);
router.post("/internal/click-counts", controller.counts);
router.get("/api/stats", requireSession, controller.stats);
router.get("/api/links/:id/stats", requireSession, controller.stats);
