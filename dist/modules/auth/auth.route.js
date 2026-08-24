import { Router } from "express";
import { handleSendOtp, handleVerifyOtp, handleCompleteProfile, } from "./auth.controller.js";
import { authenticate } from "../../middlewares/token.middleware.js";
export const authRouter = Router();
authRouter.post("/send-otp", handleSendOtp);
authRouter.post("/verify-otp", handleVerifyOtp);
authRouter.put("/profile", authenticate, handleCompleteProfile);
export default authRouter;
//# sourceMappingURL=auth.route.js.map