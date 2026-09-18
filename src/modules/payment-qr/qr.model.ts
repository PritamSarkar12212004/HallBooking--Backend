import mongoose, { Schema } from "mongoose";
import { IQrSettings } from "./qr.type.js";

/** Fixed key so the collection always holds a single hall settings document. */
export const QR_SETTINGS_KEY = "hall";

const qrSettingsSchema = new Schema<IQrSettings>(
    {
        key: {
            type: String,
            required: true,
            unique: true,
            default: QR_SETTINGS_KEY,
        },

        bankHolderName: {
            type: String,
            required: true,
            trim: true,
        },

        qrUrl: {
            type: String,
            required: true,
            trim: true,
        },

        updatedByPhone: {
            type: String,
            trim: true,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

const QrSettings =
    (mongoose.models.QrSettings as mongoose.Model<IQrSettings>) ||
    mongoose.model<IQrSettings>("QrSettings", qrSettingsSchema);

export default QrSettings;
