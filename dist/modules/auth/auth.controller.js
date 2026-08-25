import { asyncHandler } from "../../utils/async-handler.js";
import { normalizePhone, validateOtpCode, validateProfile, validateProfileUpdate, } from "./auth.validation.js";
import { completeProfile as completeProfileService, sendOtp as sendOtpService, updateProfile as updateProfileService, verifyOtp as verifyOtpService, } from "./auth.service.js";
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
export const handleUpdateProfile = asyncHandler(async (req, res) => {
    // Only editable fields (name, city, photo) are updated.
    // `phone` comes from the JWT; phone, email, gender, role and
    // isProfileComplete are intentionally NOT changeable through this
    // endpoint.
    const updatable = validateProfileUpdate(req.body);
    const data = await updateProfileService({
        phone: req.user.phone,
        ...updatable,
    });
    res.status(200).json({
        success: true,
        message: "Profile updated successfully",
        data,
    });
});
//# sourceMappingURL=auth.controller.js.map