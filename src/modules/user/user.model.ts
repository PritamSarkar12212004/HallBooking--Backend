import mongoose, { Schema } from "mongoose";
import { IUserDb } from "./user.type.js";

const userSchema = new Schema<IUserDb>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },

        phone: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },

        email: {
            type: String,
            unique: true,
            sparse: true,
            lowercase: true,
            trim: true,
        },

        password: {
            type: String,
            required: true,
            select: false,
        },

        avatar: {
            type: String,
            default: null,
        },

        role: {
            type: String,
            enum: ["CEO", "OFFICE", "STAFF"],
            default: "STAFF",
            required: true,
        },

        fcmToken: {
            type: String,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

const User = mongoose.model<IUserDb>("User", userSchema);

export default User;