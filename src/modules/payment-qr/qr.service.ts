import QrSettings, { QR_SETTINGS_KEY } from "./qr.model.js";
import type { PublicQrSettings } from "./qr.type.js";
import type { SaveQrSettingsInput } from "./qr.validation.js";

/**
 * Until the CEO uploads a QR the document does not exist, so the API answers
 * with `null` values — the app then shows the upload form instead of a QR.
 */
const EMPTY_QR_SETTINGS: PublicQrSettings = {
    bankHolderName: null,
    qrUrl: null,
    isConfigured: false,
    updatedAt: null,
};

type QrSettingsDoc = {
    bankHolderName?: string | null;
    qrUrl?: string | null;
    updatedAt?: Date;
} | null;

const toPublicQrSettings = (doc: QrSettingsDoc): PublicQrSettings => {
    const bankHolderName = doc?.bankHolderName ?? null;
    const qrUrl = doc?.qrUrl ?? null;

    return {
        bankHolderName,
        qrUrl,
        isConfigured: Boolean(bankHolderName && qrUrl),
        updatedAt: doc?.updatedAt ?? null,
    };
};

export const getQrSettings = async (): Promise<PublicQrSettings> => {
    const doc = await QrSettings.findOne({ key: QR_SETTINGS_KEY }).lean();

    if (!doc) {
        return EMPTY_QR_SETTINGS;
    }

    return toPublicQrSettings(doc);
};

export const saveQrSettings = async (
    input: SaveQrSettingsInput,
    updatedByPhone?: string
): Promise<PublicQrSettings> => {
    const update: Record<string, unknown> = {
        bankHolderName: input.bankHolderName,
        qrUrl: input.qrUrl,
    };

    if (updatedByPhone) {
        update.updatedByPhone = updatedByPhone;
    }

    const doc = await QrSettings.findOneAndUpdate(
        { key: QR_SETTINGS_KEY },
        { $set: update },
        {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true,
            runValidators: true,
        }
    ).lean();

    return toPublicQrSettings(doc);
};
