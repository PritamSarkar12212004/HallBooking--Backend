import { ApiError } from "./api-error.js";
import { logger } from "./logger.js";
const DEFAULT_API_URL = "https://whatsapp-services-8t87.onrender.com/api/messaging/messages/send";
const DEFAULT_TEMPLATE_ID = "6aa397f544cd4f83cc61db41";
// Booking-confirmation template ("For any assistance, please contact us at …").
// Overridable per-environment via SMS_BOOKING_TEMPLATE_ID.
export const DEFAULT_BOOKING_TEMPLATE_ID = "6aa95e384b27a4cbc3c8057e";
// The gateway rejects a template with a missing/relative media URL, so a
// public image is always attached unless the caller supplies its own.
export const DEFAULT_MEDIA_URL = "https://res.cloudinary.com/dftt4ow6q/image/upload/v1789112613/fmxa9igwfibetwuc5pr8.jpg";
const DEFAULT_API_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ3cG51bWJlciI6Ijc3OTY0MTk3OTIiLCJ1c2VySWQiOiI2YTgwNDUyZGMwY2I5YjY0ZTY5OTA4MTIiLCJpYXQiOjE3ODkxMDg1NTR9.kAjBr1YpuDfM9FFXH6ZDD7ZLZRDWuadBWWiDrU2Psi0";
// Sends the number in international format — India's country code (91) is
// added automatically when the caller passes a local number.
const normalizePhone = (mobileNumber) => {
    const digits = String(mobileNumber).replace(/\D/g, "");
    if (!digits) {
        return "";
    }
    return digits.startsWith("91") ? digits : `91${digits}`;
};
export const sendSms = async (mobileNumber, smsData = {}) => {
    try {
        const apiUrl = process.env.SMS_API_URL?.trim() || DEFAULT_API_URL;
        const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ3cG51bWJlciI6Ijc3OTY0MTk3OTIiLCJ1c2VySWQiOiI2YTgwNDUyZGMwY2I5YjY0ZTY5OTA4MTIiLCJpYXQiOjE3ODkxMDg1NTR9.kAjBr1YpuDfM9FFXH6ZDD7ZLZRDWuadBWWiDrU2Psi0";
        const templateId = smsData.templateId ||
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
        // Caller-supplied placeholders (booking confirmation) come first so the
        // legacy OTP key can never silently overwrite one of them.
        const variables = { ...(smsData.variables ?? {}) };
        if (smsData.message) {
            // OTP code → template variable (key configurable, default "code").
            const key = process.env.SMS_API_VARIABLES_KEY?.trim() || "code";
            if (!(key in variables)) {
                variables[key] = smsData.message;
            }
        }
        // Every template on this gateway carries a header media; an empty URL
        // makes the API reject the request, so always fall back to the default.
        const mediaUrl = smsData.mediaUrl?.trim() || DEFAULT_MEDIA_URL;
        logger.info("Sending message via messaging API", { to, templateId });
        // Gateway (Render free tier) can hang for 30s+ on cold start — try
        // up to 2 times with a configurable timeout so a dead gateway cannot
        // hang the request forever.
        const attemptTimeout = Number(process.env.SMS_TIMEOUT_MS?.trim()) || 30000;
        const maxAttempts = 2;
        let response = null;
        let lastError = null;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), attemptTimeout);
            try {
                response = await fetch(apiUrl, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        to,
                        template: templateId,
                        variables,
                        media: { url: mediaUrl },
                    }),
                    signal: controller.signal,
                });
                lastError = null;
                break;
            }
            catch (error) {
                lastError = error;
                logger.warn("sendSms attempt failed, retrying", {
                    attempt,
                    message: error instanceof Error
                        ? error.message
                        : String(error),
                });
                if (attempt < maxAttempts) {
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                }
            }
            finally {
                clearTimeout(timeout);
            }
        }
        if (!response) {
            throw lastError;
        }
        const statusCode = response.status;
        const bodyText = await response.text();
        logger.info("Messaging API response", { statusCode, body: bodyText });
        let parsed = null;
        try {
            parsed = bodyText ? JSON.parse(bodyText) : null;
        }
        catch {
            parsed = null;
        }
        const success = statusCode >= 200 && statusCode < 300;
        return {
            success,
            statusCode,
            response: bodyText,
            message: parsed?.message ??
                parsed?.error ??
                (success ? undefined : `HTTP ${statusCode}`),
        };
    }
    catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }
        logger.error("sendSms error", {
            message: error instanceof Error
                ? error.message
                : String(error),
        });
        throw new ApiError(502, error instanceof Error
            ? error.message
            : "Failed to send message");
    }
};
export const sendOtpSms = async ({ phone, code, }) => {
    if (!phone) {
        throw new ApiError(400, "Phone number is required");
    }
    if (!code) {
        throw new ApiError(400, "OTP code is required");
    }
    try {
        const result = await sendSms(phone, { message: code });
        if (!result.success) {
            throw new ApiError(502, `Messaging gateway error (${result.statusCode ?? "unknown"}): ${result.response ||
                result.message ||
                "No response"}`);
        }
        logger.info("OTP message sent successfully", {
            phone: phone.replace(/\d(?=\d{4})/g, "*"),
        });
    }
    catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }
        logger.error("OTP message failed", {
            message: error instanceof Error
                ? error.message
                : String(error),
        });
        throw new ApiError(502, error instanceof Error
            ? `Could not send OTP: ${error.message}`
            : "Could not send OTP");
    }
};
/**
 * Generic template sender used by the non-OTP flows (booking confirmation).
 * Unlike `sendOtpSms` it never throws for a gateway failure — callers use it
 * fire-and-forget, so a dead gateway must not break the business action.
 */
export const sendTemplateSms = async ({ phone, templateId, variables, mediaUrl, label = "template", }) => {
    if (!phone) {
        throw new ApiError(400, "Phone number is required");
    }
    try {
        const result = await sendSms(phone, {
            templateId: templateId ||
                process.env.SMS_BOOKING_TEMPLATE_ID?.trim() ||
                DEFAULT_BOOKING_TEMPLATE_ID,
            variables,
            // `exactOptionalPropertyTypes` is on — an optional property must be
            // omitted rather than passed as `undefined`.
            ...(mediaUrl ? { mediaUrl } : {}),
        });
        if (!result.success) {
            logger.error(`${label} message rejected by gateway`, {
                statusCode: result.statusCode,
                response: result.response || result.message,
            });
            return result;
        }
        logger.info(`${label} message sent successfully`);
        return result;
    }
    catch (error) {
        logger.error(`${label} message failed`, {
            message: error instanceof Error ? error.message : String(error),
        });
        return {
            success: false,
            message: error instanceof Error ? error.message : String(error),
        };
    }
};
//# sourceMappingURL=sms.service.js.map