import { Router } from "express";
import {
    handleCreateBookingDraft,
    handleGetBookingById,
    handleGetBookingByNumber,
    handleListBookings,
    handleUpdateBookingSection,
} from "./booking.controller.js";
import { authenticate } from "../../middlewares/token.middleware.js";

export const bookingRouter = Router();

bookingRouter.post("/", authenticate, handleCreateBookingDraft);
bookingRouter.get("/", authenticate, handleListBookings);
bookingRouter.patch("/:id/:section", authenticate, handleUpdateBookingSection);
bookingRouter.get("/number/:bookingNumber", authenticate, handleGetBookingByNumber);
bookingRouter.get("/:id", authenticate, handleGetBookingById);

export default bookingRouter;