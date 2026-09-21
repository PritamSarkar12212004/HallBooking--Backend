/**
 * CEO Business Analytics (read-only reporting) ke response types.
 *
 * Section structure exactly wahi hai jo CEO screen par dikhta hai:
 * overview · finance · events · venue · customers · staff · reports.
 */

export type AnalyticsPeriodKey =
    | "today"
    | "week"
    | "month"
    | "quarter"
    | "year"
    | "all"
    | "custom";

export interface AnalyticsPeriod {
    key: AnalyticsPeriodKey;
    label: string;
    /** Period ki shuruaat (ISO). "all" me earliest booking ki date. */
    from: string;
    /** Period ka aaj tak ka aakhri din (ISO). */
    to: string;
    /** Period kitne din ka hai (charts/utilization ke liye). */
    days: number;
}

export interface AnalyticsOverview {
    totalEvents: number;
    upcomingEvents: number;
    ongoingEvents: number;
    completedEvents: number;
    cancelledEvents: number;
    todayEvents: number;
    /** Charges + units ka billed total (period ki bookings). */
    totalBilled: number;
    /** Actual paisa jo period me receive hua (payments ledger). */
    totalCollected: number;
    /** Baaki (billed - collected) non-cancelled bookings ka. */
    pendingPayments: number;
    /** Wapas kiye gaye security deposits (returned - deducted). */
    refunds: number;
    /** Period me liye gaye security deposits. */
    securityDeposits: number;
    /** Abhi jo deposits hold me hain (collected - returned). */
    securityDepositsHeld: number;
    /** Deposit me se kaati gayi raqam. */
    deductions: number;
    /**
     * Cash-basis net position = collected + deductions - refunds.
     * (Ye accounting profit nahi hai — expenses track nahi hote.)
     */
    netRevenue: number;
}

export interface AnalyticsModeSplit {
    mode: string;
    amount: number;
    count: number;
}

export interface AnalyticsEventRevenueRow {
    id: string;
    bookingNumber: string;
    eventName: string;
    eventType: string;
    hallName: string;
    applicantName: string;
    startDate: string;
    endDate: string;
    status: string;
    paymentStatus: string;
    totalAmount: number;
    collected: number;
    balance: number;
}

export interface AnalyticsPaymentRow {
    id: string;
    bookingId: string;
    bookingNumber: string;
    eventName: string;
    hallName: string;
    amount: number;
    mode: string;
    transactionId: string;
    receivedAt: string;
    receivedBy: string;
    proof: string;
}

export interface AnalyticsFinance {
    totalCollection: number;
    cashCollection: number;
    upiCollection: number;
    chequeCollection: number;
    neftCollection: number;
    /** UPI + NEFT/RTGS — "online" ka jodi hua figure. */
    onlineCollection: number;
    modeSplit: AnalyticsModeSplit[];
    pendingPayments: number;
    securityDepositCollected: number;
    securityDepositReturned: number;
    securityDepositsHeld: number;
    deductions: number;
    /** Unit consumption (additional charges) ka billed amount. */
    additionalCharges: number;
    billedTotal: number;
    eventWiseRevenue: AnalyticsEventRevenueRow[];
    paymentHistory: AnalyticsPaymentRow[];
}

export interface AnalyticsEventRow {
    id: string;
    bookingNumber: string;
    eventName: string;
    eventType: string;
    hallName: string;
    applicantName: string;
    applicantMobile: string;
    bookedFor: string;
    startDate: string;
    endDate: string;
    startTime: string;
    endTime: string;
    status: string;
    paymentStatus: string;
    totalAmount: number;
    collected: number;
    balance: number;
    bookedByStaff: string;
}

export interface AnalyticsEvents {
    counts: {
        upcoming: number;
        ongoing: number;
        completed: number;
        cancelled: number;
        total: number;
    };
    upcoming: AnalyticsEventRow[];
    ongoing: AnalyticsEventRow[];
    completed: AnalyticsEventRow[];
    cancelled: AnalyticsEventRow[];
}

