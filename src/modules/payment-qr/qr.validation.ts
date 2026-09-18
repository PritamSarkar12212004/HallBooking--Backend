import { ApiError } from "../../utils/api-error.js";

export const BANK_HOLDER_NAME_MIN_LENGTH = 3;
export const BANK_HOLDER_NAME_MAX_LENGTH = 80;
export const QR_URL_MAX_LENGTH = 2048;

// Starts with a letter, then letters / spaces / dot / apostrophe / hyphen.
const BANK_HOLDER_NAME_REGEX = /^[A-Za-z][A-Za-z .'-]*$/;

// Only real http(s) links — the CEO uploads a Cloudinary image URL.
const QR_URL_REGEX = /^https?:\/\/[^\s]+$/i;

const asString = (value: unknown): string =>
    typeof value === "string" ? value.trim() : "";

/** Collapses repeated whitespace so "Ramesh   Kumar" is stored as "Ramesh Kumar". */
export const normalizeBankHolderName = (value: unknown): string =>
    asString(value).replace(/\s+/g, " ");

export const validateBankHolderName = (value: unknown): string => {
    const name = normalizeBankHolderName(value);

    if (!name) {
        throw new ApiError(400, "Bank holder name is required");
    }
    if (name.length < BANK_HOLDER_NAME_MIN_LENGTH) {
        throw new ApiError(
            400,
            `Bank holder name must be at least ${BANK_HOLDER_NAME_MIN_LENGTH} characters`
        );
    }
    if (name.length > BANK_HOLDER_NAME_MAX_LENGTH) {
        throw new ApiError(
            400,
            `Bank holder name must be at most ${BANK_HOLDER_NAME_MAX_LENGTH} characters`
        );
    }
    if (!BANK_HOLDER_NAME_REGEX.test(name)) {
        throw new ApiError(
            400,
            "Bank holder name can only contain letters, spaces and . ' - characters"
        );
    }

    return name;
};

export const validateQrUrl = (value: unknown): string => {
    const url = asString(value);

    if (!url) {
        throw new ApiError(400, "QR code image is required");
    }
    if (url.length > QR_URL_MAX_LENGTH) {
        throw new ApiError(
            400,
            `QR image URL is too long (max ${QR_URL_MAX_LENGTH} characters)`
        );
    }
    if (!QR_URL_REGEX.test(url)) {
        throw new ApiError(400, "QR image must be a valid http(s) URL");
    }

    return url;
};

export interface SaveQrSettingsInput {
    bankHolderName: string;
    qrUrl: string;
}

export const validateSaveQrSettings = (
    body: Record<string, unknown>
): SaveQrSettingsInput => ({
    bankHolderName: validateBankHolderName(body?.bankHolderName),
    qrUrl: validateQrUrl(body?.qrUrl),
});
