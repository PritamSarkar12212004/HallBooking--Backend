import { Router } from "express";
import {
    handleSendOtp,
    handleVerifyOtp,
    handleCompleteProfile,
    handleUpdateProfile,
} from "./auth.controller.js";
import { authenticate } from "../../middlewares/token.middleware.js";

export const authRouter = Router();

authRouter.post("/send-otp", handleSendOtp);
authRouter.post("/verify-otp", handleVerifyOtp);
authRouter.put("/profile", authenticate, handleCompleteProfile);
authRouter.patch("/profile", authenticate, handleUpdateProfile);

export default authRouter;
