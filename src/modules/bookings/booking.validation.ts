import { ApiError } from "../../utils/api-error.js";

export type BookingType = "1 Day" | "More Day";

export type BookingSection =
    | "event"
    | "applicant"
    | "arrangements"
    | "payment"
    | "declaration";

export const EVENT_TYPES = [
    "Wedding",
    "Birthday Party",
    "Engagement",
    "Reception",
    "Corporate Event",
    "Conference",
    "Seminar",
    "Workshop",
    "Exhibition",
    "Product Launch",
    "Anniversary",
    "Farewell Party",
    "School/College Event",
    "Cultural Program",
    "Religious Event",
] as const;

export const GOVERNMENT_ID_TYPES = [
    "Aadhaar Card",
    "PAN Card",
    "Driving Licence",
    "Passport",
] as const;

export const HALL_REQUIREMENTS = [
    "Stage",
    "Tables",
    "Chairs",
    "Dining Area",
    "Catering",
    "Sound System",
    "Microphone",
    "Projector",
    "LED Screen",
    "Air Conditioning",
    "Decoration",
    "Lighting",
    "Generator/Backup Power",
    "Parking",
    "Green Room",
    "Registration Desk",
] as const;

export const BOOKING_TERMS = [
    "The booking will be confirmed only after receipt of the prescribed advance payment.",
    "Any damage to the hall, furniture, fixtures, or equipment shall be recovered from the security deposit or billed separately.",
    "The balance amount must be paid before the commencement of the event.",
    "The applicant is responsible for maintaining cleanliness and discipline during the event.",
    "Loud music must comply with applicable local laws and permissible timings.",
    "The management reserves the right to cancel the booking in case of violation of rules or misuse of the premises.",
    "The applicant shall vacate the hall within the booked time. Additional charges may apply for exceeding the allotted time.",
    "Smoking, illegal activities, and possession or consumption of prohibited substances inside the premises are strictly prohibited.",
    "The management shall not be responsible for loss, theft, or damage to personal belongings.",
] as const;

export const PAYMENT_MODES = ["Cash", "UPI", "Cheque", "NEFT/RTGS"] as const;

// "21 Aug 2026" -> Date
const parseDisplayDate = (value: string): Date => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        throw new ApiError(400, `Invalid date: "${value}". Use a format like "21 Aug 2026".`);
    }
    return parsed;
};

const asString = (value: unknown): string | undefined =>
    typeof value === "string" ? value.trim() : undefined;

const requiredString = (value: unknown, label: string): string => {
    const str = asString(value);
    if (!str) {
        throw new ApiError(400, `${label} is required`);
    }
    return str;
};

const asNumber = (value: unknown, label: string): number => {
    const num = Number(value);
    if (!Number.isFinite(num)) {
        throw new ApiError(400, `${label} must be a valid number`);
    }
    return num;
};

const asStringArray = (value: unknown, label: string): string[] => {
    if (value === undefined || value === null) {
        return [];
    }
    if (!Array.isArray(value)) {
        throw new ApiError(400, `${label} must be an array`);
    }
    return value.map((item) => String(item).trim()).filter(Boolean);
};

// ────────────── Step 1: Hall Calendar (POST draft) ──────────────
export interface HallCalendarInput {
    bookingType: string;
    startDate: string;
    endDate: string;
    startTime: string;
    endTime: string;
    eventName: string;
    bookedByStaff: string;
    eventImage?: string;
    allocatedTeam: string[];
    hallId?: string;
}

