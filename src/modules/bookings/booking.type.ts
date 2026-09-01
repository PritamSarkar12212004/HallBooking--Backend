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
    | "Cancelled";


export interface IBookingHall {
    _id: mongoose.Types.ObjectId;
    name: string;
    capacity: number;
}


export interface IGovernmentId {
    type: string;
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


export interface IEvent {
    type: string;
    expectedAttendance: number;
    timeSlots: string[];
    hallRequirements: string[];
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


export interface IFinancial {
    hallRent?: number;
    instrument?: number;
    securityDeposit?: number;
    totalAmount?: number;
    advancePaid?: number;
    finalPayment?: number;
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
    allocatedTeam: string[];
    bookedByStaff: string;
    createdBy: mongoose.Types.ObjectId;
    createdByName: string;
    createdAt: Date;
    updatedAt: Date;
}