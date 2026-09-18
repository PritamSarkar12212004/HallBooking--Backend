import { Router } from "express";
import {
    handleGetQrSettings,
    handleSaveQrSettings,
} from "./qr.controller.js";
import { authenticate } from "../../middlewares/token.middleware.js";
import { requireCeo } from "../../middlewares/role.middleware.js";

export const paymentQrRouter = Router();

// Every logged in user reads it (payment screens show the QR),
// but only the CEO can change it.
paymentQrRouter.get("/", authenticate, handleGetQrSettings);
paymentQrRouter.put("/", authenticate, requireCeo, handleSaveQrSettings);

export default paymentQrRouter;
