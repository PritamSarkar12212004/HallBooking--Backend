/**
 * CEO Business Analytics.
 *
 * Ek hi call me poora report nikalta hai (overview · finance · events ·
 * venue · customers · staff · reports) — screen ko sirf render karna padta hai.
 *
 * Do scope saaf-saaf alag rakhe gaye hain:
 *  - **Period scope**: us period ki bookings (schedule.startDate range me) —
 *    events, venue, customers, reports ke counts isi se aate hain.
 *  - **Live scope**: "abhi kya chal raha hai" (today's events, upcoming) —
 *    ye period se bind nahi hote, warna "Today" filter par upcoming events
 *    gayab ho jaate.
 *
 * Paisa hamesha `payments[]` ledger se aata hai (actual received), aur us
 * period me receive hui payments se — `financial.advancePaid` sirf booking ka
 * cumulative paid batata hai, period-wise nahi.
 */
import type mongoose from "mongoose";
import Booking from "../bookings/booking.model.js";
import Hall from "../hall/hall.model.js";
import User from "../user/user.model.js";
import { IDENTITY_KEY } from "../applicants/applicant.service.js";
import type { BookingStatus, IBooking } from "../bookings/booking.type.js";

import type {
    AnalyticsCustomerRow,
    AnalyticsDepositRow,
    AnalyticsDocumentRow,
    AnalyticsEventRow,
    AnalyticsEventRevenueRow,
    AnalyticsEvents,
    AnalyticsFinance,
    AnalyticsHallRow,
    AnalyticsModeSplit,
    AnalyticsOverview,
    AnalyticsPaymentRow,
    AnalyticsPendingRow,
    AnalyticsPeriod,
    AnalyticsPeriodKey,
    AnalyticsReports,
    AnalyticsStaff,
    AnalyticsStaffAssignment,
    AnalyticsStaffRow,
    CeoAnalytics,
} from "./analytics.type.js";

const DAY_MS = 86400000;
const IST_OFFSET_MS = 5.5 * 3600000;
const SHORT_MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const MODES = ["Cash", "UPI", "Cheque", "NEFT/RTGS"] as const;

/** List caps — response ko chhota rakhne ke liye (UI me "top N" hi dikhta hai). */
const MAX_EVENT_ROWS = 25;
const MAX_FINANCE_ROWS = 50;
const MAX_PAYMENT_ROWS = 50;
const MAX_ASSIGNMENTS = 50;
const MAX_PENDING = 50;
const MAX_TOP_CUSTOMERS = 10;
const MAX_DEPOSIT_ROWS = 50;
const MAX_DOCUMENT_ROWS = 150;
const MAX_DAILY_POINTS = 14;
const MAX_WEEKLY_POINTS = 8;
const MAX_MONTHLY_POINTS = 12;
const COMPARISON_MONTHS = 6;

export interface AnalyticsQuery {
    period?: string | undefined;
    from?: string | undefined;
    to?: string | undefined;
}

type LeanBooking = IBooking & { _id: unknown; createdAt?: Date };

const num = (value: unknown): number => {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
};

const round2 = (value: number): number =>
    Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;

