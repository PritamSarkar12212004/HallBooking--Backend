import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { AuthenticatedRequest } from "../../middlewares/token.middleware.js";
import { validateSaveQrSettings } from "./qr.validation.js";
import {
    getQrSettings as getQrSettingsService,
    saveQrSettings as saveQrSettingsService,
} from "./qr.service.js";

export const handleGetQrSettings = asyncHandler(
    async (_req: Request, res: Response): Promise<void> => {
        const data = await getQrSettingsService();

        res.status(200).json({
            success: true,
            message: "Payment QR settings fetched successfully",
            data,
        });
    }
);

export const handleSaveQrSettings = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = validateSaveQrSettings(req.body);
        const data = await saveQrSettingsService(input, req.user?.phone);

        res.status(200).json({
            success: true,
            message: "Payment QR saved successfully",
            data,
        });
    }
);
