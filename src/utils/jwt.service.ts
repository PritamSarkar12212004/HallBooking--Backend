import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";

import { ApiError } from "./api-error.js";

export interface AuthTokenPayload {
    userId: string;
    phone: string;
    role: string;
}

const JWT_SECRET = process.env.JWT_SECRET || "hallbooking_dev_secret";
const JWT_EXPIRES_IN: SignOptions["expiresIn"] =
    (process.env.JWT_EXPIRES_IN || "7d") as SignOptions["expiresIn"];

export const signToken = (payload: AuthTokenPayload): string =>
    jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as SignOptions);

/**
 * Token verify karta hai aur JWT errors ko **401** me badal deta hai.
 *
 * Pehle `jwt.verify` ka error seedha error middleware tak jaata tha, jahan wo
 * generic 500 (`jwt expired` / `invalid token`) ban jaata tha — client ise
 * "server down" samajhta hai aur login screen par bhejne ke bajaye khali data
 * dikhata rehta hai. Ab client ko saaf 401 milta hai, jisse wo session clear
 * karke dobara login karwa sakta hai.
 */
export const verifyToken = (token: string): AuthTokenPayload => {
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return decoded as AuthTokenPayload;
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            throw new ApiError(
                401,
                "Access token has expired. Please login again."
            );
        }
        if (error instanceof jwt.JsonWebTokenError) {
            throw new ApiError(401, "Invalid access token. Please login again.");
        }

        throw error;
    }
};