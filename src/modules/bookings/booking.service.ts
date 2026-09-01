import mongoose from "mongoose";
import Booking from "./booking.model.js";
import User from "../user/user.model.js";
import { ApiError } from "../../utils/api-error.js";
import type { IBooking, ICaterer, IDecorator, PaymentMode } from "./booking.type.js";
import type {
    HallCalendarInput,
    BookingSection,
    EventSectionInput,
    ApplicantSectionInput,
    ArrangementsSectionInput,
    PaymentSectionInput,
    DeclarationSectionInput, 
} from "./booking.validation.js";

const generateBookingNumber = async (): Promise<string> => {
    const prefix = "BK";
    const year = new Date().getFullYear();

    for (let attempt = 0; attempt < 5; attempt += 1) {
        const nonce = Math.floor(100000 + Math.random() * 900000);
        const bookingNumber = `${prefix}-${year}-${nonce}`;
        const existing = await Booking.exists({ bookingNumber });
        if (!existing) {
            return bookingNumber;
        }
    }

    throw new ApiError(500, "Could not generate a unique booking number");
};

export interface CreateDraftInput extends HallCalendarInput {
    createdBy: string;
    createdByName: string;
}

export const createBookingDraft = async (
    input: CreateDraftInput
): Promise<IBooking> => {
    const bookingNumber = await generateBookingNumber();

    const startDate = new Date(input.startDate);
    const endDate = new Date(input.endDate);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        throw new ApiError(400, "Invalid date. Use a format like '21 Aug 2026'.");
    }

    const doc: Record<string, unknown> = {
        bookingNumber,
        event: { name: input.eventName },
        eventImage: input.eventImage ?? "",
        schedule: {
            startDate,
            endDate,
            startTime: input.startTime,
            endTime: input.endTime,
        },
        bookedByStaff: input.bookedByStaff,
        allocatedTeam: input.allocatedTeam,
        applicant: {},
        arrangements: {},
        financial: {},
        signatures: {},
        payments: [],
        status: "Draft",
        createdBy: new mongoose.Types.ObjectId(input.createdBy),
        createdByName: input.createdByName,
    };

    if (input.hallId && mongoose.Types.ObjectId.isValid(input.hallId)) {
        doc.hallId = new mongoose.Types.ObjectId(input.hallId);
    }

    return Booking.create(doc);
};

const updateDocBalanceAmount = (booking: IBooking): void => {
    const financial = booking.financial;
    const total = financial?.totalAmount ?? 0;
    const advance = financial?.advancePaid ?? 0;
    const finalPayment = financial?.finalPayment ?? 0;
    const hallRent = financial?.hallRent ?? 0;
    const instrument = financial?.instrument ?? 0;
    // Balance = Total − Advance − Instrument − Hall Rent − Final Payment.
    // Security deposit is a refundable hold, so it is NOT subtracted.
    financial.balanceAmount = Math.max(
        0,
        total - advance - instrument - hallRent - finalPayment,
    );
};

export type SectionData =
    | EventSectionInput
    | ApplicantSectionInput
    | ArrangementsSectionInput
    | PaymentSectionInput
    | DeclarationSectionInput;

const isBookingComplete = (booking: IBooking): boolean => {
    const a = booking.applicant;
    const e = booking.event;
    const f = booking.financial;
    const s = booking.signatures;

    const applicantOk = Boolean(
        a?.name && a?.mobile && a?.address && a?.governmentId?.type
    );
    const eventOk = Boolean(e?.type && e?.expectedAttendance && e?.name);
    const financialOk = Boolean(
        f && (f.totalAmount ?? 0) > 0 && (f.advancePaid ?? 0) > 0 && f.mode
    );
    const signatureOk = Boolean(s?.applicantPhoto && s?.managerPhoto);

    return applicantOk && eventOk && financialOk && signatureOk;
};

