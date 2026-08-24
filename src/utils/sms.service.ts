import { logger } from "./logger.js";

export interface SendOtpParams {
    phone: string;
    code: string;
}

/**
 * Send the OTP to the user's phone.
 *
 * BY DEFAULT (development) the OTP is logged to the console because no SMS
 * provider is wired up. To use a real provider, set OTP_SMS_PROVIDER in .env
 * (e.g. "twilio") and implement the provider branch below. The controller and
 * service layers do not need changes.
 */
export const sendOtpSms = async ({ phone, code }: SendOtpParams): Promise<void> => {
    const provider = process.env.OTP_SMS_PROVIDER;

    switch (provider) {
        case "twilio": {
            // TODO: Integrate Twilio SDK here using process.env.TWILIO_* values.
            // Example (after installing `twilio`):
            //   const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
            //   await client.messages.create({ from: process.env.TWILIO_PHONE_NUMBER, to: `+91${phone}`, body: `Your OTP is ${code}` });
            throw new Error("Twilio SMS integration is not configured yet. Install `twilio` and fill TWILIO_* env vars.");
        }
        default:
            // Development fallback: print the code so the flow is testable.
            logger.info("OTP generated (dev mode, no SMS provider)", {
                phone,
                code,
                message: `Your OTP is ${code}`,
            });
    }
};