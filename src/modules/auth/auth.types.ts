export enum UserRole {
    User = "user",
    Admin = "admin",
}

export type UserGender = "male" | "female" | "other" | "";

export interface User {
    phone: string;
    name: string;
    email: string;
    city: string;
    gender: UserGender;
    role: UserRole;
    isProfileComplete: boolean;
}

export interface PublicUser extends User {
    _id: string;
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
    token: string;
    user: PublicUser;
}
