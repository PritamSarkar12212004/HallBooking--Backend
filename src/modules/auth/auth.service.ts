import crypto from "crypto";
import { OtpModel, UserModel } from "./auth.model.js";
import { ApiError } from "../../utils/api-error.js";
import { signToken } from "../../utils/jwt.service.js";
import { sendOtpSms } from "../../utils/sms.service.js";
import {
    SendOtpResult,
    VerifyOtpResult,
    PublicUser,
    UserGender,
    UserRole,
} from "./auth.types.js";

const OTP_EXPIRATION_SECONDS = Number(process.env.OTP_EXPIRATION_SECONDS) || 15;
const OTP_LENGTH = 6;
const MAX_OTP_ATTEMPTS = 5;

const generateOtp = (): string => {
    const otp = "123456"
    return otp;
};

const otpHash = (code: string): string =>
    crypto.createHash("sha256").update(code).digest("hex");

const toPublicUser = (doc: { _id: unknown } & UserShape): PublicUser => {
    const publicUser: PublicUser = {
        _id: String(doc._id),
        phone: doc.phone,
        name: doc.name,
        email: doc.email,
        city: doc.city,
        gender: doc.gender,
        role: doc.role,
        isProfileComplete: doc.isProfileComplete,
    };

    if (doc.photo) {
        publicUser.photo = doc.photo;
    }

    return publicUser;
};

const isUserProfileComplete = (doc: UserShape): boolean =>
    Boolean(doc.name && doc.city && doc.gender);

export const sendOtp = async (phone: string): Promise<SendOtpResult> => {
    const code = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_EXPIRATION_SECONDS * 1000);

    await OtpModel.findOneAndUpdate(
        { phone },
        { codeHash: otpHash(code), expiresAt, attempts: 0 },
        { upsert: true, setDefaultsOnInsert: true }
    );

    await sendOtpSms({ phone, code });

    return {
        expiresInSeconds: OTP_EXPIRATION_SECONDS,
        ...(process.env.NODE_ENV !== "production" ? { devOtp: code } : {}),
    };
};

export const verifyOtp = async (phone: string, code: string): Promise<VerifyOtpResult> => {
    const record = await OtpModel.findOne({ phone });

    if (!record) {
        throw new ApiError(400, "No OTP found for this number. Please request a new one.");
    }
    if (record.expiresAt.getTime() < Date.now()) {
        throw new ApiError(400, "OTP has expired. Please request a new one.");
    }
    if (record.attempts >= MAX_OTP_ATTEMPTS) {
        throw new ApiError(400, "Too many wrong attempts. Please request a new OTP.");
    }
    if (otpHash(code) !== record.codeHash) {
        await OtpModel.updateOne({ phone }, { $inc: { attempts: 1 } });
        throw new ApiError(400, "Invalid OTP. Please try again.");
    }

    await OtpModel.deleteOne({ phone });

    const existing = await UserModel.findOne({ phone });
    if (existing) {
        const token = signToken({
            userId: String(existing._id),
            phone: existing.phone,
            role: existing.role,
        });

        // A user is considered "new" until their profile is complete. This
        // matters for accounts that were created as a bare record (phone only)
        // but whose profile setup was never finished.
        return {
            isNewUser: !isUserProfileComplete(existing),
            isExistingUser: true,
            token,
            user: toPublicUser(existing),
        };
    }

    // New number -> create a bare account; frontend will run profile setup.
    const user = await UserModel.create({ phone });
    const token = signToken({
        userId: String(user._id),
        phone: user.phone,
        role: user.role,
    });
    return { isNewUser: true, isExistingUser: false, token, user: toPublicUser(user) };
};

type UserShape = {
    phone: string;
    name: string;
    email: string;
    city: string;
    gender: UserGender;
    photo?: string;
    role: UserRole;
    isProfileComplete: boolean;
};

export interface CompleteProfileInput {
    phone: string;
    name: string;
    email: string;
    city: string;
    gender: string;
    photo?: string;
}

export const completeProfile = async (input: CompleteProfileInput): Promise<VerifyOtpResult> => {
    const user = await UserModel.findOne({ phone: input.phone });
    if (!user) {
        throw new ApiError(404, "User not found. Please verify your OTP first.");
    }

    user.name = input.name;
    user.email = input.email;
    user.city = input.city;
    user.gender = input.gender as UserGender;
    if (input.photo) {
        user.photo = input.photo;
    }
    user.isProfileComplete = true;
    await user.save();

    const token = signToken({
        userId: String(user._id),
        phone: user.phone,
        role: user.role,
    });

    return { isNewUser: false, isExistingUser: true, token, user: toPublicUser(user) };
};