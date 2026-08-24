import mongoose, { Schema } from "mongoose";
import { User, UserRole, Otp } from "./auth.types.js";

const userSchema = new Schema<User>(
    {
        phone: { type: String, required: true, unique: true, trim: true },
        name: { type: String, trim: true, default: "" },
        email: { type: String, trim: true, lowercase: true, default: "" },
        city: { type: String, trim: true, default: "" },
        gender: { type: String, enum: ["male", "female", "other", ""], default: "" },
        role: { type: String, enum: Object.values(UserRole), default: UserRole.User },
        isProfileComplete: { type: Boolean, default: false },
    },
    { timestamps: true }
);

export const UserModel = mongoose.model<User>("User", userSchema);

const otpSchema = new Schema<Otp>(
    {
        phone: { type: String, required: true, unique: true, index: true },
        codeHash: { type: String, required: true },
        expiresAt: { type: Date, required: true },
        attempts: { type: Number, default: 0 },
    },
    { timestamps: true }
);

export const OtpModel = mongoose.model<Otp>("Otp", otpSchema);
