
import http from "node:http";
import querystring from "node:querystring";

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

/**
 * Send SMS through C2SMS Gateway
 */
export const sendSms = async (
    mobileNumber: string | number,
    smsData: SendSmsData = {}
): Promise<SendSmsResult> => {
    try {
        const {
            SMS_USER,
            SMS_PASSWORD,
            SMS_CHANNEL,
            SMS_ROUTE,
            SMS_DLT_TEMPLATE_ID,
            SMS_PEID,
            SMS_SENDER_ID,
            SMS_OTP_TEMPLATE_ID,
        } = process.env;

        // -----------------------------------------
        // Validate SMS credentials
        // -----------------------------------------
        if (!SMS_USER || !SMS_PASSWORD) {
            throw new ApiError(
                500,
                "SMS_USER and SMS_PASSWORD are missing in .env"
            );
        }

        // -----------------------------------------
        // Validate mobile number
        // -----------------------------------------
        if (!mobileNumber) {
            throw new ApiError(
                400,
                "Mobile number is required"
            );
        }

        // Remove +, spaces, -, brackets etc.
        const cleanNumber = String(mobileNumber).replace(/\D/g, "");

        if (!cleanNumber) {
            throw new ApiError(
                400,
                "Invalid mobile number"
            );
        }

        // -----------------------------------------
        // Sender ID
        // -----------------------------------------
        const senderId =
            smsData.senderId ||
            SMS_SENDER_ID ||
            "";

        if (!senderId) {
            throw new ApiError(
                500,
                "SMS_SENDER_ID is missing in .env"
            );
        }

        // -----------------------------------------
        // DLT Template ID
        // -----------------------------------------
        const templateId =
            smsData.templateId ||
            SMS_OTP_TEMPLATE_ID ||
            SMS_DLT_TEMPLATE_ID ||
            "";

        if (!templateId) {
            throw new ApiError(
                500,
                "SMS DLT Template ID is missing in .env"
            );
        }

        // -----------------------------------------
        // SMS Message
        // -----------------------------------------
        const message = smsData.message || "";

        if (!message) {
            throw new ApiError(
                400,
                "SMS message is required"
            );
        }

        // -----------------------------------------
        // C2SMS Parameters
        // -----------------------------------------
        const params = querystring.stringify({
            user: SMS_USER,
            password: SMS_PASSWORD,
            senderid: senderId,
            channel: SMS_CHANNEL || "",
            DCS: "0",
            flashsms: "0",
            number: cleanNumber,
            text: message,
            route: SMS_ROUTE || "",
            DLTTemplateId: templateId,
            PEID: SMS_PEID || "",
        });

        const url =
            `http://neo.c2sms.com/api/mt/SendSMS?${params}`;

        // -----------------------------------------
        // Logging
        // -----------------------------------------
        logger.info("Sending SMS via C2SMS", {
            to: cleanNumber,
            senderId,
            templateId,
        });

        // -----------------------------------------
        // HTTP Request
        // -----------------------------------------
        return await new Promise<SendSmsResult>(
            (resolve, reject) => {
                const req = http.get(
                    url,
                    {
                        headers: {
                            "User-Agent":
                                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",

                            Accept: "text/plain, */*",

                            Connection: "close",
                        },

                        timeout: 30000,
                    },

                    (res) => {
                        let data = "";

                        res.setEncoding("utf8");

                        res.on("data", (chunk) => {
                            data += chunk;
                        });

                        res.on("end", () => {
                            logger.info(
                                "C2SMS response",
                                {
                                    statusCode:
                                        res.statusCode,

                                    body: data,
                                }
                            );

                            // C2SMS always returns HTTP 200, so the real
                            // result is inside the JSON body: ErrorCode
                            // "000"/"0" = success, anything else = failure.
                            let gatewayError: string | null = null;

                            try {
                                const parsed = JSON.parse(data);
                                const parsedErrorCode =
                                    parsed.ErrorCode ?? parsed.error;

                                gatewayError =
                                    typeof parsedErrorCode === "string" &&
                                    parsedErrorCode !== "000" &&
                                    parsedErrorCode !== "0"
                                        ? `${parsedErrorCode}: ${parsed.ErrorMessage ?? parsed.Message ?? "Gateway error"}`
                                        : null;
                            } catch {
                                // Non-JSON body — fall back to HTTP status.
                                gatewayError =
                                    res.statusCode === 200
                                        ? null
                                        : `HTTP ${res.statusCode}`;
                            }

                            const result: SendSmsResult = {
                                success:
                                    gatewayError === null,

                                statusCode:
                                    res.statusCode ?? 0,

                                response: data,
                            };

                            if (gatewayError !== null) {
                                result.message = gatewayError;
                            }

                            resolve(result);
                        });
                    }
                );

                // -----------------------------------------
                // Request Error
                // -----------------------------------------
                req.on(
                    "error",
                    (
                        error: NodeJS.ErrnoException
                    ) => {
                        logger.error(
                            "C2SMS request error",
                            {
                                message:
                                    error.message,

                                code:
                                    error.code,
                            }
                        );

                        if (
                            error.code ===
                            "ECONNRESET"
                        ) {
                            reject({
                                success: false,

                                message:
                                    "Connection reset by SMS server. Please check network/firewall settings or contact the SMS provider.",

                                code:
                                    "ECONNRESET",
                            });

                            return;
                        }

                        reject({
                            success: false,

                            message:
                                error.message,

                            code:
                                error.code,
                        });
                    }
                );

                // -----------------------------------------
                // Request Timeout
                // -----------------------------------------
                req.on("timeout", () => {
                    logger.error(
                        "C2SMS request timeout"
                    );

                    req.destroy();

                    reject({
                        success: false,

                        message:
                            "SMS request timed out",

                        code:
                            "TIMEOUT",
                    });
                });
            }
        );
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
                : "Failed to send SMS"
        );
    }
};

