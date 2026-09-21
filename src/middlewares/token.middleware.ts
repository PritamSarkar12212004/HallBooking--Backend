import { Request, Response, NextFunction } from "express";
import { verifyToken, AuthTokenPayload } from "../utils/jwt.service.js";
import { ApiError } from "../utils/api-error.js";
import { assertNumberAllowed } from "../access/index.js";

export interface AuthenticatedRequest extends Request {
    user: AuthTokenPayload;
}

export const authenticate = (
    req: Request,
    _res: Response,
    next: NextFunction
): void => {
    try {
        const header = req.headers.authorization;
        if (!header || !header.startsWith("Bearer ")) {
            throw new ApiError(401, "Access token is required");
        }

        const token = header.split(" ")[1];
        if (!token) {
            throw new ApiError(401, "Access token is required");
        }

        const payload = verifyToken(token);

        // Access list gate — token purana ho ya session ke beech me access hata
        // diya gaya ho, dono case me yahan se 403 ACCESS_DENIED milega (frontend
        // ise session clear karke login par bhej deta hai).
        const access = assertNumberAllowed(payload.phone);

        (req as AuthenticatedRequest).user = {
            ...payload,
            role: access.role,
            accessRole: access.role,
        };
        next();
    } catch (error) {
        next(error);
    }
};
