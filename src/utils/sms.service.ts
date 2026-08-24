import { logger } from "./logger.js";

export interface SendOtpParams {
    phone: string;
    code: string;
}

export const sendOtpSms = async ({ phone, code }: SendOtpParams): Promise<void> => {

    logger.info("OTP generated (dev mode, no SMS provider)", {
        phone,
        code,
        message: `Your OTP is ${code}`,
    });

};