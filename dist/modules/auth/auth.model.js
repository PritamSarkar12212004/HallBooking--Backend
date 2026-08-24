import mongoose, { Schema } from "mongoose";
import { UserRole } from "./auth.types.js";
const userSchema = new Schema({
    phone: { type: String, required: true, unique: true, trim: true },
    name: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    city: { type: String, trim: true, default: "" },
    gender: { type: String, enum: ["male", "female", "other", ""], default: "" },
    photo: { type: String, default: null },
    role: { type: String, enum: Object.values(UserRole), default: UserRole.User },
    isProfileComplete: { type: Boolean, default: false },
}, { timestamps: true });
export const UserModel = mongoose.model("User", userSchema);
const otpSchema = new Schema({
    phone: { type: String, required: true, unique: true, index: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
}, { timestamps: true });
export const OtpModel = mongoose.model("Otp", otpSchema);
//# sourceMappingURL=auth.model.js.map