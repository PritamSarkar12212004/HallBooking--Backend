import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { AuthenticatedRequest } from "../../middlewares/token.middleware.js";
import {
    validateHallCalendar,
    validateApplicantSection,
    validateEventSection,
    validateArrangementsSection,
    validatePaymentSection,
    validateDeclarationSection,
    BookingSection,
    EVENT_TYPES,
    HALL_REQUIREMENTS,
    GOVERNMENT_ID_TYPES,
    BOOKING_TERMS,
} from "./booking.validation.js";
import {
    createBookingDraft,
    updateBookingSection as updateBookingSectionService,
    getBookingById as getBookingByIdService,
    getBookingByNumber as getBookingByNumberService,
    listBookings as listBookingsService,
    getDashboard as getDashboardService,
} from "./booking.service.js";

// Live dashboard analytics for the Home screen.
export const handleDashboard = asyncHandler(
    async (_req: Request, res: Response): Promise<void> => {
        const dashboard = await getDashboardService();
        res.status(200).json({
            success: true,
            message: "Dashboard data fetched successfully",
            data: dashboard,
        });
    }
);

// Returns static config/options (event types, hall requirements, govt IDs)
// so the frontend never hard-codes them — they come from the backend.
export const handleBookingMeta = asyncHandler(
    async (_req: Request, res: Response): Promise<void> => {
        res.status(200).json({
            success: true,
            message: "Booking options fetched successfully",
            data: {
                eventTypes: EVENT_TYPES,
                hallRequirements: HALL_REQUIREMENTS,
                governmentIdTypes: GOVERNMENT_ID_TYPES,
                terms: BOOKING_TERMS,
                upi: {
                    // Dummy UPI id + QR image (generated via an external QR API).
                    id: "hallbooking@upi",
                    name: "Hall Booking",
                    qrUrl: "https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=upi://pay?pa=hallbooking%40upi%26pn=Hall%20Booking",
                },
            },
        });
    }
);

// Creates a draft booking from Step 1 (Hall Calendar) data.
export const handleCreateBookingDraft = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const validated = validateHallCalendar(req.body);
        const userId = req.user?.userId ?? "000000000000000000000000";
        const createdByName = validated.bookedByStaff || "Staff";

        const booking = await createBookingDraft({
            ...validated,
            createdBy: userId,
            createdByName,
        });

        res.status(201).json({
            success: true,
            message: "Draft booking created successfully",
            data: { booking, nextSteps: ["applicant", "event", "arrangements", "payment", "declaration"] },
        });
    }
);

export const handleUpdateBookingSection = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const section = req.params.section as BookingSection;
        const allowed = ["applicant", "event", "arrangements", "payment", "declaration"];
        if (!allowed.includes(section)) {
            res.status(400).json({ success: false, message: "Invalid section" });
            return;
        }

        let data;
        switch (section) {
            case "applicant":
                data = validateApplicantSection(req.body);
                break;
            case "event":
                data = validateEventSection(req.body);
                break;
            case "arrangements":
                data = validateArrangementsSection(req.body);
                break;
            case "payment":
                data = validatePaymentSection(req.body);
                break;
            case "declaration":
                data = validateDeclarationSection(req.body);
                break;
            default:
                data = {};
        }

        const id = String(req.params.id);
        const userId = req.user?.userId ?? "000000000000000000000000";
        const booking = await updateBookingSectionService(
            id,
            section,
            data as Parameters<typeof updateBookingSectionService>[2],
            userId
        );

        res.status(200).json({
            success: true,
            message: `${section} updated successfully`,
            data: { booking },
        });
    }
);

export const handleListBookings = asyncHandler(
    async (_req: Request, res: Response): Promise<void> => {
        const bookings = await listBookingsService();

        res.status(200).json({
            success: true,
            message: "Bookings fetched successfully",
            data: { bookings },
        });
    }
);

export const handleGetBookingById = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
        const id = String(req.params.id);
        if (!id) {
            res.status(400).json({ success: false, message: "Booking id is required" });
            return;
        }
        const booking = await getBookingByIdService(id);

        res.status(200).json({
            success: true,
            message: "Booking fetched successfully",
            data: { booking },
        });
    }
);

export const handleGetBookingByNumber = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
        const bookingNumber = String(req.params.bookingNumber);
        if (!bookingNumber) {
            res.status(400).json({ success: false, message: "bookingNumber is required" });
            return;
        }
        const booking = await getBookingByNumberService(bookingNumber);

        res.status(200).json({
            success: true,
            message: "Booking fetched successfully",
            data: { booking },
        });
    }
);