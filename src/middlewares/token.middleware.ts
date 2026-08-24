import { Request, Response, NextFunction } from "express";
import { verifyToken, AuthTokenPayload } from "../utils/jwt.service.js";
import { ApiError } from "../utils/api-error.js";

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

        (req as AuthenticatedRequest).user = verifyToken(token);
        next();
    } catch (error) {
        next(error);
    }
};
