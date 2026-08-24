import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";

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

export const verifyToken = (token: string): AuthTokenPayload => {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded as AuthTokenPayload;
};