/**
 * Send OTP SMS through the C2SMS gateway.
 *
 * The message is built from `SMS_OTP_MESSAGE` (with `{code}` placeholder)
 * falling back to a default text. Because of India's DLT rules the message
 * text must match your registered template in the C2SMS dashboard, otherwise
 * operators will silently drop the SMS.
 */
export const sendOtpSms = async ({
    phone,
    code,
}: SendOtpSmsParams): Promise<void> => {
    if (!phone) {
        throw new ApiError(
            400,
            "Phone number is required"
        );
    }

    if (!code) {
        throw new ApiError(
            400,
            "OTP code is required"
        );
    }

    // -----------------------------------------
    // OTP SMS Message
    //
    // IMPORTANT (India DLT): the sent message MUST be an exact match of the
    // DLT-registered template content for SMS_OTP_TEMPLATE_ID (only the
    // variable part may differ), otherwise the telecom silently drops it.
    // Configure SMS_OTP_MESSAGE in .env to match your registered template.
    // Use {code} as the OTP placeholder.
    // -----------------------------------------
    const otpExpirySeconds =
        Number(process.env.OTP_EXPIRATION_SECONDS) || 300;

    const defaultMessage =
        `Your OTP is {code}. Please use this OTP to log in. ` +
        `Do not share this OTP with anyone. Regards, Unisol Services LLP`;

    const templateMessage =
        process.env.SMS_OTP_MESSAGE?.trim() || defaultMessage;

    const message = templateMessage.replace("{code}", code);

    try {
        // Build SMS data so undefined env values are never included
        const smsData: SendSmsData = { message };

        if (process.env.SMS_SENDER_ID) {
            smsData.senderId = process.env.SMS_SENDER_ID;
        }

        if (process.env.SMS_OTP_TEMPLATE_ID) {
            smsData.templateId = process.env.SMS_OTP_TEMPLATE_ID;
        }

        const result = await sendSms(phone, smsData);

        // -----------------------------------------
        // Gateway Error
        // -----------------------------------------
        if (!result.success) {
            throw new ApiError(
                502,
                `SMS gateway error (${result.statusCode ?? "unknown"}): ${result.response ||
                result.message ||
                "No response"
                }`
            );
        }

        logger.info(
            "OTP SMS sent successfully",
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
            "OTP SMS failed",
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
                ? `Could not send OTP SMS: ${error.message}`
                : "Could not send OTP SMS"
        );
    }
};