export const validateHallCalendar = (
    body: Record<string, unknown>
): HallCalendarInput => {
    let bookingType = asString(body?.bookingType);
    if (bookingType !== "1 Day" && bookingType !== "More Day") {
        bookingType = "1 Day";
    }

    const startDate = requiredString(body.startDate, "startDate");
    const endDate = requiredString(body.endDate, "endDate");
    const startTime = requiredString(body.startTime, "startTime");
    const endTime = requiredString(body.endTime, "endTime");
    const eventName = requiredString(body.eventName, "eventName");
    const bookedByStaff = requiredString(body.bookedByStaff, "bookedByStaff");
    const allocatedTeam = asStringArray(body.allocatedTeam, "allocatedTeam");

    const result: HallCalendarInput = {
        bookingType,
        startDate,
        endDate,
        startTime,
        endTime,
        eventName,
        bookedByStaff,
        allocatedTeam,
    };

    if (body.hallId !== undefined) {
        result.hallId = String(body.hallId);
    }

    if (body.eventImage !== undefined) {
        const img = asString(body.eventImage);
        if (img !== undefined) {
            result.eventImage = img;
        }
    }

    return result;
};

// ────────────── Step 2: Event ──────────────
export interface EventSectionInput {
    expectedAttendance?: number;
    type?: string;
    requirements?: string[];
}

export const validateEventSection = (
    body: Record<string, unknown>
): EventSectionInput => {
    const eventBody = (body?.event ?? body) as Record<string, unknown>;

    const result: EventSectionInput = {};

    if (eventBody.expectedAttendance !== undefined) {
        result.expectedAttendance = asNumber(
            eventBody.expectedAttendance,
            "event.expectedAttendance"
        );
    }

    if (eventBody.type !== undefined) {
        const type = requiredString(eventBody.type, "event.type");
        result.type = type;
    }

    if (eventBody.requirements !== undefined) {
        const requirements = asStringArray(
            eventBody.requirements,
            "event.requirements"
        );
        result.requirements = requirements;
    }

    return result;
};

// ────────────── Step 1b: Applicant ──────────────
export interface ApplicantSectionInput {
    name?: string;
    organization?: string | undefined;
    mobile?: string;
    address?: string;
    email?: string | undefined;
    governmentIdType?: string;
    governmentIdNumber?: string | undefined;
    governmentIdPhoto?: string | undefined;
}

export const validateApplicantSection = (
    body: Record<string, unknown>
): ApplicantSectionInput => {
    const appBody = (body?.applicant ?? body) as Record<string, unknown>;

    const result: ApplicantSectionInput = {};

    if (appBody.name !== undefined) {
        result.name = requiredString(appBody.name, "applicant.name");
    }
    if (appBody.organization !== undefined) {
        result.organization = asString(appBody.organization);
    }
    if (appBody.mobile !== undefined) {
        result.mobile = requiredString(appBody.mobile, "applicant.mobile");
    }
    if (appBody.address !== undefined) {
        result.address = requiredString(appBody.address, "applicant.address");
    }
    if (appBody.email !== undefined) {
        result.email = asString(appBody.email);
    }
    if (appBody.governmentIdType !== undefined) {
        const type = requiredString(appBody.governmentIdType, "applicant.governmentIdType");
        if ((GOVERNMENT_ID_TYPES as readonly string[]).indexOf(type) === -1) {
            throw new ApiError(400, "Invalid applicant.governmentIdType");
        }
        result.governmentIdType = type;
    }
    if (appBody.governmentIdNumber !== undefined) {
        result.governmentIdNumber = asString(appBody.governmentIdNumber);
    }
    if (appBody.governmentIdPhoto !== undefined) {
        result.governmentIdPhoto = asString(appBody.governmentIdPhoto);
    }

    return result;
};

// ────────────── Step 3: Arrangements ──────────────
export interface ArrangementsSectionInput {
    decoratorName?: string;
    decoratorContact?: string;
    decorationTiming?: string;
    catererName?: string;
    catererContact?: string;
    kitchenRequired?: "Yes" | "No";
}

