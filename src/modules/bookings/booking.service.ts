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
        applicant: {},
        arrangements: {},
        financial: {},
        signatures: {},
        payments: [],
        // The booking is only created on the final step, so it is confirmed.
        status: "Confirmed",
        createdBy: new mongoose.Types.ObjectId(input.createdBy),
        createdByName: input.createdByName,
    };

    if (input.hallId && mongoose.Types.ObjectId.isValid(input.hallId)) {
        doc.hallId = new mongoose.Types.ObjectId(input.hallId);
    }

    return Booking.create(doc);
};

const recomputeFinancialTotals = (booking: IBooking): void => {
    const financial = booking.financial;
    const charges = Array.isArray(financial?.charges) ? financial.charges : [];
    const units = Array.isArray(financial?.units) ? financial.units : [];
    const chargesTotal = charges.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
    const unitsTotal = units.reduce(
        (sum, u) => sum + (Number(u.quantity) || 0) * (Number(u.perUnit) || 0),
        0,
    );
    const unitsPaid = units.reduce(
        (sum, u) =>
            u.paid
                ? sum + (Number(u.quantity) || 0) * (Number(u.perUnit) || 0)
                : sum,
        0,
    );
    const total = chargesTotal + unitsTotal;
    const paid =
        charges.reduce((sum, c) => sum + (Number(c.paid) || 0), 0) + unitsPaid;
    financial.totalAmount = total;
    financial.advancePaid = paid;
    financial.balanceAmount = Math.max(0, total - paid);
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
        f &&
            (f.totalAmount ?? 0) > 0 &&
            (f.advancePaid ?? 0) > 0 &&
            f.mode
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
            const before = {
                securityDeposit: booking.financial.securityDeposit ?? 0,
                totalAmount: booking.financial.totalAmount ?? 0,
                advancePaid: booking.financial.advancePaid ?? 0,
            };

            // Section 1: replace the actual amount breakdown.
            if (d.charges !== undefined) {
                booking.financial.charges = d.charges.map((c) => ({
                    label: c.label,
                    amount: c.amount,
                    paid: c.paid,
                }));
            }
            // Units: amount is derived from quantity × perUnit. currentUnit
            // (meter reading) is stored for reference only — never charged.
            if (d.units !== undefined) {
                booking.financial.units = d.units.map((u) => ({
                    label: u.label,
                    quantity: u.quantity,
                    perUnit: u.perUnit,
                    currentUnit: u.currentUnit ?? 0,
                    amount: u.quantity * u.perUnit,
                    paid: u.paid,
                }));
            }
            if (d.securityDeposit !== undefined) {
                booking.financial.securityDeposit = d.securityDeposit;
            }

            recomputeFinancialTotals(booking);
            const after = {
                securityDeposit: booking.financial.securityDeposit ?? 0,
                totalAmount: booking.financial.totalAmount ?? 0,
                advancePaid: booking.financial.advancePaid ?? 0,
            };
            const changes = (["totalAmount", "advancePaid"] as const)
                .filter((k) => before[k] !== after[k])
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
        booking.status = "Confirmed";
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

export interface PaginatedBookings {
    bookings: BookingSummary[];
    total: number;
}

const DEFAULT_EVENT_IMAGE =
    "https://placehold.co/400x300/fdf2f8/be185d/png?text=%F0%9F%8E%AA+Event";

const toStringId = (value: unknown): string =>
    typeof value === "string" ? value : String(value);

export const listBookings = async (
    page = 1,
    pageSize = 10
): Promise<PaginatedBookings> => {
    const skip = Math.max(0, (page - 1) * pageSize);

    // Total count of matching documents (used for pagination metadata).
    const total = await Booking.countDocuments();

    const bookings = await Booking.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
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

    return {
        bookings: bookings.map((b) => ({
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
        })),
        total,
    };
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
    eventName: string;
    eventType: string;
    hallName: string;
    applicantName: string;
    date: string;
    startTime: string;
    endTime: string;
    totalAmount: number;
    status: string;
    paymentStatus: string;
    bookedBy: string;
}

export interface DashboardStats {
    todayEvents: number;
    pendingPaymentsAmount: number;
    weekBookings: number;
    activeBookings: number;
    totalRevenue: number;
    collectedAmount: number;
    totalBookings: number;
    cancelledCount: number;
    weeklyGrowth: number;
}

export interface DashboardData {
    stats: DashboardStats;
    weeklyChart: { value: number; label: string }[];
    weeklyRevenue: { value: number; label: string }[];
    monthlyRevenue: { value: number; label: string }[];
    paymentDistribution: { status: string; count: number }[];
    hallStats: { hallName: string; bookings: number; revenue: number }[];
    todayEvents: DashboardEventItem[];
    upcomingEvents: DashboardEventItem[];
    recentBookings: DashboardEventItem[];
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
    eventName: b.event?.name || "Untitled Event",
    eventType: b.event?.type || "Event",
    hallName: b.hall?.name || "N/A",
    applicantName: b.applicant?.name || "N/A",
    date: b.schedule?.startDate ? new Date(b.schedule.startDate).toISOString() : "",
    startTime: b.schedule?.startTime || "",
    endTime: b.schedule?.endTime || "",
    totalAmount: b.financial?.totalAmount ?? 0,
    // Normalize: "Office-Approved" ya "confirmed" booking = Confirmed for UI.
    status: b.status === "Office-Approved" ? "Confirmed" : (b.status || "Draft"),
    paymentStatus: b.paymentStatus || "Pending",
    bookedBy: b.bookedByStaff || b.createdByName || "N/A",
});