export const updateBookingSection = async (
    id: string,
    section: BookingSection,
    data: SectionData,
    userId: string
): Promise<IBooking> => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, "Invalid booking id");
    }

    const booking = await Booking.findById(id);
    if (!booking) {
        throw new ApiError(404, "Booking not found");
    }

    switch (section) {
        case "applicant": {
            const d = data as ApplicantSectionInput;
            if (d.name !== undefined) booking.applicant.name = d.name;
            if (d.organization !== undefined) booking.applicant.organization = d.organization;
            if (d.mobile !== undefined) booking.applicant.mobile = d.mobile;
            if (d.address !== undefined) booking.applicant.address = d.address;
            if (d.email !== undefined) booking.applicant.email = d.email;
            if (d.governmentIdType !== undefined) booking.applicant.governmentId.type = d.governmentIdType;
            if (d.governmentIdNumber !== undefined) booking.applicant.governmentId.number = d.governmentIdNumber;
            if (d.governmentIdPhoto !== undefined) booking.applicant.governmentId.photo = d.governmentIdPhoto;
            break;
        }
        case "event": {
            const d = data as EventSectionInput;
            if (d.type !== undefined) booking.event.type = d.type;
            if (d.expectedAttendance !== undefined) booking.event.expectedAttendance = d.expectedAttendance;
            if (d.requirements !== undefined) booking.event.hallRequirements = d.requirements;
            break;
        }
        case "arrangements": {
            const d = data as ArrangementsSectionInput;
            if (!booking.arrangements) booking.arrangements = { kitchenRequired: false };
            const decorator = booking.arrangements.decorator ?? ({} as IDecorator);
            const caterer = booking.arrangements.caterer ?? ({} as ICaterer);
            booking.arrangements.decorator = {
                name: d.decoratorName ?? decorator.name,
                contact: d.decoratorContact ?? decorator.contact,
                timing: d.decorationTiming ?? decorator.timing,
            } as IDecorator;
            booking.arrangements.caterer = {
                name: d.catererName ?? caterer.name,
                contact: d.catererContact ?? caterer.contact,
            } as ICaterer;
            if (d.kitchenRequired !== undefined) {
                booking.arrangements.kitchenRequired = d.kitchenRequired === "Yes";
            }
            break;
        }
        case "payment": {
            const d = data as PaymentSectionInput;
            // Capture previous values to build the audit diff.
            const before: Record<string, number> = {
                hallRent: booking.financial.hallRent ?? 0,
                instrument: booking.financial.instrument ?? 0,
                securityDeposit: booking.financial.securityDeposit ?? 0,
                totalAmount: booking.financial.totalAmount ?? 0,
                advancePaid: booking.financial.advancePaid ?? 0,
                finalPayment: booking.financial.finalPayment ?? 0,
            };

            if (d.hallRent !== undefined) booking.financial.hallRent = d.hallRent;
            if (d.instrument !== undefined) booking.financial.instrument = d.instrument;
            if (d.securityDeposit !== undefined) booking.financial.securityDeposit = d.securityDeposit;
            if (d.totalAmount !== undefined) booking.financial.totalAmount = d.totalAmount;
            if (d.advancePaid !== undefined) booking.financial.advancePaid = d.advancePaid;
            if (d.finalPayment !== undefined) booking.financial.finalPayment = d.finalPayment;

            // totalAmount is kept exactly as sent by the client (manual entry).
            // It is NOT auto-recalculated from hallRent + instrument +
            // securityDeposit — those are informational components and their
            // sum does not always equal the agreed total (e.g. discounts or
            // extra charges). Overriding it caused wrong balances.

            updateDocBalanceAmount(booking);

            // Build audit entry: which numeric financial fields changed.
            // balanceAmount is derived, so it is NOT tracked as a change —
            // the Balance card only ever shows the current balance.
            const after: Record<string, number> = {
                hallRent: booking.financial.hallRent ?? 0,
                instrument: booking.financial.instrument ?? 0,
                securityDeposit: booking.financial.securityDeposit ?? 0,
                totalAmount: booking.financial.totalAmount ?? 0,
                advancePaid: booking.financial.advancePaid ?? 0,
                finalPayment: booking.financial.finalPayment ?? 0,
            };
            const changes = Object.keys(after)
                .filter((k) => (before[k] ?? 0) !== after[k])
                // Security deposit is a refundable hold; changing it is not a
                // payment event, so it must not be tracked in the history.
                .filter((k) => k !== "securityDeposit")
                .map((k) => ({
                    field: k,
                    from: Number(before[k] ?? 0),
                    to: Number(after[k] ?? 0),
                }));

            if (changes.length > 0) {
                const editor = await User.findById(userId).select("name phone");
                if (!booking.financeHistory) booking.financeHistory = [];
                booking.financeHistory.push({
                    editedByName: editor?.name ?? "Unknown",
                    editedByMobile: editor?.phone ?? "",
                    editedAt: new Date(),
                    changes,
                    balanceAfter: booking.financial.balanceAmount ?? 0,
                });
            }

            const mode = (d.mode ?? booking.financial.mode ?? "Cash") as PaymentMode;
            booking.financial.mode = mode;

            const transactionId = d.transactionNumber ?? "";
            const proof = d.paymentProofPhoto ?? "";

            // Track each new payment received. Only append a record when the
            // advance amount actually increased by this transaction.
            const payments = booking.payments ?? [];
            const previouslyReceived = payments.reduce(
                (sum, p) => sum + (p?.amount ?? 0),
                0
            );
            const newAdvance = booking.financial.advancePaid ?? 0;
            const receivedNow = Math.max(0, newAdvance - previouslyReceived);

            if (receivedNow > 0) {
                payments.push({
                    amount: receivedNow,
                    mode,
                    transactionId,
                    receivedBy: new mongoose.Types.ObjectId(userId),
                    receivedAt: new Date(),
                    proof,
                });
            }

            booking.payments = payments;

            const advance = booking.financial.advancePaid ?? 0;
            const balance = booking.financial.balanceAmount ?? 0;
            booking.paymentStatus =
                advance <= 0 ? "Pending" : balance <= 0 ? "Paid" : "Partial";
            break;
        }
        case "declaration": {
            const d = data as DeclarationSectionInput;
            if (d.applicantSignature !== undefined) booking.signatures!.applicantPhoto = d.applicantSignature;
            if (d.managerSignature !== undefined) booking.signatures!.managerPhoto = d.managerSignature;
            if (d.termsAccepted !== undefined) {
                if (d.termsAccepted) {
                    booking.signatures!.termsAcceptedAt = new Date();
                } else {
                    delete booking.signatures!.termsAcceptedAt;
                }
            }
            break;
        }
        default:
            throw new ApiError(400, "Unknown booking section");
    }

    if (booking.status === "Draft" && isBookingComplete(booking)) {
        booking.status = "Pending";
    }

    await booking.save();
    return booking;
};

