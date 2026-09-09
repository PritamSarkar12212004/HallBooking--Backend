import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import authRouter from "./modules/auth/auth.route.js";
import bookingRouter from "./modules/bookings/booking.route.js";
import { errorMiddleware, notFoundHandler, } from "./middlewares/error.middleware.js";
const app = express();
app.use(helmet());
app.use(cors({
    origin: "*",
    credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({
    extended: true,
    limit: "10mb",
}));
app.use(morgan("dev"));
app.get("/health", (_req, res) => {
    res.status(200).json({
        success: true,
        message: "Server is healthy",
    });
});
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/bookings", bookingRouter);
app.use(notFoundHandler);
app.use(errorMiddleware);
export default app;
//# sourceMappingURL=app.js.map