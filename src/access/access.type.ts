/**
 * Access control ke types.
 *
 * Is app ko sirf wahi log use kar sakte hain jinke number `access.config.ts`
 * me (ya `CEO_PHONES` / `ADMIN_PHONES` env me) add hain — baaki koi bhi number
 * OTP verify hi nahi kar payega.
 */

/** App access ke roles. `CEO` ko extra (report/QR) powers milti hain. */
export type AccessRole = "CEO" | "ADMIN" | "USER";

/** Ek whitelisted number ki entry. */
export interface AccessEntry {
    /** 10 digit Indian mobile number (normalize ke baad). */
    phone: string;
    /** Display name — logs / UI me dikhta hai. */
    name: string;
    role: AccessRole;
}

/** Lookup ka result — entry + ek ready-made `isCeo` flag. */
export interface ResolvedAccess extends AccessEntry {
    isCeo: boolean;
}
