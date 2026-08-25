import { asyncHandler } from "../../utils/async-handler.js";
import { normalizePhone, validateOtpCode, validateProfile, } from "./auth.validation.js";
import { completeProfile as completeProfileService, sendOtp as sendOtpService, verifyOtp as verifyOtpService, } from "./auth.service.js";
export const handleSendOtp = asyncHandler(async (req, res) => {
    const phone = normalizePhone(req.body?.phone);
    const result = await sendOtpService(phone);
    res.status(200).json({
        success: true,
        message: "OTP sent successfully",
        data: { phone, ...result },
    });
});
export const handleVerifyOtp = asyncHandler(async (req, res) => {
    const phone = normalizePhone(req.body?.phone);
    const otp = validateOtpCode(req.body?.otp);
    const data = await verifyOtpService(phone, otp);
    res.status(200).json({
        success: true,
        message: data.isNewUser
            ? "OTP verified. Please complete your profile setup."
            : "OTP verified successfully.",
        data,
    });
});
export const handleCompleteProfile = asyncHandler(async (req, res) => {
    // NOTE: `phone` is intentionally NOT read from the request body. It
    // always comes from the authenticated JWT token (`req.user.phone`),
    // so the client never needs to send it again — only the other fields
    // (name, email, city, gender, photo) are updated.
    const profile = validateProfile(req.body);
    const data = await completeProfileService({
        phone: req.user.phone,
        ...profile,
    });
    res.status(200).json({
        success: true,
        message: "Profile completed successfully",
        data,
    });
});
//# sourceMappingURL=auth.controller.js.map