export interface BookingSummary {
    id: string;
    eventImage: string;
    eventName: string;
    eventType: string;
    hallName: string;
    startDate: string;
    startTime: string;
    endTime: string;
    totalAmount: number;
    balanceAmount: number;
    advancePaid: number;
    applicantName: string;
    takenBy: string;
    paymentStatus: string;
    createdAt: string;
    status: string;
}

// Dummy cartoon event image used when no real image exists yet.
// Replace with your real CDN bucket URL when available.
const DEFAULT_EVENT_IMAGE =
    "https://placehold.co/400x300/fdf2f8/be185d/png?text=%F0%9F%8E%AA+Event";

const toStringId = (value: unknown): string =>
    typeof value === "string" ? value : String(value);

export const listBookings = async (): Promise<BookingSummary[]> => {
    const bookings = await Booking.find()
        .sort({ createdAt: -1 })
        .lean()
        .select({
            _id: 1,
            bookedByStaff: 1,
            createdByName: 1,
            "applicant.name": 1,
            eventImage: 1,
            "event.name": 1,
            "event.type": 1,
            "hall.name": 1,
            "schedule.startDate": 1,
            "schedule.startTime": 1,
            "schedule.endTime": 1,
            "financial.totalAmount": 1,
            "financial.balanceAmount": 1,
            "financial.advancePaid": 1,
            paymentStatus: 1,
            createdAt: 1,
            status: 1,
        });

    return bookings.map((b) => ({
        id: toStringId((b as unknown as { _id: unknown })._id),
        eventImage: b.eventImage || DEFAULT_EVENT_IMAGE,
        eventName: b.event?.name || "Untitled Event",
        eventType: b.event?.type || "Event",
        hallName: b.hall?.name || "N/A",
        startDate: b.schedule?.startDate
            ? new Date(b.schedule.startDate).toISOString()
            : "",
        startTime: b.schedule?.startTime || "",
        endTime: b.schedule?.endTime || "",
        totalAmount: b.financial?.totalAmount ?? 0,
        balanceAmount: b.financial?.balanceAmount ?? 0,
        advancePaid: b.financial?.advancePaid ?? 0,
        applicantName: b.applicant?.name || "N/A",
        takenBy: b.bookedByStaff || b.createdByName || "N/A",
        paymentStatus: b.paymentStatus || "Pending",
        createdAt: b.createdAt ? new Date(b.createdAt).toISOString() : "",
        status: b.status || "Draft",
    }));
};

export const getBookingById = async (id: string): Promise<IBooking> => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, "Invalid booking id");
    }
    const booking = await Booking.findById(id).lean();
    if (!booking) {
        throw new ApiError(404, "Booking not found");
    }
    return booking;
};

