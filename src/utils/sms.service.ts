import { ApiError } from "./api-error.js";
import { logger } from "./logger.js";

export interface SendSmsResult {
    success: boolean;
    statusCode?: number;
    response?: string;
    message?: string;
    code?: string;
}

export interface SendSmsData {
    senderId?: string;
    templateId?: string;
    message?: string;
}

export interface SendOtpSmsParams {
    phone: string;
    code: string;
}

const DEFAULT_API_URL =
    "https://whatsapp-services-8t87.onrender.com/api/messaging/messages/send";

const DEFAULT_TEMPLATE_ID = "6aa397f544cd4f83cc61db41";

const DEFAULT_API_TOKEN =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ3cG51bWJlciI6Ijc3OTY0MTk3OTIiLCJ1c2VySWQiOiI2YTgwNDUyZGMwY2I5YjY0ZTY5OTA4MTIiLCJpYXQiOjE3ODkxMDg1NTR9.kAjBr1YpuDfM9FFXH6ZDD7ZLZRDWuadBWWiDrU2Psi0";

// Sends the number in international format — India's country code (91) is
// added automatically when the caller passes a local number.
const normalizePhone = (mobileNumber: string | number): string => {
    const digits = String(mobileNumber).replace(/\D/g, "");
    if (!digits) {
        return "";
    }
    return digits.startsWith("91") ? digits : `91${digits}`;
};

export const sendSms = async (
    mobileNumber: string | number,
    smsData: SendSmsData = {}
): Promise<SendSmsResult> => {
    try {
        const apiUrl = process.env.SMS_API_URL?.trim() || DEFAULT_API_URL;
        const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ3cG51bWJlciI6Ijc3OTY0MTk3OTIiLCJ1c2VySWQiOiI2YTgwNDUyZGMwY2I5YjY0ZTY5OTA4MTIiLCJpYXQiOjE3ODkxMDg1NTR9.kAjBr1YpuDfM9FFXH6ZDD7ZLZRDWuadBWWiDrU2Psi0";
        const templateId =
            smsData.templateId ||
            process.env.SMS_OTP_TEMPLATE_ID?.trim() ||
            DEFAULT_TEMPLATE_ID;

        if (!apiUrl) {
            throw new ApiError(500, "SMS_API_URL is missing in .env");
        }
        if (!token) {
            throw new ApiError(500, "SMS_API_TOKEN is missing in .env");
        }
        if (!templateId) {
            throw new ApiError(500, "SMS template ID is missing in .env");
        }
        if (!mobileNumber) {
            throw new ApiError(400, "Mobile number is required");
        }

        const to = normalizePhone(mobileNumber);
        if (!to) {
            throw new ApiError(400, "Invalid mobile number");
        }

        // OTP code → template variable (key configurable, default "code").
        const variables: Record<string, string> = {};
        if (smsData.message) {
            const key = process.env.SMS_API_VARIABLES_KEY?.trim() || "code";
            variables[key] = smsData.message;
        }

        logger.info("Sending message via messaging API", { to, templateId });

        // Apply a 30s timeout so a dead gateway cannot hang the request.
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);

        let response: Response;
        try {
            response = await fetch(apiUrl, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ to, template: templateId, variables }),
                signal: controller.signal,
            });
        } finally {
            clearTimeout(timeout);
        }

        const statusCode = response.status;
        const bodyText = await response.text();

        logger.info("Messaging API response", { statusCode, body: bodyText });

        let parsed: any = null;
        try {
            parsed = bodyText ? JSON.parse(bodyText) : null;
        } catch {
            parsed = null;
        }

        const success = statusCode >= 200 && statusCode < 300;

        return {
            success,
            statusCode,
            response: bodyText,
            message:
                parsed?.message ??
                parsed?.error ??
                (success ? undefined : `HTTP ${statusCode}`),
        };
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }

        logger.error("sendSms error", {
            message:
                error instanceof Error
                    ? error.message
                    : String(error),
        });

        throw new ApiError(
            502,
            error instanceof Error
                ? error.message
                : "Failed to send message"
        );
    }
};

/**
 * Send the OTP through the messaging API.
 *
 * The OTP code is passed in the template variable (default key "code") —
 * the platform substitutes it into the registered template.
 */
export const sendOtpSms = async ({
    phone,
    code,
}: SendOtpSmsParams): Promise<void> => {
    if (!phone) {
        throw new ApiError(400, "Phone number is required");
    }
    if (!code) {
        throw new ApiError(400, "OTP code is required");
    }

    try {
        const result = await sendSms(phone, { message: code });

        if (!result.success) {
            throw new ApiError(
                502,
                `Messaging gateway error (${result.statusCode ?? "unknown"}): ${result.response ||
                result.message ||
                "No response"
                }`
            );
        }

        logger.info(
            "OTP message sent successfully",
            {
                phone:
                    phone.replace(
                        /\d(?=\d{4})/g,
                        "*"
                    ),
            }
        );
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }

        logger.error(
            "OTP message failed",
            {
                message:
                    error instanceof Error
                        ? error.message
                        : String(error),
            }
        );

        throw new ApiError(
            502,
            error instanceof Error
                ? `Could not send OTP: ${error.message}`
                : "Could not send OTP"
        );
    }
};
