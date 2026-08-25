import { ApiError } from "../../utils/api-error.js";
import { UserGender } from "./auth.types.js";

const PHONE_REGEX = /^[6-9]\d{9}$/;
const OTP_REGEX = /^\d{6}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizePhone = (value: unknown): string => {
    if (typeof value !== "string" && typeof value !== "number") {
        throw new ApiError(400, "Phone number is required");
    }

    const raw = String(value).trim();
    if (!raw) {
        throw new ApiError(400, "Phone number is required");
    }

    const digits = raw.replace(/\D/g, "").slice(-10);
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
    photo?: string;
}

export const validateProfile = (body: Record<string, unknown>): ProfileInput => {
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const city = typeof body?.city === "string" ? body.city.trim() : "";
    const photo = typeof body?.photo === "string" ? body.photo.trim() : "";
    const gender = ["male", "female", "other"].includes(String(body?.gender))
        ? (body.gender as UserGender)
        : "";

    if (!name) {
        throw new ApiError(400, "Name is required to complete your profile");
    }
    if (email && !EMAIL_REGEX.test(email)) {
        throw new ApiError(400, "Invalid email address");
    }

    return { name, email, city, gender, photo };
};

export interface ProfileUpdateInput {
    name?: string;
    city?: string;
    photo?: string;
}

export const validateProfileUpdate = (
    body: Record<string, unknown>
): ProfileUpdateInput => {
    const name = typeof body?.name === "string" ? body.name.trim() : undefined;
    const city = typeof body?.city === "string" ? body.city.trim() : undefined;
    const photo =
        typeof body?.photo === "string" ? body.photo.trim() : undefined;

    const result: ProfileUpdateInput = {};
    if (name !== undefined) {
        result.name = name;
    }
    if (city !== undefined) {
        result.city = city;
    }
    if (photo !== undefined) {
        result.photo = photo;
    }

    return result;
};
