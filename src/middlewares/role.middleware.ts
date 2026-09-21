import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/api-error.js";
import { AuthenticatedRequest } from "./token.middleware.js";
import { isCeoNumber, resolveAccessRole } from "../access/index.js";

/**
 * CEO-only endpoints (jaise hall ka payment QR) ke liye gate.
 *
 * Sirf `src/access/access.config.ts` ke `CEO_ACCESS` (ya `CEO_PHONES` env)
 * wale numbers hi pass hote hain — `ADMIN_ACCESS` wale nahi, kyunki app me ye
 * screen/action sirf CEO ko dikhta hai. Whitelist hi source of truth hai,
 * isliye purane token par bhi sahi role hi lagta hai.
 */

export const requireCeo = (
    req: Request,
    _res: Response,
    next: NextFunction
): void => {
    try {
        const user = (req as AuthenticatedRequest).user;
        if (!user) {
            throw new ApiError(401, "Access token is required");
        }

        // Access list ke hisaab se role (token purana ho to bhi sahi role mile).
        const role = (
            user.accessRole ?? resolveAccessRole(user.phone)
        ).toUpperCase();

        if (!isCeoNumber(user.phone) && role !== "CEO") {
            throw new ApiError(403, "Only the CEO can update the hall payment QR");
        }

        next();
    } catch (error) {
        next(error);
    }
};
