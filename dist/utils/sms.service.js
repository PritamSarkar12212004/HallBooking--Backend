import { logger } from "./logger.js";
export const sendOtpSms = async ({ phone, code }) => {
    logger.info("OTP generated (dev mode, no SMS provider)", {
        phone,
        code,
        message: `Your OTP is ${code}`,
    });
};
//# sourceMappingURL=sms.service.js.map