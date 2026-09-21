import { Router } from "express";
import { handleCeoAnalytics } from "./analytics.controller.js";
import { authenticate } from "../../middlewares/token.middleware.js";

export const analyticsRouter = Router();

// Reporting padhne ke liye logged-in hona kaafi hai (jaise /bookings/dashboard),
// par ye screen app me sirf CEO ko dikhti hai.
analyticsRouter.get("/ceo", authenticate, handleCeoAnalytics);

export default analyticsRouter;