export const validateArrangementsSection = (
    body: Record<string, unknown>
): ArrangementsSectionInput => {
    const arrBody = (body?.arrangements ?? body) as Record<string, unknown>;

    const result: ArrangementsSectionInput = {};

    if (arrBody.decoratorName !== undefined) {
        result.decoratorName = requiredString(arrBody.decoratorName, "decoratorName");
    }
    if (arrBody.decoratorContact !== undefined) {
        const c = asString(arrBody.decoratorContact);
        if (c) result.decoratorContact = c;
    }
    if (arrBody.decorationTiming !== undefined) {
        result.decorationTiming = requiredString(arrBody.decorationTiming, "decorationTiming");
    }
    if (arrBody.catererName !== undefined) {
        result.catererName = requiredString(arrBody.catererName, "catererName");
    }
    if (arrBody.catererContact !== undefined) {
        const c = asString(arrBody.catererContact);
        if (c) result.catererContact = c;
    }

    if (arrBody.kitchenRequired !== undefined) {
        const kr = arrBody.kitchenRequired;
        if (kr !== "Yes" && kr !== "No") {
            throw new ApiError(400, "Invalid arrangements.kitchenRequired (must be Yes or No)");
        }
        result.kitchenRequired = kr as "Yes" | "No";
    }

    return result;
};

// ────────────── Step 5: Payment ──────────────
export interface PaymentSectionInput {
    hallRent?: number;
    instrument?: number;
    securityDeposit?: number;
    totalAmount?: number;
    advancePaid?: number;
    finalPayment?: number;
    balanceAmount?: number;
    mode?: string;
    transactionNumber?: string | undefined;
    paymentProofPhoto?: string | undefined;
}

export const validatePaymentSection = (
    body: Record<string, unknown>
): PaymentSectionInput => {
    const payBody = (body?.payment ?? body) as Record<string, unknown>;

    const result: PaymentSectionInput = {};

    if (payBody.hallRent !== undefined) {
        result.hallRent = asNumber(payBody.hallRent, "payment.hallRent");
    }
    if (payBody.instrument !== undefined) {
        result.instrument = asNumber(payBody.instrument, "payment.instrument");
    }
    if (payBody.securityDeposit !== undefined) {
        result.securityDeposit = asNumber(payBody.securityDeposit, "payment.securityDeposit");
    }
    if (payBody.totalAmount !== undefined) {
        result.totalAmount = asNumber(payBody.totalAmount, "payment.totalAmount");
    }
    if (payBody.advancePaid !== undefined) {
        result.advancePaid = asNumber(payBody.advancePaid, "payment.advancePaid");
    }
    if (payBody.finalPayment !== undefined) {
        result.finalPayment = asNumber(payBody.finalPayment, "payment.finalPayment");
    }
    if (payBody.balanceAmount !== undefined) {
        result.balanceAmount = asNumber(payBody.balanceAmount, "payment.balanceAmount");
    }

    if (payBody.mode !== undefined) {
        const mode = requiredString(payBody.mode, "payment.mode");
        if ((PAYMENT_MODES as readonly string[]).indexOf(mode) === -1) {
            throw new ApiError(400, "Invalid payment.mode");
        }
        result.mode = mode;
    }

    if (payBody.transactionNumber !== undefined) {
        result.transactionNumber = asString(payBody.transactionNumber);
    }
    if (payBody.paymentProofPhoto !== undefined) {
        result.paymentProofPhoto = asString(payBody.paymentProofPhoto);
    }

    return result;
};

// ────────────── Step 6: Declaration ──────────────
export interface DeclarationSectionInput {
    applicantSignature?: string;
    managerSignature?: string;
    termsAccepted?: boolean;
}

export const validateDeclarationSection = (
    body: Record<string, unknown>
): DeclarationSectionInput => {
    const decBody = (body?.declaration ?? body) as Record<string, unknown>;

    const result: DeclarationSectionInput = {};

    if (decBody.applicantSignature !== undefined) {
        result.applicantSignature = requiredString(
            decBody.applicantSignature,
            "declaration.applicantSignature"
        );
    }
    if (decBody.managerSignature !== undefined) {
        result.managerSignature = requiredString(
            decBody.managerSignature,
            "declaration.managerSignature"
        );
    }
    if (decBody.termsAccepted !== undefined) {
        result.termsAccepted = Boolean(decBody.termsAccepted);
    }

    return result;
};
