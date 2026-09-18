export interface IQrSettings {
    /** Singleton document key — always "hall". */
    key: string;

    /** Name of the account that owns the UPI / bank account. */
    bankHolderName: string;

    /** QR image URL (Cloudinary upload from the CEO app). */
    qrUrl: string;

    /** Phone of the CEO who last saved the settings (audit only). */
    updatedByPhone?: string;

    createdAt: Date;

    updatedAt: Date;
}

/**
 * Shape returned to the mobile app.
 * Before the CEO uploads anything the document does not exist, so both
 * values come back as `null` (the app then shows the upload form).
 */
export interface PublicQrSettings {
    bankHolderName: string | null;
    qrUrl: string | null;
    isConfigured: boolean;
    updatedAt: Date | null;
}