export interface AnalyticsHallRow {
    hallId: string;
    hallName: string;
    capacity: number;
    bookings: number;
    billed: number;
    revenue: number;
    /** Period me kitne din hall booked raha. */
    bookedDays: number;
    /** bookedDays / period days. */
    utilizationPct: number;
    occupiedToday: boolean;
    todayBookings: number;
    upcomingBookings: number;
}

export interface AnalyticsVenue {
    totalHalls: number;
    activeHalls: number;
    occupiedToday: number;
    availableToday: number;
    todayBookings: number;
    upcomingBookings: number;
    halls: AnalyticsHallRow[];
}

export interface AnalyticsCustomerRow {
    name: string;
    mobile: string;
    organization: string;
    bookings: number;
    billed: number;
    revenue: number;
    pending: number;
    firstBookingAt: string;
    lastBookingAt: string;
}

export interface AnalyticsPendingRow {
    bookingId: string;
    bookingNumber: string;
    customerName: string;
    mobile: string;
    eventName: string;
    hallName: string;
    startDate: string;
    status: string;
    balance: number;
}

export interface AnalyticsCustomers {
    totalCustomers: number;
    newCustomers: number;
    repeatCustomers: number;
    pendingCustomers: number;
    pendingAmount: number;
    topCustomers: AnalyticsCustomerRow[];
    pendingList: AnalyticsPendingRow[];
}

export interface AnalyticsStaffRow {
    userId: string;
    name: string;
    role: string;
    /** Is staff ne kitni bookings me bookedByStaff entry ki. */
    bookingsHandled: number;
    /** Is staff ne kitni bookings create ki. */
    bookingsCreated: number;
    /** Is staff ne period me kitna collection receive kiya. */
    collected: number;
    /** Us collection me kitna baaki hai (billed - collected) un bookings ka. */
    pending: number;
    lastActivityAt: string | null;
}

export interface AnalyticsStaffAssignment {
    bookingId: string;
    bookingNumber: string;
    eventName: string;
    hallName: string;
    staffName: string;
    startDate: string;
    status: string;
    totalAmount: number;
    collected: number;
}

export interface AnalyticsStaff {
    totalStaff: number;
    staff: AnalyticsStaffRow[];
    assignments: AnalyticsStaffAssignment[];
}

export interface AnalyticsReportSeries {
    label: string;
    value: number;
}

export interface AnalyticsTypeBreakdown {
    label: string;
    value: number;
    count: number;
}

export interface AnalyticsDepositRow {
    bookingId: string;
    bookingNumber: string;
    eventName: string;
    customerName: string;
    deposit: number;
    deducted: number;
    reason: string;
    returned: boolean;
    startDate: string;
}

export interface AnalyticsReports {
    daily: AnalyticsReportSeries[];
    weekly: AnalyticsReportSeries[];
    monthly: AnalyticsReportSeries[];
    byVenue: AnalyticsReportSeries[];
    byEventType: AnalyticsTypeBreakdown[];
    bookingsByEventType: AnalyticsReportSeries[];
    /** Cancelled / total events (%). */
    cancellationRate: number;
    pendingReport: { count: number; amount: number };
    depositReport: {
        collected: number;
        returned: number;
        deducted: number;
        held: number;
        rows: AnalyticsDepositRow[];
    };
    profitLoss: {
        billed: number;
        collected: number;
        pending: number;
        refunds: number;
        deductions: number;
        netPosition: number;
    };
    monthlyComparison: {
        label: string;
        value: number;
        bookings: number;
        previousValue: number;
        previousBookings: number;
    }[];
}

export interface CeoAnalytics {
    period: AnalyticsPeriod;
    generatedAt: string;
    overview: AnalyticsOverview;
    finance: AnalyticsFinance;
    events: AnalyticsEvents;
    venue: AnalyticsVenue;
    customers: AnalyticsCustomers;
    staff: AnalyticsStaff;
    reports: AnalyticsReports;
}