const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Live dashboard analytics computed from real booking data.
export const getDashboard = async (): Promise<DashboardData> => {
    const now = new Date();
    // Client sends date-only strings ("YYYY-MM-DD") which MongoDB casts to UTC
    // midnight — so day boundaries must be computed on the IST calendar date,
    // otherwise early-morning IST hours land on the previous UTC day.
    const IST_OFFSET_MS = 5.5 * 3600000;
    const istShifted = new Date(now.getTime() + IST_OFFSET_MS);
    const istDayStartUtc = Date.UTC(
        istShifted.getUTCFullYear(),
        istShifted.getUTCMonth(),
        istShifted.getUTCDate(),
    );
    const todayStart = new Date(istDayStartUtc - IST_OFFSET_MS);
    const todayEnd = new Date(istDayStartUtc + 86400000 - 1 - IST_OFFSET_MS);
    const upcomingEnd = new Date(istDayStartUtc + 7 * 86400000 - 1 - IST_OFFSET_MS);
    const weekStart = startOfDay(new Date(now.getTime() - 6 * 86400000));
    const prevWeekStart = startOfDay(new Date(weekStart.getTime() - 7 * 86400000));
    const weekEnd = endOfDay(now);
    const monthStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    // ── Core stats + financial aggregates (all in parallel) ─────────────
    const [
        todayCount,
        pendingAgg,
        weekCount,
        prevWeekCount,
        activeCount,
        totalCount,
        revenueAgg,
        collectedAgg,
        cancelledCount,
    ] = await Promise.all([
        Booking.countDocuments({
            "schedule.startDate": { $lte: todayEnd },
            "schedule.endDate": { $gte: todayStart },
            status: { $ne: "Cancelled" },
        }),
        Booking.aggregate([
            { $match: { status: { $ne: "Cancelled" } } },
            { $group: { _id: null, total: { $sum: "$financial.balanceAmount" } } },
        ]),
        Booking.countDocuments({ createdAt: { $gte: weekStart, $lte: weekEnd } }),
        Booking.countDocuments({ createdAt: { $gte: prevWeekStart, $lte: weekStart } }),
        Booking.countDocuments({ status: { $ne: "Cancelled" } }),
        Booking.countDocuments({}),
        // Revenue = what the customer has actually paid, not the billed total.
        // Pending/due amounts are tracked separately via pendingPaymentsAmount.
        Booking.aggregate([
            { $match: { status: { $ne: "Cancelled" } } },
            { $group: { _id: null, total: { $sum: "$financial.advancePaid" } } },
        ]),
        Booking.aggregate([
            { $match: { status: { $ne: "Cancelled" } } },
            { $group: { _id: null, total: { $sum: "$financial.advancePaid" } } },
        ]),
        Booking.countDocuments({ status: "Cancelled" }),
    ]);

    // NOTE: revenueAgg == collectedAgg intentionally — revenue reflects only
    // the amount actually received from customers.

    const weeklyGrowth = prevWeekCount === 0
        ? (weekCount > 0 ? 100 : 0)
        : Math.round(((weekCount - prevWeekCount) / prevWeekCount) * 100);

    // Bookings created per day for the last 7 days (bar chart).
    // Bucketed in server-local time (not UTC) so the day keys line up with the
    // labels shown on the client — this was the source of the empty/incorrect
    // weekly chart previously.
    const localDateKey = (d: Date): string =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
            d.getDate(),
        ).padStart(2, '0')}`;

    const weekDocs = await Booking.find({ createdAt: { $gte: weekStart } })
        .select({ createdAt: 1, "financial.advancePaid": 1 })
        .lean();

    const chartMap = new Map<string, number>();
    const weekRevMap = new Map<string, number>();
    for (const doc of weekDocs) {
        if (!doc.createdAt) continue;
        const key = localDateKey(new Date(doc.createdAt));
        chartMap.set(key, (chartMap.get(key) ?? 0) + 1);
        weekRevMap.set(key, (weekRevMap.get(key) ?? 0) + (doc.financial?.advancePaid ?? 0));
    }

    const weeklyChart: { value: number; label: string }[] = [];
    for (let i = 6; i >= 0; i--) {
        const day = new Date(now.getTime() - i * 86400000);
        const key = localDateKey(day);
        weeklyChart.push({
            value: chartMap.get(key) ?? 0,
            label: SHORT_DAYS[day.getDay()] ?? '',
        });
    }

    // ── Monthly revenue trend (last 6 months) ──────────────────────────
    const monthlyRaw = await Booking.aggregate([
        { $match: { status: { $ne: "Cancelled" }, createdAt: { $gte: monthStart } } },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
                total: { $sum: "$financial.advancePaid" },
            },
        },
    ]);
    const monthlyMap = new Map<string, number>(
        monthlyRaw.map((r: any) => [r._id as string, r.total as number]),
    );
    const monthlyRevenue: { value: number; label: string }[] = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        monthlyRevenue.push({
            value: monthlyMap.get(key) ?? 0,
            label: SHORT_MONTHS[d.getMonth()] ?? '',
        });
    }

    // ── Weekly revenue (last 7 days, per createdAt) ──────────────────
    const weeklyRevenue: { value: number; label: string }[] = [];
    for (let i = 6; i >= 0; i--) {
        const day = new Date(now.getTime() - i * 86400000);
        const key = localDateKey(day);
        weeklyRevenue.push({
            value: weekRevMap.get(key) ?? 0,
            label: SHORT_DAYS[day.getDay()] ?? '',
        });
    }

    // ── Payment status distribution (non-cancelled) ────────────────────
    const payRaw = await Booking.aggregate([
        { $match: { status: { $ne: "Cancelled" } } },
        { $group: { _id: "$paymentStatus", count: { $sum: 1 } } },
    ]);
    const payMap = new Map<string, number>(
        payRaw.map((r: any) => [r._id as string, r.count as number]),
    );
    const paymentDistribution = ["Paid", "Partial", "Pending"].map((status) => ({
        status,
        count: payMap.get(status) ?? 0,
    }));

    // ── Hall demand (top 5 by bookings, then revenue) ──────────────────
    const hallRaw = await Booking.aggregate([
        { $match: { status: { $ne: "Cancelled" } } },
        {
            $group: {
                _id: "$hall.name",
                bookings: { $sum: 1 },
                revenue: { $sum: "$financial.advancePaid" },
            },
        },
        { $sort: { bookings: -1, revenue: -1 } },
        { $limit: 5 },
    ]);
    const hallStats = hallRaw.map((r: any) => ({
        hallName: (r._id as string) || "Unassigned",
        bookings: r.bookings as number,
        revenue: r.revenue as number,
    }));

    // ── Event lists (today / next 7 days) + recent bookings ────────────
    const eventSelect = {
        "event.name": 1,
        "event.type": 1,
        "hall.name": 1,
        "applicant.name": 1,
        "schedule.startDate": 1,
        "schedule.startTime": 1,
        "schedule.endTime": 1,
        "financial.totalAmount": 1,
        bookedByStaff: 1,
        createdByName: 1,
        status: 1,
        paymentStatus: 1,
    };
    const [todayDocs, upcomingDocs, recentDocs] = await Promise.all([
        Booking.find({
            "schedule.startDate": { $lte: todayEnd },
            "schedule.endDate": { $gte: todayStart },
        })
            .sort({ "schedule.startTime": 1 })
            .limit(5)
            .select(eventSelect)
            .lean(),
        Booking.find({
            "schedule.startDate": { $gt: todayEnd, $lte: upcomingEnd },
        })
            .sort({ "schedule.startDate": 1 })
            .limit(5)
            .select(eventSelect)
            .lean(),
        Booking.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .select(eventSelect)
            .lean(),
    ]);

    return {
        stats: {
            todayEvents: todayCount,
            pendingPaymentsAmount: pendingAgg[0]?.total ?? 0,
            weekBookings: weekCount,
            activeBookings: activeCount,
            totalRevenue: revenueAgg[0]?.total ?? 0,
            collectedAmount: collectedAgg[0]?.total ?? 0,
            totalBookings: totalCount,
            cancelledCount,
            weeklyGrowth,
        },
        weeklyChart,
        weeklyRevenue,
        monthlyRevenue,
        paymentDistribution,
        hallStats,
        todayEvents: todayDocs.map(toEventItem),
        upcomingEvents: upcomingDocs.map(toEventItem),
        recentBookings: recentDocs.map(toEventItem),
    };
};