export const getBookingByNumber = async (
    bookingNumber: string
): Promise<IBooking> => {
    const booking = await Booking.findOne({ bookingNumber }).lean();
    if (!booking) {
        throw new ApiError(404, "Booking not found");
    }
    return booking;
};

export interface DashboardEventItem {
    id: string;
    hallName: string;
    applicantName: string;
    date: string;
    startTime: string;
    endTime: string;
    status: string;
    paymentStatus: string;
}

export interface DashboardData {
    stats: {
        todayEvents: number;
        pendingPaymentsAmount: number;
        weekBookings: number;
        activeBookings: number;
    };
    weeklyChart: { value: number; label: string }[];
    todayEvents: DashboardEventItem[];
    upcomingEvents: DashboardEventItem[];
}

const startOfDay = (d: Date): Date => {
    const c = new Date(d);
    c.setHours(0, 0, 0, 0);
    return c;
};

const endOfDay = (d: Date): Date => {
    const c = new Date(d);
    c.setHours(23, 59, 59, 999);
    return c;
};

const toEventItem = (b: any): DashboardEventItem => ({
    id: toStringId(b._id),
    hallName: b.hall?.name || "N/A",
    applicantName: b.applicant?.name || "N/A",
    date: b.schedule?.startDate ? new Date(b.schedule.startDate).toISOString() : "",
    startTime: b.schedule?.startTime || "",
    endTime: b.schedule?.endTime || "",
    status: b.status || "Draft",
    paymentStatus: b.paymentStatus || "Pending",
});

const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Live dashboard analytics computed from real booking data.
export const getDashboard = async (): Promise<DashboardData> => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const weekStart = startOfDay(new Date(now.getTime() - 6 * 86400000));
    const weekEnd = endOfDay(now);

    const [todayCount, pendingAgg, weekCount, activeCount] = await Promise.all([
        Booking.countDocuments({
            "schedule.startDate": { $gte: todayStart, $lte: todayEnd },
            status: { $ne: "Cancelled" },
        }),
        Booking.aggregate([
            { $match: { status: { $ne: "Cancelled" } } },
            { $group: { _id: null, total: { $sum: "$financial.balanceAmount" } } },
        ]),
        Booking.countDocuments({ createdAt: { $gte: weekStart, $lte: weekEnd } }),
        Booking.countDocuments({ status: { $ne: "Cancelled" } }),
    ]);

    // Bookings created per day for the last 7 days (chart).
    const chartRaw = await Booking.aggregate([
        { $match: { createdAt: { $gte: weekStart } } },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                count: { $sum: 1 },
            },
        },
    ]);
    const chartMap = new Map<string, number>(
        chartRaw.map((r: any) => [r._id as string, r.count as number]),
    );
    const weeklyChart: { value: number; label: string }[] = [];
    for (let i = 6; i >= 0; i--) {
        const day = new Date(now.getTime() - i * 86400000);
        const key = day.toISOString().slice(0, 10);
        weeklyChart.push({
            value: chartMap.get(key) ?? 0,
            label: SHORT_DAYS[day.getDay()] ?? '',
        });
    }

    const [todayDocs, upcomingDocs] = await Promise.all([
        Booking.find({
            "schedule.startDate": { $gte: todayStart, $lte: todayEnd },
        })
            .sort({ "schedule.startTime": 1 })
            .limit(5)
            .select({
                "hall.name": 1,
                "applicant.name": 1,
                "schedule.startDate": 1,
                "schedule.startTime": 1,
                "schedule.endTime": 1,
                status: 1,
                paymentStatus: 1,
            })
            .lean(),
        Booking.find({
            "schedule.startDate": { $gt: todayEnd, $lte: endOfDay(new Date(now.getTime() + 7 * 86400000)) },
        })
            .sort({ "schedule.startDate": 1 })
            .limit(5)
            .select({
                "hall.name": 1,
                "applicant.name": 1,
                "schedule.startDate": 1,
                "schedule.startTime": 1,
                "schedule.endTime": 1,
                status: 1,
                paymentStatus: 1,
            })
            .lean(),
    ]);

    return {
        stats: {
            todayEvents: todayCount,
            pendingPaymentsAmount: pendingAgg[0]?.total ?? 0,
            weekBookings: weekCount,
            activeBookings: activeCount,
        },
        weeklyChart,
        todayEvents: todayDocs.map(toEventItem),
        upcomingEvents: upcomingDocs.map(toEventItem),
    };
};
