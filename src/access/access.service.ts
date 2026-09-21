import { ApiError } from "../utils/api-error.js";
import {
    ACCESS_GATE_ENV,
    ADMIN_ACCESS,
    CEO_ACCESS,
} from "./access.config.js";
import type { AccessEntry, AccessRole, ResolvedAccess } from "./access.type.js";

/**
 * Access list ke saare rules — config (code) + env dono ko ek jagah jodta hai.
 *
 * Screen / middleware ko sirf yahi functions use karne chahiye, taake whitelist
 * ka ek hi source of truth rahe.
 */

/** Error body me jaane wala code — frontend isi se "access hat gaya" pehchanta hai. */
export const ACCESS_DENIED_CODE = "ACCESS_DENIED";

const ACCESS_DENIED_MESSAGE =
    "This number is not authorised to use this app. Please contact the admin.";

/** `+91 98765-43210` jaise numbers ko 10-digit me normalize karta hai. */
export const normalizePhone = (phone?: string | null): string =>
    String(phone ?? "").replace(/\D/g, "").slice(-10);

const normalizeEnvPhones = (value?: string): string[] =>
    String(value ?? "")
        .split(",")
        .map((phone) => normalizePhone(phone))
        .filter((phone) => phone.length === 10);

const toEntries = (phones: string[], role: AccessRole): AccessEntry[] =>
    phones.map((phone) => ({
        phone,
        name: role === "CEO" ? "Ceo" : "Admin",
        role,
    }));

/** Whitelist check on/off? (`ACCESS_GATE_ENABLED=false` se band). */
export const isAccessGateEnabled = (): boolean => {
    const raw = String(process.env[ACCESS_GATE_ENV.enabled] ?? "")
        .trim()
        .toLowerCase();

    return raw !== "false" && raw !== "0" && raw !== "off";
};

/**
 * Poori access list — pehle CEO numbers, phir admins.
 *
 * Env ko pehle rakha gaya hai taake deploy ke waqt code ko chhue bina number
 * add kiya ja sake; duplicate number par pehli entry (yaani CEO) jeet jaati hai.
 */
export const listAccessEntries = (): AccessEntry[] => {
    const merged: AccessEntry[] = [
        ...toEntries(
            normalizeEnvPhones(process.env[ACCESS_GATE_ENV.ceo]),
            "CEO"
        ),
        ...CEO_ACCESS,
        ...toEntries(
            normalizeEnvPhones(process.env[ACCESS_GATE_ENV.admin]),
            "ADMIN"
        ),
        ...ADMIN_ACCESS,
    ];

    const seen = new Set<string>();
    const unique: AccessEntry[] = [];

    for (const entry of merged) {
        const phone = normalizePhone(entry.phone);
        if (phone.length !== 10 || seen.has(phone)) {
            continue;
        }

        seen.add(phone);
        unique.push({ ...entry, phone });
    }

    return unique;
};

/** Ek number ki entry (ya `null` jab allowed na ho). */
export const findAccessEntry = (
    phone?: string | null
): ResolvedAccess | null => {
    const value = normalizePhone(phone);
    if (value.length !== 10) {
        return null;
    }

    const entry = listAccessEntries().find((item) => item.phone === value);
    if (!entry) {
        return null;
    }

    return { ...entry, isCeo: entry.role === "CEO" };
};

/** Number app use kar sakta hai? (gate off hone par sab allowed). */
export const isNumberAllowed = (phone?: string | null): boolean =>
    !isAccessGateEnabled() || findAccessEntry(phone) !== null;

/** Number ka access role — `USER` jab gate off ho aur number list me na ho. */
export const resolveAccessRole = (phone?: string | null): AccessRole =>
    findAccessEntry(phone)?.role ?? "USER";

/** Number CEO list me hai? (gate se independent — QR/report ke liye). */
export const isCeoNumber = (phone?: string | null): boolean =>
    findAccessEntry(phone)?.isCeo === true;

/**
 * Gate — allowed na hone par `403 ACCESS_DENIED` throw karta hai.
 *
 * `send-otp` / `verify-otp` aur har authenticated request par lagta hai, isliye
 * koi bhi naya user (ya jiska access hata diya gaya) andar nahi aa paata.
 */
export const assertNumberAllowed = (phone?: string | null): ResolvedAccess => {
    const entry = findAccessEntry(phone);

    if (entry) {
        return entry;
    }

    if (!isAccessGateEnabled()) {
        return {
            phone: normalizePhone(phone),
            name: "Access gate off",
            role: "USER",
            isCeo: false,
        };
    }

    throw new ApiError(403, ACCESS_DENIED_MESSAGE, ACCESS_DENIED_CODE);
};

/** Boot log ke liye list (numbers masked nahi — internal log hai). */
export const describeAccessList = (): string =>
    listAccessEntries()
        .map((entry) => `${entry.phone} (${entry.role})`)
        .join(", ") || "(empty)";
