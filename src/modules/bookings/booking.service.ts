import mongoose from "mongoose";
import Booking from "./booking.model.js";
import { ApiError } from "../../utils/api-error.js";
import type { IBooking, PaymentMode } from "./booking.type.js";
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
    financial.balanceAmount = Math.max(0, total - advance);
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
            if (d.decoratorName !== undefined) {
                booking.arrangements.decorator = { ...(booking.arrangements.decorator ?? {}), name: d.decoratorName };
            }
            if (d.decoratorContact !== undefined) {
                booking.arrangements.decorator = { ...(booking.arrangements.decorator ?? {}), contact: d.decoratorContact };
            }
            if (d.decorationTiming !== undefined) {
                booking.arrangements.decorator = { ...(booking.arrangements.decorator ?? {}), timing: d.decorationTiming };
            }
            if (d.catererName !== undefined) {
                booking.arrangements.caterer = { ...(booking.arrangements.caterer ?? {}), name: d.catererName };
            }
            if (d.catererContact !== undefined) {
                booking.arrangements.caterer = { ...(booking.arrangements.caterer ?? {}), contact: d.catererContact };
            }
            if (d.kitchenRequired !== undefined) {
                booking.arrangements.kitchenRequired = d.kitchenRequired === "Yes";
            }
            break;
        }
        case "payment": {
            const d = data as PaymentSectionInput;
            if (d.hallRent !== undefined) booking.financial.hallRent = d.hallRent;
            if (d.securityDeposit !== undefined) booking.financial.securityDeposit = d.securityDeposit;
            if (d.totalAmount !== undefined) booking.financial.totalAmount = d.totalAmount;
            if (d.advancePaid !== undefined) booking.financial.advancePaid = d.advancePaid;
            if (d.balanceAmount !== undefined) {
                booking.financial.balanceAmount = d.balanceAmount;
            } else {
                updateDocBalanceAmount(booking);
            }

            const mode = (d.mode ?? booking.financial.mode ?? "Cash") as PaymentMode;
            booking.financial.mode = mode;

            const transactionId = d.transactionNumber ?? booking.payments[0]?.transactionId ?? "";
            const proof = d.paymentProofPhoto ?? booking.payments[0]?.proof ?? "";

            booking.payments = [
                {
                    amount: booking.financial.advancePaid ?? 0,
                    mode,
                    transactionId,
                    receivedBy: new mongoose.Types.ObjectId(userId),
                    receivedAt: new Date(),
                    proof,
                },
            ];

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
                booking.signatures!.termsAcceptedAt = d.termsAccepted ? new Date() : undefined;
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

export const listBookings = async (): Promise<IBooking[]> => {
    return Booking.find().sort({ createdAt: -1 }).lean();
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
