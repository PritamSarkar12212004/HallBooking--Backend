import mongoose from "mongoose";

export type PaymentMode =
    | "Cash"
    | "UPI"
    | "Cheque"
    | "NEFT/RTGS";

export type PaymentStatus =
    | "Paid"
    | "Partial"
    | "Pending";

export type BookingStatus =
    | "Draft"
    | "Pending"
    | "Office-Approved"
    | "Confirmed"
    | "Cancelled"
    | "Ended";


export interface IBookingHall {
    _id: mongoose.Types.ObjectId;
    name: string;
    capacity: number;
}


export interface IGovernmentId {
    type: string;
    /** Custom "Other ID" ka manually typed naam (fixed cards par khaali). */
    name?: string;
    number: string;
    photo?: string;
}


export interface IApplicant {
    name: string;
    organization?: string;
    mobile: string;
    address: string;
    email?: string;
    governmentId: IGovernmentId;
}


export interface IRequirementQuantity {
    label: string;
    quantity: number;
}

export interface IEvent {
    type: string;
    /** "Other" event type ka manually type kiya gaya naam. */
    customType?: string;
    /** Evidence / reference photo (Cloudinary URL). */
    evidencePhoto?: string;
    expectedAttendance: number;
    timeSlots: string[];
    hallRequirements: string[];
    /** Har selected hall requirement ki quantity. */
    requirementQuantities?: IRequirementQuantity[];
    name: string;
}


export interface IDecorator {
    name: string;
    contact: string;
    timing?: string;
}

export interface ICaterer {
    name: string;
    contact: string;
}

export interface IArrangements {
    decorator?: IDecorator;
    caterer?: ICaterer;
    kitchenRequired: boolean;
}


export interface ISchedule {
    startDate: Date;
    endDate: Date;
    startTime: string;
    endTime: string;
}


export interface IChargeItem {
    /** Charge head title, e.g. "Hall Rent", "Decoration" or any custom title. */
    label: string;
    /** Actual amount charged for this head. */
    amount: number;
    /** How much the customer has paid against this head. */
    paid: number;
}

export interface IUnitItem {
    /** Unit head title, e.g. "Water", "Light" or any custom title. */
    label: string;
    /** Number of units consumed. */
    quantity: number;
    /** Rate charged per unit. */
    perUnit: number;
    /** Derived = quantity × perUnit. */
    amount: number;
    /** Whether this unit charge has been paid. */
    paid: boolean;
}

export interface IFinancial {
    /** Actual amount breakdown — part of the total. */
    charges: IChargeItem[];
    /** Unit / consumption charges (water, light, AC, custom) — part of the total. */
    units?: IUnitItem[];
    /**
     * Refundable security deposit. It is intentionally NOT part of the
     * charges/total/balance calculation because it is returned to the customer.
     */
    securityDeposit?: number;
    /** Whether the deposit was returned to the customer at event end. */
    securityDepositReturned?: boolean;
    /** Amount deducted from the deposit (₹) at return time. */
    securityDepositDeducted?: number;
    /** Reason for the deduction (e.g. damage, extra consumption). */
    securityDepositReason?: string;
    /** Derived cache = sum(charges.amount) + sum(units.amount). */
    totalAmount?: number;
    /** Derived cache = sum(charges.paid). */
    advancePaid?: number;
    /** Derived cache = max(0, totalAmount - advancePaid). */
    balanceAmount?: number;
    mode?: PaymentMode;
}


export interface IFinanceChange {
    field: string;
    from: number;
    to: number;
}

export interface IFinanceHistoryEntry {
    editedByName: string;
    editedByMobile: string;
    editedAt: Date;
    changes: IFinanceChange[];
    /** Resulting balance after this update (plain value, not a diff). */
    balanceAfter?: number;
}


export interface IPayment {
    amount: number;
    mode: PaymentMode;
    transactionId?: string;
    receivedBy: mongoose.Types.ObjectId;
    receivedAt: Date;
    proof?: string;
}


export interface ISignatures {
    applicantPhoto?: string;
    managerPhoto?: string;
    termsAcceptedAt?: Date;
    termsVersion?: string;
}


export interface IHandoverItem {
    label: string;
    checked: boolean;
    remark?: string;
    photo?: string;
}

export interface IHandover {
    items: IHandoverItem[];
    completedAt?: Date;
}


export interface IApprovedBy {
    user: mongoose.Types.ObjectId;
    at: Date;
    note?: string;
}


export interface IBooking {
    bookingNumber: string;

    eventImage?: string;

    hall: IBookingHall;

    hallId?: mongoose.Types.ObjectId;

    applicant: IApplicant;

    event: IEvent;

    arrangements: IArrangements;

    schedule: ISchedule;
    financial: IFinancial;
    payments: IPayment[];
    financeHistory?: IFinanceHistoryEntry[];
    paymentStatus: PaymentStatus;
    signatures?: ISignatures;
    handover?: IHandover;
    status: BookingStatus;
    approvedBy?: IApprovedBy;
    bookedByStaff: string;
    createdBy: mongoose.Types.ObjectId;
    createdByName: string;
    // Set once the WhatsApp booking confirmation has been handed to the
    // gateway; its absence is the "not notified yet" signal (idempotency).
    confirmationNotifiedAt?: Date;
    // Same idempotency marker, but for the admin's own copy of the
    // confirmation message (so the customer retry loop never blocks it).
    adminNotifiedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}