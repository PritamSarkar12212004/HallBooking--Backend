import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import authRouter from "./modules/auth/auth.route.js";
import bookingRouter from "./modules/bookings/booking.route.js";
import applicantRouter from "./modules/applicants/applicant.route.js";
import paymentQrRouter from "./modules/payment-qr/qr.route.js";
import analyticsRouter from "./modules/analytics/analytics.route.js";
import {
    errorMiddleware,
    notFoundHandler,
} from "./middlewares/error.middleware.js";
import { describeAccessList, isAccessGateEnabled } from "./access/index.js";
import { logger } from "./utils/logger.js";

/**
 * Boot par allowed numbers log kar diye jaate hain — warna "login kyun nahi ho
 * raha" debug karna mushkil ho jaata hai (gate sirf whitelist wale numbers ko
 * andar aane deta hai).
 */
logger.info(
    isAccessGateEnabled()
        ? "App access gate ON"
        : "App access gate OFF (ACCESS_GATE_ENABLED=false)",
    { allowedNumbers: describeAccessList() }
);

const app = express();
app.use(helmet());
app.use(
    cors({
        origin: "*",
        credentials: true,
    })
);
app.use(express.json({ limit: "10mb" }));
app.use(
    express.urlencoded({
        extended: true,
        limit: "10mb",
    })
);
app.use(morgan("dev"));
app.get("/health", (_req, res) => {
    res.status(200).json({
        success: true,
        message: "Server is healthy",
    });
});
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/bookings", bookingRouter);
app.use("/api/v1/applicants", applicantRouter);
app.use("/api/v1/payment-qr", paymentQrRouter);
app.use("/api/v1/analytics", analyticsRouter);
app.use(notFoundHandler);
app.use(errorMiddleware);
export default app;