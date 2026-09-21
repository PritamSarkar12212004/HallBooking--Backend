import type { AccessRole } from "../../access/access.type.js";

export enum UserRole {
    User = "user",
    Admin = "admin",
    Ceo = "ceo",
}

export type UserGender = "male" | "female" | "other" | "";

export interface User {
    phone: string;
    name: string;
    email: string;
    city: string;
    gender: UserGender;
    photo?: string;
    role: UserRole;
    isProfileComplete: boolean;
}

export interface PublicUser extends User {
    _id: string;
    /**
     * Access list (`src/access/access.config.ts`) ka role — app isi se CEO UI
     * deti hai. DB ke `role` se alag rakha gaya hai taake list update karte hi
     * (bina migration) sab jagah naya role lag jaaye.
     */
    accessRole: AccessRole;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface Otp {
    phone: string;
    codeHash: string;
    expiresAt: Date;
    attempts: number;
}

export interface SendOtpResult {
    expiresInSeconds: number;
    devOtp?: string;
}

export interface VerifyOtpResult {
    isNewUser: boolean;
    isExistingUser: boolean;
    token: string;
    user: PublicUser;
}