/** IST calendar date (YYYY-MM-DD) — buckets aur utilization ke liye. */
const istDateKey = (date: Date): string => {
    const shifted = new Date(date.getTime() + IST_OFFSET_MS);
    return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(
        shifted.getUTCDate(),
    ).padStart(2, "0")}`;
};

/** Us IST din ka shuruaat (UTC Date) — Mongo ke date-only strings se match karta hai. */
const istDayStart = (date: Date): Date => {
    const shifted = new Date(date.getTime() + IST_OFFSET_MS);
    return new Date(
        Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) -
            IST_OFFSET_MS,
    );
};

const addDays = (date: Date, days: number): Date =>
    new Date(date.getTime() + days * DAY_MS);

const iso = (date: Date | string | undefined | null): string => {
    if (!date) return "";
    const parsed = date instanceof Date ? date : new Date(date);
    return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
};

const startOfIstMonth = (date: Date, monthOffset = 0): Date => {
    const shifted = new Date(date.getTime() + IST_OFFSET_MS);
    return new Date(
        Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + monthOffset, 1) - IST_OFFSET_MS,
    );
};

const startOfIstWeek = (date: Date): Date => {
    const dayStart = istDayStart(date);
    // getUTCDay() IST-shifted day boundary par bhi wahi weekday deta hai.
    const weekday = new Date(dayStart.getTime() + IST_OFFSET_MS).getUTCDay();
    // Week Monday se — Sunday (0) ko 7 mana jata hai.
    return addDays(dayStart, -(weekday === 0 ? 6 : weekday - 1));
};

const monthKey = (date: Date): string => {
    const shifted = new Date(date.getTime() + IST_OFFSET_MS);
    return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
};

const monthLabel = (date: Date): string => {
    const shifted = new Date(date.getTime() + IST_OFFSET_MS);
    return SHORT_MONTHS[shifted.getUTCMonth()] ?? "";
};

const dayLabel = (date: Date): string => {
    const shifted = new Date(date.getTime() + IST_OFFSET_MS);
    return `${shifted.getUTCDate()} ${SHORT_MONTHS[shifted.getUTCMonth()] ?? ""}`;
};

/** Period filter — custom from/to valid date par override karta hai. */
const resolvePeriod = (query: AnalyticsQuery, earliest: Date | null, now: Date): AnalyticsPeriod => {
    const todayStart = istDayStart(now);
    const todayEnd = new Date(todayStart.getTime() + DAY_MS - 1);
    const key = (query.period ?? "month") as AnalyticsPeriodKey;

    const parseDate = (value?: string): Date | null => {
        if (!value) return null;
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : istDayStart(parsed);
    };

    if (key === "custom") {
        const from = parseDate(query.from) ?? todayStart;
        const rawTo = parseDate(query.to) ?? todayStart;
        const to = new Date(Math.max(from.getTime(), rawTo.getTime()) + DAY_MS - 1);
        const days = Math.max(1, Math.round((to.getTime() - from.getTime() + 1) / DAY_MS));
        return { key: "custom", label: "Custom range", from: from.toISOString(), to: to.toISOString(), days };
    }

    let from = todayStart;
    let label = "Today";

    switch (key) {
        case "week":
            from = addDays(todayStart, -6);
            label = "Last 7 days";
            break;
        case "quarter": {
            const monthStart = startOfIstMonth(now);
            const shifted = new Date(monthStart.getTime() + IST_OFFSET_MS);
            const quarterStartMonth = Math.floor(shifted.getUTCMonth() / 3) * 3;
            from = startOfIstMonth(now, quarterStartMonth - shifted.getUTCMonth());
            label = "This quarter";
            break;
        }
        case "year":
            from = startOfIstMonth(now, -new Date(now.getTime() + IST_OFFSET_MS).getUTCMonth());
            label = "This year";
            break;
        case "all":
            from = earliest ?? todayStart;
            label = "All time";
            break;
        case "month":
            from = startOfIstMonth(now);
            label = "This month";
            break;
        default:
            from = todayStart;
            label = "Today";
            break;
    }

    const days = Math.max(1, Math.round((todayEnd.getTime() - from.getTime() + 1) / DAY_MS));
    return { key, label, from: from.toISOString(), to: todayEnd.toISOString(), days };
};

/** Customer identity — mobile ke last 10 digits, warna lowercase naam. */
const customerKeyOf = (booking: LeanBooking): string => {
    const digits = String(booking.applicant?.mobile ?? "").replace(/\D/g, "");
    if (digits.length >= 10) return `m:${digits.slice(-10)}`;
    const name = String(booking.applicant?.name ?? "").trim().toLowerCase();
    return name ? `n:${name}` : "";
};

const customerNameOf = (booking: LeanBooking): string =>
    String(booking.applicant?.name ?? "").trim() || "Unnamed";

const customerMobileOf = (booking: LeanBooking): string =>
    String(booking.applicant?.mobile ?? "").trim();

const eventNameOf = (booking: LeanBooking): string =>
    String(booking.event?.name ?? "").trim() || "Untitled Event";

const eventTypeOf = (booking: LeanBooking): string =>
    String(booking.event?.customType ?? "").trim() ||
    String(booking.event?.type ?? "").trim() ||
    "Other";

const hallNameOf = (booking: LeanBooking): string =>
    String(booking.hall?.name ?? "").trim() || "Unassigned";

const bookingIdOf = (booking: LeanBooking): string => String(booking._id ?? "");

const paymentsInRange = (booking: LeanBooking, from: Date, to: Date) =>
    (booking.payments ?? []).filter((payment) => {
        const at = payment?.receivedAt ? new Date(payment.receivedAt) : null;
        if (!at || Number.isNaN(at.getTime())) return false;
        return at.getTime() >= from.getTime() && at.getTime() <= to.getTime();
    });

/** Multi-day booking ke saare IST din (utilization ke liye), period me clipped. */
const dayKeysOf = (booking: LeanBooking, fromKey: string, toKey: string): string[] => {
    const start = booking.schedule?.startDate ? new Date(booking.schedule.startDate) : null;
    if (!start || Number.isNaN(start.getTime())) return [];
    const rawEnd = booking.schedule?.endDate ? new Date(booking.schedule.endDate) : start;
    const end = Number.isNaN(rawEnd.getTime()) ? start : rawEnd;
    const keys: string[] = [];
    let cursor = istDayStart(start);
    const last = istDayStart(end);
    while (cursor.getTime() <= last.getTime()) {
        const key = istDateKey(cursor);
        if (key >= fromKey && key <= toKey) keys.push(key);
        cursor = addDays(cursor, 1);
    }
    return keys;
};

const toEventRow = (booking: LeanBooking): AnalyticsEventRow => ({
    id: bookingIdOf(booking),
    bookingNumber: String(booking.bookingNumber ?? ""),
    eventName: eventNameOf(booking),
    eventType: eventTypeOf(booking),
    hallName: hallNameOf(booking),
    applicantName: customerNameOf(booking),
    applicantMobile: customerMobileOf(booking),
    bookedFor:
        String(booking.event?.bookingFor ?? "") === "Someone Else"
            ? String(booking.event?.bookingForName ?? "") || "Someone Else"
            : String(booking.event?.bookingFor ?? "") || "Myself",
    startDate: iso(booking.schedule?.startDate),
    endDate: iso(booking.schedule?.endDate),
    startTime: String(booking.schedule?.startTime ?? ""),
    endTime: String(booking.schedule?.endTime ?? ""),
    status: String(booking.status ?? ""),
    paymentStatus: String(booking.paymentStatus ?? ""),
    totalAmount: num(booking.financial?.totalAmount),
    collected: num(booking.financial?.advancePaid),
    balance: num(booking.financial?.balanceAmount),
    bookedByStaff: String(booking.bookedByStaff ?? ""),
});

/**
 * CEO dashboard ka poora analytics payload.
 */
export const getCeoAnalytics = async (query: AnalyticsQuery): Promise<CeoAnalytics> => {
    const now = new Date();
    const todayStart = istDayStart(now);
    const todayEnd = new Date(todayStart.getTime() + DAY_MS - 1);

    // "All time" ka lower bound — sabse purani booking.
    const earliestDoc = await Booking.findOne({}, { "schedule.startDate": 1 })
        .sort({ "schedule.startDate": 1 })
        .lean();
    const earliest = earliestDoc?.schedule?.startDate
        ? new Date(earliestDoc.schedule.startDate)
        : null;

    const period = resolvePeriod(query, earliest, now);
    const from = new Date(period.from);
    const to = new Date(period.to);
    const fromKey = istDateKey(from);
    const toKey = istDateKey(to);

    const hiddenStatuses = ["Cancelled", "Ended", "Draft"] as BookingStatus[];
    const liveFilter: mongoose.QueryFilter<IBooking> = {
        "schedule.startDate": { $lte: todayEnd },
        "schedule.endDate": { $gte: todayStart },
        status: { $nin: hiddenStatuses },
    };
    const upcomingFilter: mongoose.QueryFilter<IBooking> = {
        "schedule.startDate": { $gt: todayEnd },
        status: { $nin: hiddenStatuses },
    };

    const [
        periodDocs,
        liveDocs,
        upcomingDocs,
        upcomingCount,
        halls,
        users,
        customerLifetime,
    ] = await Promise.all([
        // Period ki bookings — range ke andar start hone wali, YA jinki payment
        // is period me receive hui (advance aaj aaya ho par event agle mahine).
        // Draft bookings kabhi report me nahi aate.
        Booking.find({
            status: { $ne: "Draft" },
            $or: [
                { "schedule.startDate": { $gte: from, $lte: to } },
                { "payments.receivedAt": { $gte: from, $lte: to } },
            ],
        })
            .sort({ "schedule.startDate": -1 })
            .lean<LeanBooking[]>(),
        Booking.find(liveFilter).sort({ "schedule.startDate": 1 }).lean<LeanBooking[]>(),
        Booking.find(upcomingFilter)
            .sort({ "schedule.startDate": 1 })
            .limit(MAX_EVENT_ROWS)
            .lean<LeanBooking[]>(),
        Booking.countDocuments(upcomingFilter),
        Hall.find({}, { name: 1, capacity: 1, status: 1, isActive: 1 }).lean(),
        User.find({}, { name: 1, role: 1, phone: 1 }).lean(),
        // Har customer ki pehli booking (kabhi) — "new vs repeat" ke liye.
        Booking.aggregate<{ _id: string; first: Date; total: number }>([
            { $match: { status: { $ne: "Draft" } } },
            { $project: { key: IDENTITY_KEY as never, startDate: "$schedule.startDate" } },
            {
                $group: {
                    _id: "$key",
                    first: { $min: "$startDate" },
                    total: { $sum: 1 },
                },
            },
        ]),
    ]);

    const startedInPeriod = periodDocs.filter((booking) => {
        const start = booking.schedule?.startDate ? new Date(booking.schedule.startDate) : null;
        if (!start || Number.isNaN(start.getTime())) return false;
        return start.getTime() >= from.getTime() && start.getTime() <= to.getTime();
    });

    // ── Payments ledger (period) ────────────────────────────────────────
    interface PeriodPayment {
        booking: LeanBooking;
        amount: number;
        mode: string;
        transactionId: string;
        receivedAt: Date;
        receivedBy: string;
        proof: string;
        index: number;
    }

    const periodPayments: PeriodPayment[] = [];
    periodDocs.forEach((booking) => {
        paymentsInRange(booking, from, to).forEach((payment, index) => {
            periodPayments.push({
                booking,
                amount: num(payment.amount),
                mode: String(payment.mode ?? ""),
                transactionId: String(payment.transactionId ?? ""),
                receivedAt: payment.receivedAt ? new Date(payment.receivedAt) : now,
                receivedBy: String(payment.receivedBy ?? ""),
                proof: String(payment.proof ?? ""),
                index,
            });
        });
    });

    const collectedInPeriod = periodPayments.reduce((sum, payment) => sum + payment.amount, 0);
    const nonCancelledPeriod = periodDocs.filter((booking) => booking.status !== "Cancelled");
    const billedInPeriod = nonCancelledPeriod.reduce(
        (sum, booking) => sum + num(booking.financial?.totalAmount),
        0,
    );
    const pendingInPeriod = nonCancelledPeriod.reduce(
        (sum, booking) => sum + num(booking.financial?.balanceAmount),
        0,
    );
    const depositCollected = startedInPeriod
        .filter((booking) => booking.status !== "Cancelled")
        .reduce((sum, booking) => sum + num(booking.financial?.securityDeposit), 0);
    const depositRows = startedInPeriod.filter(
        (booking) => num(booking.financial?.securityDeposit) > 0,
    );
    const depositReturned = depositRows
        .filter((booking) => booking.financial?.securityDepositReturned === true)
        .reduce(
            (sum, booking) =>
                sum +
                Math.max(
                    0,
                    num(booking.financial?.securityDeposit) -
                        num(booking.financial?.securityDepositDeducted),
                ),
            0,
        );
    const depositDeducted = depositRows.reduce(
        (sum, booking) => sum + num(booking.financial?.securityDepositDeducted),
        0,
    );

    const modeTotals = MODES.map((mode) => {
        const rows = periodPayments.filter((payment) => payment.mode === mode);
        return {
            mode,
            amount: round2(rows.reduce((sum, row) => sum + row.amount, 0)),
            count: rows.length,
        };
    });
    const modeAmount = (mode: string): number =>
        modeTotals.find((row) => row.mode === mode)?.amount ?? 0;
    const cashCollection = modeAmount("Cash");
    const upiCollection = modeAmount("UPI");
    const chequeCollection = modeAmount("Cheque");
    const neftCollection = modeAmount("NEFT/RTGS");
    const unclassified = periodPayments
        .filter((payment) => !MODES.includes(payment.mode as (typeof MODES)[number]))
        .reduce((sum, payment) => sum + payment.amount, 0);

    const modeSplit: AnalyticsModeSplit[] = [
        ...modeTotals,
        ...(unclassified > 0
            ? [{ mode: "Other", amount: round2(unclassified), count: 0 }]
            : []),
    ].filter((row) => row.amount > 0 || row.count > 0);

    const completedInPeriod = startedInPeriod.filter((booking) => booking.status === "Ended");
    const cancelledInPeriod = startedInPeriod.filter((booking) => booking.status === "Cancelled");
    const ongoingDocs = liveDocs.filter((booking) => {
        const start = booking.schedule?.startDate ? new Date(booking.schedule.startDate) : null;
        const end = booking.schedule?.endDate ? new Date(booking.schedule.endDate) : null;
        return (
            (!!start && start.getTime() < todayStart.getTime()) ||
            (!!end && end.getTime() > todayEnd.getTime())
        );
    });

    const overview: AnalyticsOverview = {
        totalEvents: startedInPeriod.length,
        upcomingEvents: upcomingCount,
        ongoingEvents: ongoingDocs.length,
        completedEvents: completedInPeriod.length,
        cancelledEvents: cancelledInPeriod.length,
        todayEvents: liveDocs.length,
        totalBilled: round2(billedInPeriod),
        totalCollected: round2(collectedInPeriod),
        pendingPayments: round2(pendingInPeriod),
        refunds: round2(depositReturned),
        securityDeposits: round2(depositCollected),
        securityDepositsHeld: round2(Math.max(0, depositCollected - depositReturned - depositDeducted)),
        deductions: round2(depositDeducted),
        netRevenue: round2(collectedInPeriod + depositDeducted - depositReturned),
    };

    // ── Finance ─────────────────────────────────────────────────────────
    const unitCharges = startedInPeriod.reduce(
        (sum, booking) =>
            sum +
            (booking.financial?.units ?? []).reduce(
                (unitSum, unit) => unitSum + num(unit.quantity) * num(unit.perUnit),
                0,
            ),
        0,
    );

    const eventWiseRevenue: AnalyticsEventRevenueRow[] = [...periodDocs]
        .sort((a, b) => num(b.financial?.advancePaid) - num(a.financial?.advancePaid))
        .slice(0, MAX_FINANCE_ROWS)
        .map((booking) => ({
            id: bookingIdOf(booking),
            bookingNumber: String(booking.bookingNumber ?? ""),
            eventName: eventNameOf(booking),
            eventType: eventTypeOf(booking),
            hallName: hallNameOf(booking),
            applicantName: customerNameOf(booking),
            startDate: iso(booking.schedule?.startDate),
            endDate: iso(booking.schedule?.endDate),
            status: String(booking.status ?? ""),
            paymentStatus: String(booking.paymentStatus ?? ""),
            totalAmount: num(booking.financial?.totalAmount),
            collected: num(booking.financial?.advancePaid),
            balance: num(booking.financial?.balanceAmount),
        }));

    const userNameById = new Map<string, string>(
        users.map((user) => [String(user._id ?? ""), String(user.name ?? "")]),
    );

    const paymentHistory: AnalyticsPaymentRow[] = [...periodPayments]
        .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime())
        .slice(0, MAX_PAYMENT_ROWS)
        .map((payment, index) => ({
            id: `${bookingIdOf(payment.booking)}-${payment.receivedAt.getTime()}-${index}`,
            bookingId: bookingIdOf(payment.booking),
            bookingNumber: String(payment.booking.bookingNumber ?? ""),
            eventName: eventNameOf(payment.booking),
            hallName: hallNameOf(payment.booking),
            amount: payment.amount,
            mode: payment.mode || "—",
            transactionId: payment.transactionId,
            receivedAt: payment.receivedAt.toISOString(),
            receivedBy:
                userNameById.get(payment.receivedBy) ||
                String(payment.booking.createdByName ?? "") ||
                "—",
            proof: payment.proof,
        }));

    const finance: AnalyticsFinance = {
        totalCollection: round2(collectedInPeriod),
        cashCollection,
        upiCollection,
        chequeCollection,
        neftCollection,
        onlineCollection: round2(upiCollection + neftCollection),
        modeSplit,
        pendingPayments: round2(pendingInPeriod),
        securityDepositCollected: round2(depositCollected),
        securityDepositReturned: round2(depositReturned),
        securityDepositsHeld: round2(Math.max(0, depositCollected - depositReturned - depositDeducted)),
        deductions: round2(depositDeducted),
        additionalCharges: round2(unitCharges),
        billedTotal: round2(billedInPeriod),
        eventWiseRevenue,
        paymentHistory,
    };

    // ── Events ──────────────────────────────────────────────────────────
    const sortedByDateDesc = (list: LeanBooking[]) =>
        [...list]
            .sort(
                (a, b) =>
                    new Date(b.schedule?.startDate ?? 0).getTime() -
                    new Date(a.schedule?.startDate ?? 0).getTime(),
            )
            .slice(0, MAX_EVENT_ROWS)
            .map(toEventRow);

    const events: AnalyticsEvents = {
        counts: {
            upcoming: upcomingCount,
            ongoing: ongoingDocs.length,
            completed: completedInPeriod.length,
            cancelled: cancelledInPeriod.length,
            total: startedInPeriod.length,
        },
        upcoming: upcomingDocs.map(toEventRow),
        ongoing: liveDocs.map(toEventRow),
        completed: sortedByDateDesc(completedInPeriod),
        cancelled: sortedByDateDesc(cancelledInPeriod),
    };

    // ── Venue / Hall ────────────────────────────────────────────────────
    interface HallBucket {
        hallId: string;
        hallName: string;
        capacity: number;
        bookings: number;
        billed: number;
        revenue: number;
        days: Set<string>;
        occupiedToday: boolean;
        todayBookings: number;
        upcomingBookings: number;
    }

    const hallBuckets = new Map<string, HallBucket>();
    const bucketFor = (booking: LeanBooking): HallBucket => {
        const hallId = String(booking.hallId ?? "");
        const key = hallId || `name:${hallNameOf(booking)}`;
        const existing = hallBuckets.get(key);
        if (existing) return existing;
        const created: HallBucket = {
            hallId,
            hallName: hallNameOf(booking),
            capacity: num(booking.hall?.capacity),
            bookings: 0,
            billed: 0,
            revenue: 0,
            days: new Set<string>(),
            occupiedToday: false,
            todayBookings: 0,
            upcomingBookings: 0,
        };
        hallBuckets.set(key, created);
        return created;
    };

    // Hall collection se pehle buckets bana dete hain, taake koi hall khaali
    // hone par bhi list me aaye.
    halls.forEach((hall) => {
        const hallId = String(hall._id ?? "");
        if (!hallBuckets.has(hallId)) {
            hallBuckets.set(hallId, {
                hallId,
                hallName: String(hall.name ?? "Hall"),
                capacity: num(hall.capacity),
                bookings: 0,
                billed: 0,
                revenue: 0,
                days: new Set<string>(),
                occupiedToday: false,
                todayBookings: 0,
                upcomingBookings: 0,
            });
        } else {
            // Booking se bana bucket ho to asli hall ka naam/capacity use karo.
            const bucket = hallBuckets.get(hallId)!;
            bucket.hallName = String(hall.name ?? bucket.hallName);
            bucket.capacity = num(hall.capacity) || bucket.capacity;
        }
    });

    startedInPeriod.forEach((booking) => {
        const bucket = bucketFor(booking);
        bucket.bookings += 1;
        bucket.billed += num(booking.financial?.totalAmount);
        dayKeysOf(booking, fromKey, toKey).forEach((key) => bucket.days.add(key));
    });
    periodPayments.forEach((payment) => {
        bucketFor(payment.booking).revenue += payment.amount;
    });
    liveDocs.forEach((booking) => {
        const bucket = bucketFor(booking);
        bucket.occupiedToday = true;
        bucket.todayBookings += 1;
    });
    upcomingDocs.forEach((booking) => {
        bucketFor(booking).upcomingBookings += 1;
    });
    const hallRows: AnalyticsHallRow[] = [...hallBuckets.values()]
        .map((bucket) => ({
            hallId: bucket.hallId,
            hallName: bucket.hallName,
            capacity: bucket.capacity,
            bookings: bucket.bookings,
            billed: round2(bucket.billed),
            revenue: round2(bucket.revenue),
            bookedDays: bucket.days.size,
            utilizationPct: Math.min(
                100,
                Math.round((bucket.days.size / Math.max(1, period.days)) * 100),
            ),
            occupiedToday: bucket.occupiedToday,
            todayBookings: bucket.todayBookings,
            upcomingBookings: bucket.upcomingBookings,
        }))
        .sort((a, b) => b.revenue - a.revenue);

    const activeHalls = halls.filter(
        (hall) => hall.isActive !== false && String(hall.status ?? "active") !== "maintenance",
    ).length;
    const occupiedHalls = hallRows.filter((row) => row.occupiedToday).length;
    const venue = {
        totalHalls: halls.length,
        activeHalls,
        occupiedToday: occupiedHalls,
        availableToday: Math.max(0, activeHalls - occupiedHalls),
        todayBookings: liveDocs.length,
        upcomingBookings: upcomingCount,
        halls: hallRows,
    };

    // ── Customers ───────────────────────────────────────────────────────
    const firstEverByKey = new Map<string, Date>(
        customerLifetime
            .filter((row) => row.first)
            .map((row) => [String(row._id ?? ""), new Date(row.first)]),
    );

    const customerBuckets = new Map<string, AnalyticsCustomerRow>();
    startedInPeriod.forEach((booking) => {
        const key = customerKeyOf(booking);
        if (!key) return;
        const start = booking.schedule?.startDate ? new Date(booking.schedule.startDate) : null;
        const existing = customerBuckets.get(key);
        const billed = booking.status === "Cancelled" ? 0 : num(booking.financial?.totalAmount);
        const revenue = booking.status === "Cancelled" ? 0 : num(booking.financial?.advancePaid);
        const pending = booking.status === "Cancelled" ? 0 : num(booking.financial?.balanceAmount);

        if (!existing) {
            customerBuckets.set(key, {
                name: customerNameOf(booking),
                mobile: customerMobileOf(booking),
                organization: String(booking.applicant?.organization ?? ""),
                bookings: 1,
                billed,
                revenue,
                pending,
                firstBookingAt: iso(start),
                lastBookingAt: iso(start),
            });
            return;
        }

        existing.bookings += 1;
        existing.billed += billed;
        existing.revenue += revenue;
        existing.pending += pending;
        if (start && (!existing.lastBookingAt || start.toISOString() > existing.lastBookingAt)) {
            existing.lastBookingAt = iso(start);
        }
        if (start && (!existing.firstBookingAt || start.toISOString() < existing.firstBookingAt)) {
            existing.firstBookingAt = iso(start);
        }
        // Naam/mobile khaali ho to behtar value le lo.
        if (!existing.mobile) existing.mobile = customerMobileOf(booking);
        if (!existing.organization) existing.organization = String(booking.applicant?.organization ?? "");
    });

    const customerRows = [...customerBuckets.values()];
    const newCustomers = [...customerBuckets.keys()].filter((key) => {
        const first = firstEverByKey.get(key);
        if (!first) return false;
        return first.getTime() >= from.getTime() && first.getTime() <= to.getTime();
    }).length;

    const pendingList: AnalyticsPendingRow[] = periodDocs
        .filter(
            (booking) =>
                booking.status !== "Cancelled" && num(booking.financial?.balanceAmount) > 0,
        )
        .sort(
            (a, b) => num(b.financial?.balanceAmount) - num(a.financial?.balanceAmount),
        )
        .slice(0, MAX_PENDING)
        .map((booking) => ({
            bookingId: bookingIdOf(booking),
            bookingNumber: String(booking.bookingNumber ?? ""),
            customerName: customerNameOf(booking),
            mobile: customerMobileOf(booking),
            eventName: eventNameOf(booking),
            hallName: hallNameOf(booking),
            startDate: iso(booking.schedule?.startDate),
            status: String(booking.status ?? ""),
            balance: num(booking.financial?.balanceAmount),
        }));

    const customers = {
        totalCustomers: customerRows.length,
        newCustomers,
        repeatCustomers: Math.max(0, customerRows.length - newCustomers),
        pendingCustomers: customerRows.filter((row) => row.pending > 0).length,
        pendingAmount: round2(customerRows.reduce((sum, row) => sum + row.pending, 0)),
        topCustomers: [...customerRows]
            .sort((a, b) => b.revenue - a.revenue || b.billed - a.billed)
            .slice(0, MAX_TOP_CUSTOMERS)
            .map((row) => ({
                ...row,
                billed: round2(row.billed),
                revenue: round2(row.revenue),
                pending: round2(row.pending),
            })),
        pendingList,
    };

    // ── Staff / Employees ──────────────────────────────────────────────
    const normalizeName = (value: unknown): string =>
        String(value ?? "").trim().toLowerCase();

    interface StaffBucket extends AnalyticsStaffRow {
        key: string;
    }

    const staffBuckets = new Map<string, StaffBucket>();
    users.forEach((user) => {
        const name = String(user.name ?? "").trim() || "Unnamed staff";
        const key = normalizeName(name);
        if (!key) return;
        staffBuckets.set(key, {
            key,
            userId: String(user._id ?? ""),
            name,
            role: String(user.role ?? ""),
            bookingsHandled: 0,
            bookingsCreated: 0,
            collected: 0,
            pending: 0,
            lastActivityAt: null,
        });
    });

    const staffBucketByName = (name: unknown): StaffBucket | null => {
        const key = normalizeName(name);
        if (!key) return null;
        const existing = staffBuckets.get(key);
        if (existing) return existing;
        const created: StaffBucket = {
            key,
            userId: "",
            name: String(name).trim(),
            role: "",
            bookingsHandled: 0,
            bookingsCreated: 0,
            collected: 0,
            pending: 0,
            lastActivityAt: null,
        };
        staffBuckets.set(key, created);
        return created;
    };

    const touchActivity = (bucket: StaffBucket, value?: Date | string | null) => {
        if (!value) return;
        const at = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(at.getTime())) return;
        if (!bucket.lastActivityAt || at.toISOString() > bucket.lastActivityAt) {
            bucket.lastActivityAt = at.toISOString();
        }
    };

    periodDocs.forEach((booking) => {
        const handled = staffBucketByName(booking.bookedByStaff);
        const created = staffBucketByName(booking.createdByName);
        const pending = booking.status === "Cancelled" ? 0 : num(booking.financial?.balanceAmount);

        if (handled) {
            handled.bookingsHandled += 1;
            handled.pending += pending;
            touchActivity(handled, booking.createdAt);
        }
        if (created) {
            created.bookingsCreated += 1;
            touchActivity(created, booking.createdAt);
        }
    });
    periodPayments.forEach((payment) => {
        const name = userNameById.get(payment.receivedBy);
        const bucket = name ? staffBucketByName(name) : null;
        if (bucket) {
            bucket.collected += payment.amount;
            touchActivity(bucket, payment.receivedAt);
        }
    });

    const staffRows: AnalyticsStaffRow[] = [...staffBuckets.values()]
        .map(({ key: _key, ...row }) => ({
            ...row,
            collected: round2(row.collected),
            pending: round2(row.pending),
        }))
        .sort((a, b) => b.collected - a.collected || b.bookingsHandled - a.bookingsHandled);

    const assignments: AnalyticsStaffAssignment[] = periodDocs
        .filter((booking) => String(booking.bookedByStaff ?? "").trim().length > 0)
        .slice(0, MAX_ASSIGNMENTS)
        .map((booking) => ({
            bookingId: bookingIdOf(booking),
            bookingNumber: String(booking.bookingNumber ?? ""),
            eventName: eventNameOf(booking),
            hallName: hallNameOf(booking),
            staffName: String(booking.bookedByStaff ?? "").trim(),
            startDate: iso(booking.schedule?.startDate),
            status: String(booking.status ?? ""),
            totalAmount: num(booking.financial?.totalAmount),
            collected: num(booking.financial?.advancePaid),
        }));

    const staff: AnalyticsStaff = {
        totalStaff: staffRows.length,
        staff: staffRows,
        assignments,
    };

    // ── Documents ───────────────────────────────────────────────────────
    // Booking ke andar jo bhi files/photo upload hoti hain, sab ek jagah.
    // (Verification state DB me nahi hai, isliye sirf listing + preview.)
    interface DocumentDraft {
        type: string;
        label: string;
        url: string;
        addedAt: Date;
    }

    const documentRows: AnalyticsDocumentRow[] = [];

    periodDocs.forEach((booking) => {
        const createdAt = booking.createdAt ? new Date(booking.createdAt) : now;
        const bookingId = bookingIdOf(booking);
        const drafts: DocumentDraft[] = [];

        const push = (type: string, label: string, url?: string, addedAt?: Date) => {
            const value = String(url ?? "").trim();
            if (!value) return;
            drafts.push({ type, label, url: value, addedAt: addedAt ?? createdAt });
        };

        push("eventImage", "Event Photo", booking.eventImage);
        push(
            "idProof",
            String(booking.applicant?.governmentId?.type ?? "").trim() || "ID Proof",
            booking.applicant?.governmentId?.photo,
        );
        push("eventEvidence", "Event Evidence", booking.event?.evidencePhoto);
        push("bookingForPhoto", "Booking For Photo", booking.event?.bookingForPhoto);

        (booking.financial?.units ?? []).forEach((unit) => {
            const name = String(unit?.label ?? "Unit").trim();
            push(
                "meterStart",
                `Meter Reading – ${name}`,
                unit?.meterPhoto,
            );
            push(
                "meterClosing",
                `Closing Meter – ${name}`,
                unit?.closingPhoto,
            );
        });

        push("applicantSignature", "Applicant Signature", booking.signatures?.applicantPhoto);
        push("managerSignature", "Manager Signature", booking.signatures?.managerPhoto);

        (booking.payments ?? []).forEach((payment) => {
            push(
                "paymentProof",
                `Payment Proof – ${String(payment?.mode ?? "Payment")}`,
                payment?.proof,
                payment?.receivedAt ? new Date(payment.receivedAt) : createdAt,
            );
        });

        (booking.handover?.items ?? []).forEach((item) => {
            push(
                "handover",
                `Handover – ${String(item?.label ?? "Item").trim()}`,
                item?.photo,
            );
        });

        drafts.forEach((draft, index) => {
            documentRows.push({
                id: `${bookingId}-${draft.type}-${index}`,
                bookingId,
                bookingNumber: String(booking.bookingNumber ?? ""),
                customerName: customerNameOf(booking),
                mobile: customerMobileOf(booking),
                eventName: eventNameOf(booking),
                hallName: hallNameOf(booking),
                type: draft.type,
                label: draft.label,
                url: draft.url,
                addedAt: draft.addedAt.toISOString(),
            });
        });
    });

    documentRows.sort(
        (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime(),
    );

    const documentTypeLabels: { key: string; label: string }[] = [
        { key: "paymentProof", label: "Payment proofs" },
        { key: "meterStart", label: "Meter readings" },
        { key: "meterClosing", label: "Closing meters" },
        { key: "applicantSignature", label: "Applicant signatures" },
        { key: "managerSignature", label: "Manager signatures" },
        { key: "idProof", label: "ID proofs" },
        { key: "eventImage", label: "Event photos" },
        { key: "eventEvidence", label: "Event evidence" },
        { key: "bookingForPhoto", label: "Booking-for photos" },
        { key: "handover", label: "Handover photos" },
    ];

    const documents = {
        total: documentRows.length,
        byType: documentTypeLabels
            .map((entry) => ({
                key: entry.key,
                label: entry.label,
                value: documentRows.filter((row) => row.type === entry.key).length,
            }))
            .filter((entry) => entry.value > 0),
        rows: documentRows.slice(0, MAX_DOCUMENT_ROWS),
    };

    // ── Reports & analytics ─────────────────────────────────────────────
    const bucketRevenue = (bucketFrom: Date, bucketTo: Date): number =>
        periodPayments
            .filter(
                (payment) =>
                    payment.receivedAt.getTime() >= bucketFrom.getTime() &&
                    payment.receivedAt.getTime() <= bucketTo.getTime(),
            )
            .reduce((sum, payment) => sum + payment.amount, 0);

    const bucketBookings = (bucketFrom: Date, bucketTo: Date): number =>
        startedInPeriod.filter((booking) => {
            const start = booking.schedule?.startDate
                ? new Date(booking.schedule.startDate)
                : null;
            if (!start || Number.isNaN(start.getTime())) return false;
            return (
                start.getTime() >= bucketFrom.getTime() && start.getTime() <= bucketTo.getTime()
            );
        }).length;

    const daily: { label: string; value: number }[] = [];
    for (let i = MAX_DAILY_POINTS - 1; i >= 0; i--) {
        const dayStart = addDays(todayStart, -i);
        // Period ke bahar wale din chart me nahi aate (e.g. "Today" filter).
        if (dayStart.getTime() < from.getTime()) continue;
        const dayEnd = new Date(dayStart.getTime() + DAY_MS - 1);
        daily.push({
            label: dayLabel(dayStart),
            value: round2(bucketRevenue(dayStart, dayEnd)),
        });
    }

    const weekly: { label: string; value: number }[] = [];
    const currentWeekStart = startOfIstWeek(now);
    for (let i = MAX_WEEKLY_POINTS - 1; i >= 0; i--) {
        const weekStart = addDays(currentWeekStart, -7 * i);
        const weekEnd = new Date(addDays(weekStart, 6).getTime() + DAY_MS - 1);
        if (weekEnd.getTime() < from.getTime()) continue;
        weekly.push({
            label: dayLabel(weekStart),
            value: round2(bucketRevenue(weekStart, weekEnd)),
        });
    }

    // Monthly buckets (comparison ke liye ek mahina extra).
    const monthlyPoints: { label: string; key: string; value: number; bookings: number }[] = [];
    for (let i = MAX_MONTHLY_POINTS; i >= 0; i--) {
        const monthStart = startOfIstMonth(now, -i);
        const monthEnd = new Date(startOfIstMonth(now, -i + 1).getTime() - 1);
        monthlyPoints.push({
            label: monthLabel(monthStart),
            key: monthKey(monthStart),
            value: round2(bucketRevenue(monthStart, monthEnd)),
            bookings: bucketBookings(monthStart, monthEnd),
        });
    }

    const monthly = monthlyPoints.slice(-MAX_MONTHLY_POINTS).map((point) => ({
        label: point.label,
        value: point.value,
    }));

    const monthlyComparison = monthlyPoints.slice(-COMPARISON_MONTHS).map((point, index, list) => {
        const previous = index > 0 ? list[index - 1] : monthlyPoints[monthlyPoints.indexOf(point) - 1];
        return {
            label: point.label,
            value: point.value,
            bookings: point.bookings,
            previousValue: previous?.value ?? 0,
            previousBookings: previous?.bookings ?? 0,
        };
    });

    const revenueByHall = new Map<string, number>();
    periodPayments.forEach((payment) => {
        const name = hallNameOf(payment.booking);
        revenueByHall.set(name, (revenueByHall.get(name) ?? 0) + payment.amount);
    });

    const typeBuckets = new Map<string, { value: number; count: number }>();
    startedInPeriod
        .filter((booking) => booking.status !== "Cancelled")
        .forEach((booking) => {
            const label = eventTypeOf(booking);
            const existing = typeBuckets.get(label) ?? { value: 0, count: 0 };
            existing.value += num(booking.financial?.advancePaid);
            existing.count += 1;
            typeBuckets.set(label, existing);
        });

    const depositReportRows: AnalyticsDepositRow[] = depositRows
        .slice(0, MAX_DEPOSIT_ROWS)
        .map((booking) => ({
            bookingId: bookingIdOf(booking),
            bookingNumber: String(booking.bookingNumber ?? ""),
            eventName: eventNameOf(booking),
            customerName: customerNameOf(booking),
            deposit: num(booking.financial?.securityDeposit),
            deducted: num(booking.financial?.securityDepositDeducted),
            reason: String(booking.financial?.securityDepositReason ?? ""),
            returned: booking.financial?.securityDepositReturned === true,
            startDate: iso(booking.schedule?.startDate),
        }));

    const reports: AnalyticsReports = {
        daily,
        weekly,
        monthly,
        byVenue: [...revenueByHall.entries()]
            .map(([label, value]) => ({ label, value: round2(value) }))
            .sort((a, b) => b.value - a.value),
        byEventType: [...typeBuckets.entries()]
            .map(([label, bucket]) => ({
                label,
                value: round2(bucket.value),
                count: bucket.count,
            }))
            .sort((a, b) => b.value - a.value),
        bookingsByEventType: [...typeBuckets.entries()]
            .map(([label, bucket]) => ({ label, value: bucket.count }))
            .sort((a, b) => b.value - a.value),
        cancellationRate:
            startedInPeriod.length > 0
                ? Math.round((cancelledInPeriod.length / startedInPeriod.length) * 1000) / 10
                : 0,
        pendingReport: {
            count: pendingList.length,
            amount: round2(pendingInPeriod),
        },
        depositReport: {
            collected: round2(depositCollected),
            returned: round2(depositReturned),
            deducted: round2(depositDeducted),
            held: round2(Math.max(0, depositCollected - depositReturned - depositDeducted)),
            rows: depositReportRows,
        },
        profitLoss: {
            billed: round2(billedInPeriod),
            collected: round2(collectedInPeriod),
            pending: round2(pendingInPeriod),
            refunds: round2(depositReturned),
            deductions: round2(depositDeducted),
            netPosition: round2(collectedInPeriod + depositDeducted - depositReturned),
        },
        monthlyComparison,
    };

    return {
        period,
        generatedAt: now.toISOString(),
        overview,
        finance,
        events,
        venue,
        customers,
        staff,
        documents,
        reports,
    };
};
