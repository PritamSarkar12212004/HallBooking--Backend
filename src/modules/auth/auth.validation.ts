import { ApiError } from "../../utils/api-error.js";
import { UserGender } from "./auth.types.js";

const PHONE_REGEX = /^[6-9]\d{9}$/;
const OTP_REGEX = /^\d{6}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizePhone = (value: unknown): string => {
    if (typeof value !== "string" || !value.trim()) {
        throw new ApiError(400, "Phone number is required");
    }
    const digits = value.replace(/\D/g, "").slice(-10);
    if (!PHONE_REGEX.test(digits)) {
        throw new ApiError(400, "Invalid phone number. Must be a 10-digit Indian mobile number");
    }
    return digits;
};

export const validateOtpCode = (value: unknown): string => {
    if (typeof value !== "string" || !OTP_REGEX.test(value)) {
        throw new ApiError(400, "Invalid OTP. Must be 6 digits");
    }
    return value;
};

export interface ProfileInput {
    name: string;
    email: string;
    city: string;
    gender: UserGender;
}

export const validateProfile = (body: Record<string, unknown>): ProfileInput => {
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const city = typeof body?.city === "string" ? body.city.trim() : "";
    const gender = ["male", "female", "other"].includes(String(body?.gender))
        ? (body.gender as UserGender)
        : "";

    if (!name) {
        throw new ApiError(400, "Name is required to complete your profile");
    }
    if (email && !EMAIL_REGEX.test(email)) {
        throw new ApiError(400, "Invalid email address");
    }

    return { name, email, city, gender };
};
