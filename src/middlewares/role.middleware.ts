import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/api-error.js";
import { AuthenticatedRequest } from "./token.middleware.js";

/**
 * Phone numbers allowed to change hall level settings (payment QR).
 * Same whitelist the mobile app uses to show the CEO experience.
 */
const DEFAULT_CEO_PHONES = ["7796419792"];

/** Roles that are allowed even when the phone is not whitelisted. */
const CEO_ROLES: readonly string[] = ["CEO", "ADMIN"];

const normalizePhone = (phone?: string): string =>
    String(phone ?? "").replace(/\D/g, "").slice(-10);

const ceoPhones = (): string[] => {
    const fromEnv = (process.env.CEO_PHONES ?? "")
        .split(",")
        .map(normalizePhone)
        .filter((phone) => phone.length === 10);

    return fromEnv.length > 0 ? fromEnv : DEFAULT_CEO_PHONES;
};

/**
 * Allows only the hall CEO (role based OR whitelisted phone) to continue.
 * The JWT carries the phone, so the whitelist works even for accounts whose
 * `role` was never promoted to admin in the database.
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

        const role = String(user.role ?? "").toUpperCase();
        const hasCeoRole = CEO_ROLES.indexOf(role) !== -1;
        const isCeoPhone = ceoPhones().includes(normalizePhone(user.phone));

        if (!hasCeoRole && !isCeoPhone) {
            throw new ApiError(403, "Only the CEO can update the hall payment QR");
        }

        next();
    } catch (error) {
        next(error);
    }
};
