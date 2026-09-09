import mongoose from "mongoose";
import Booking from "./booking.model.js";
import User from "../user/user.model.js";
import { ApiError } from "../../utils/api-error.js";
const generateBookingNumber = async () => {
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
export const createBookingDraft = async (input) => {
    const bookingNumber = await generateBookingNumber();
    const startDate = new Date(input.startDate);
    const endDate = new Date(input.endDate);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        throw new ApiError(400, "Invalid date. Use a format like '21 Aug 2026'.");
    }
    const doc = {
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
const updateDocBalanceAmount = (booking) => {
    const financial = booking.financial;
    const total = financial?.totalAmount ?? 0;
    const advance = financial?.advancePaid ?? 0;
    const finalPayment = financial?.finalPayment ?? 0;
    const hallRent = financial?.hallRent ?? 0;
    const instrument = financial?.instrument ?? 0;
    // Balance = Total − Advance − Instrument − Hall Rent − Final Payment.
    // Security deposit is a refundable hold, so it is NOT subtracted.
    financial.balanceAmount = Math.max(0, total - advance - instrument - hallRent - finalPayment);
};
const isBookingComplete = (booking) => {
    const a = booking.applicant;
    const e = booking.event;
    const f = booking.financial;
    const s = booking.signatures;
    const applicantOk = Boolean(a?.name && a?.mobile && a?.address && a?.governmentId?.type);
    const eventOk = Boolean(e?.type && e?.expectedAttendance && e?.name);
    const financialOk = Boolean(f && (f.totalAmount ?? 0) > 0 && (f.advancePaid ?? 0) > 0 && f.mode);
    const signatureOk = Boolean(s?.applicantPhoto && s?.managerPhoto);
    return applicantOk && eventOk && financialOk && signatureOk;
};
export const updateBookingSection = async (id, section, data, userId) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, "Invalid booking id");
    }
    const booking = await Booking.findById(id);
    if (!booking) {
        throw new ApiError(404, "Booking not found");
    }
    switch (section) {
        case "applicant": {
            const d = data;
            if (d.name !== undefined)
                booking.applicant.name = d.name;
            if (d.organization !== undefined)
                booking.applicant.organization = d.organization;
            if (d.mobile !== undefined)
                booking.applicant.mobile = d.mobile;
            if (d.address !== undefined)
                booking.applicant.address = d.address;
            if (d.email !== undefined)
                booking.applicant.email = d.email;
            if (d.governmentIdType !== undefined)
                booking.applicant.governmentId.type = d.governmentIdType;
            if (d.governmentIdNumber !== undefined)
                booking.applicant.governmentId.number = d.governmentIdNumber;
            if (d.governmentIdPhoto !== undefined)
                booking.applicant.governmentId.photo = d.governmentIdPhoto;
            break;
        }
        case "event": {
            const d = data;
            if (d.type !== undefined)
                booking.event.type = d.type;
            if (d.expectedAttendance !== undefined)
                booking.event.expectedAttendance = d.expectedAttendance;
            if (d.requirements !== undefined)
                booking.event.hallRequirements = d.requirements;
            break;
        }
        case "arrangements": {
            const d = data;
            if (!booking.arrangements)
                booking.arrangements = { kitchenRequired: false };
            const decorator = booking.arrangements.decorator ?? {};
            const caterer = booking.arrangements.caterer ?? {};
            booking.arrangements.decorator = {
                name: d.decoratorName ?? decorator.name,
                contact: d.decoratorContact ?? decorator.contact,
                timing: d.decorationTiming ?? decorator.timing,
            };
            booking.arrangements.caterer = {
                name: d.catererName ?? caterer.name,
                contact: d.catererContact ?? caterer.contact,
            };
            if (d.kitchenRequired !== undefined) {
                booking.arrangements.kitchenRequired = d.kitchenRequired === "Yes";
            }
            break;
        }
        case "payment": {
            const d = data;
            // Capture previous values to build the audit diff.
            const before = {
                hallRent: booking.financial.hallRent ?? 0,
                instrument: booking.financial.instrument ?? 0,
                securityDeposit: booking.financial.securityDeposit ?? 0,
                totalAmount: booking.financial.totalAmount ?? 0,
                advancePaid: booking.financial.advancePaid ?? 0,
                finalPayment: booking.financial.finalPayment ?? 0,
            };
            if (d.hallRent !== undefined)
                booking.financial.hallRent = d.hallRent;
            if (d.instrument !== undefined)
                booking.financial.instrument = d.instrument;
            if (d.securityDeposit !== undefined)
                booking.financial.securityDeposit = d.securityDeposit;
            if (d.totalAmount !== undefined)
                booking.financial.totalAmount = d.totalAmount;
            if (d.advancePaid !== undefined)
                booking.financial.advancePaid = d.advancePaid;
            if (d.finalPayment !== undefined)
                booking.financial.finalPayment = d.finalPayment;
            // totalAmount is kept exactly as sent by the client (manual entry).
            // It is NOT auto-recalculated from hallRent + instrument +
            // securityDeposit — those are informational components and their
            // sum does not always equal the agreed total (e.g. discounts or
            // extra charges). Overriding it caused wrong balances.
            updateDocBalanceAmount(booking);
            // Build audit entry: which numeric financial fields changed.
            // balanceAmount is derived, so it is NOT tracked as a change —
            // the Balance card only ever shows the current balance.
            const after = {
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
                if (!booking.financeHistory)
                    booking.financeHistory = [];
                booking.financeHistory.push({
                    editedByName: editor?.name ?? "Unknown",
                    editedByMobile: editor?.phone ?? "",
                    editedAt: new Date(),
                    changes,
                    balanceAfter: booking.financial.balanceAmount ?? 0,
                });
            }
            const mode = (d.mode ?? booking.financial.mode ?? "Cash");
            booking.financial.mode = mode;
            const transactionId = d.transactionNumber ?? "";
            const proof = d.paymentProofPhoto ?? "";
            // Track each new payment received. Only append a record when the
            // advance amount actually increased by this transaction.
            const payments = booking.payments ?? [];
            const previouslyReceived = payments.reduce((sum, p) => sum + (p?.amount ?? 0), 0);
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
            const d = data;
            if (d.applicantSignature !== undefined)
                booking.signatures.applicantPhoto = d.applicantSignature;
            if (d.managerSignature !== undefined)
                booking.signatures.managerPhoto = d.managerSignature;
            if (d.termsAccepted !== undefined) {
                if (d.termsAccepted) {
                    booking.signatures.termsAcceptedAt = new Date();
                }
                else {
                    delete booking.signatures.termsAcceptedAt;
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
// Dummy cartoon event image used when no real image exists yet.
// Replace with your real CDN bucket URL when available.
const DEFAULT_EVENT_IMAGE = "https://placehold.co/400x300/fdf2f8/be185d/png?text=%F0%9F%8E%AA+Event";
const toStringId = (value) => typeof value === "string" ? value : String(value);
export const listBookings = async (page = 1, pageSize = 10) => {
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
            id: toStringId(b._id),
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
export const getBookingById = async (id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, "Invalid booking id");
    }
    const booking = await Booking.findById(id).lean();
    if (!booking) {
        throw new ApiError(404, "Booking not found");
    }
    return booking;
};
export const getBookingByNumber = async (bookingNumber) => {
    const booking = await Booking.findOne({ bookingNumber }).lean();
    if (!booking) {
        throw new ApiError(404, "Booking not found");
    }
    return booking;
};
const startOfDay = (d) => {
    const c = new Date(d);
    c.setHours(0, 0, 0, 0);
    return c;
};
const endOfDay = (d) => {
    const c = new Date(d);
    c.setHours(23, 59, 59, 999);
    return c;
};
const toEventItem = (b) => ({
    id: toStringId(b._id),
    eventName: b.event?.name || "Untitled Event",
    eventType: b.event?.type || "Event",
    hallName: b.hall?.name || "N/A",
    applicantName: b.applicant?.name || "N/A",
    date: b.schedule?.startDate ? new Date(b.schedule.startDate).toISOString() : "",
    startTime: b.schedule?.startTime || "",
    endTime: b.schedule?.endTime || "",
    totalAmount: b.financial?.totalAmount ?? 0,
    status: b.status || "Draft",
    paymentStatus: b.paymentStatus || "Pending",
});
const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// Live dashboard analytics computed from real booking data.
export const getDashboard = async () => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const weekStart = startOfDay(new Date(now.getTime() - 6 * 86400000));
    const prevWeekStart = startOfDay(new Date(weekStart.getTime() - 7 * 86400000));
    const weekEnd = endOfDay(now);
    // ── Core stats + financial aggregates (all in parallel) ─────────────
    const [todayCount, pendingAgg, weekCount, prevWeekCount, activeCount, totalCount, revenueAgg, collectedAgg, cancelledCount,] = await Promise.all([
        Booking.countDocuments({
            "schedule.startDate": { $gte: todayStart, $lte: todayEnd },
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
        Booking.aggregate([
            { $match: { status: { $ne: "Cancelled" } } },
            { $group: { _id: null, total: { $sum: "$financial.totalAmount" } } },
        ]),
        Booking.aggregate([
            { $match: { status: { $ne: "Cancelled" } } },
            { $group: { _id: null, total: { $sum: "$financial.advancePaid" } } },
        ]),
        Booking.countDocuments({ status: "Cancelled" }),
    ]);
    const weeklyGrowth = prevWeekCount === 0
        ? (weekCount > 0 ? 100 : 0)
        : Math.round(((weekCount - prevWeekCount) / prevWeekCount) * 100);
    // Bookings created per day for the last 7 days (bar chart).
    const chartRaw = await Booking.aggregate([
        { $match: { createdAt: { $gte: weekStart } } },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                count: { $sum: 1 },
            },
        },
    ]);
    const chartMap = new Map(chartRaw.map((r) => [r._id, r.count]));
    const weeklyChart = [];
    for (let i = 6; i >= 0; i--) {
        const day = new Date(now.getTime() - i * 86400000);
        const key = day.toISOString().slice(0, 10);
        weeklyChart.push({
            value: chartMap.get(key) ?? 0,
            label: SHORT_DAYS[day.getDay()] ?? '',
        });
    }
    // ── Monthly revenue trend (last 6 months) ──────────────────────────
    const monthStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const monthlyRaw = await Booking.aggregate([
        { $match: { status: { $ne: "Cancelled" }, createdAt: { $gte: monthStart } } },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
                total: { $sum: "$financial.totalAmount" },
            },
        },
    ]);
    const monthlyMap = new Map(monthlyRaw.map((r) => [r._id, r.total]));
    const monthlyRevenue = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        monthlyRevenue.push({
            value: monthlyMap.get(key) ?? 0,
            label: SHORT_MONTHS[d.getMonth()] ?? '',
        });
    }
    // ── Payment status distribution (non-cancelled) ────────────────────
    const payRaw = await Booking.aggregate([
        { $match: { status: { $ne: "Cancelled" } } },
        { $group: { _id: "$paymentStatus", count: { $sum: 1 } } },
    ]);
    const payMap = new Map(payRaw.map((r) => [r._id, r.count]));
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
                revenue: { $sum: "$financial.totalAmount" },
            },
        },
        { $sort: { bookings: -1, revenue: -1 } },
        { $limit: 5 },
    ]);
    const hallStats = hallRaw.map((r) => ({
        hallName: r._id || "Unassigned",
        bookings: r.bookings,
        revenue: r.revenue,
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
        status: 1,
        paymentStatus: 1,
    };
    const [todayDocs, upcomingDocs, recentDocs] = await Promise.all([
        Booking.find({
            "schedule.startDate": { $gte: todayStart, $lte: todayEnd },
        })
            .sort({ "schedule.startTime": 1 })
            .limit(5)
            .select(eventSelect)
            .lean(),
        Booking.find({
            "schedule.startDate": { $gt: todayEnd, $lte: endOfDay(new Date(now.getTime() + 7 * 86400000)) },
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
        monthlyRevenue,
        paymentDistribution,
        hallStats,
        todayEvents: todayDocs.map(toEventItem),
        upcomingEvents: upcomingDocs.map(toEventItem),
        recentBookings: recentDocs.map(toEventItem),
    };
};
//# sourceMappingURL=booking.service.js.map