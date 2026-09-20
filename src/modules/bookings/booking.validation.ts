import { ApiError } from "../../utils/api-error.js";

/** Applicant email optional hai — bhara ho to ye format follow karega. */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    "ID Card",
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

/** "Other ID" naam ki limit — frontend ke sanitize ke saath match karti hai. */
export const GOVERNMENT_ID_NAME_MIN_LENGTH = 3;
export const GOVERNMENT_ID_NAME_MAX_LENGTH = 60;

/** "Other" event type ke naam ki limit — frontend ke sanitize ke saath match. */
export const EVENT_CUSTOM_TYPE_MIN_LENGTH = 3;
export const EVENT_CUSTOM_TYPE_MAX_LENGTH = 40;

/** Booking kis ke liye hai — applicant khud ya kisi aur ke liye. */
export const BOOKING_FOR_SELF = "Myself";
export const BOOKING_FOR_OTHER = "Someone Else";
export const BOOKING_FOR_VALUES = [BOOKING_FOR_SELF, BOOKING_FOR_OTHER] as const;

/** Mobile numbers har jagah 10 digits ke — frontend ke PhoneFunction ke saath match. */
export const MOBILE_LENGTH = 10;

/**
 * "Someone Else" ke naam/relation/contact ki limits — frontend ke saath match.
 * Contact number baaki app ki tarah 10 digits ka hi hota hai (MOBILE_LENGTH).
 */
export const BOOKING_FOR_NAME_MIN_LENGTH = 3;
export const BOOKING_FOR_NAME_MAX_LENGTH = 60;
export const BOOKING_FOR_RELATION_MAX_LENGTH = 40;
export const BOOKING_FOR_MOBILE_MAX_LENGTH = MOBILE_LENGTH;

const parseDisplayDate = (value: string): Date => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        throw new ApiError(400, `Invalid date: "${value}". Use a format like "21 Aug 2026".`);
    }
    return parsed;
};

const asString = (value: unknown): string | undefined =>
    typeof value === "string" ? value.trim() : undefined;

const MOBILE_REGEX = new RegExp(`^[0-9]{${MOBILE_LENGTH}}$`);

/** Optional mobile: khaali chalega, bhara ho to poora 10 digits ka hona chahiye. */
const asOptionalMobile = (value: unknown, label: string): string => {
    const mobile = asString(value) ?? "";

    if (mobile && !MOBILE_REGEX.test(mobile)) {
        throw new ApiError(
            400,
            `${label} must be a valid ${MOBILE_LENGTH}-digit mobile number`
        );
    }

    return mobile;
};

/** Required mobile — format bhi check hota hai. */
const asRequiredMobile = (value: unknown, label: string): string => {
    const mobile = requiredString(value, label);

    if (!MOBILE_REGEX.test(mobile)) {
        throw new ApiError(
            400,
            `${label} must be a valid ${MOBILE_LENGTH}-digit mobile number`
        );
    }

    return mobile;
};

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

/**
 * Hall requirements ki quantity list — frontend har selected requirement ke
 * saath `{ label, quantity }` bhejta hai. Quantity 0 allowed hai (matlab "abhi
 * decide nahi"), kyunki purane clients ye field bhejte hi nahi.
 */
const asRequirementQuantities = (
    value: unknown
): { label: string; quantity: number }[] => {
    if (value === undefined || value === null) {
        return [];
    }
    if (!Array.isArray(value)) {
        throw new ApiError(400, "event.requirementQuantities must be an array");
    }
    return value.map((raw, index) => {
        const item = (raw ?? {}) as Record<string, unknown>;
        const label = requiredString(
            item.label,
            `event.requirementQuantities[${index}].label`
        );
        const quantity = asNumber(
            item.quantity ?? 0,
            `event.requirementQuantities[${index}].quantity`
        );
        if (quantity < 0) {
            throw new ApiError(
                400,
                `event.requirementQuantities[${index}].quantity must be 0 or more`
            );
        }
        return { label, quantity };
    });
};

export interface HallCalendarInput {
    bookingType: string;
    startDate: string;
    endDate: string;
    startTime: string;
    endTime: string;
    eventName: string;
    bookedByStaff: string;
    eventImage?: string;
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

    const result: HallCalendarInput = {
        bookingType,
        startDate,
        endDate,
        startTime,
        endTime,
        eventName,
        bookedByStaff,
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

export interface EventSectionInput {
    expectedAttendance?: number;
    type?: string;
    requirements?: string[];
    /** "Other" event type ka manually type kiya gaya naam (optional). */
    customType?: string | undefined;
    /** Evidence / reference photo ka Cloudinary URL (optional). */
    evidencePhoto?: string | undefined;
    /** Har selected requirement ki quantity (optional). */
    requirementQuantities?: { label: string; quantity: number }[];
    /** Booking kis ke liye hai — "Myself" | "Someone Else" (optional). */
    bookingFor?: string | undefined;
    /** "Someone Else" ka naam — us case me zaroori. */
    bookingForName?: string | undefined;
    /** Us person ka applicant se rishta (optional). */
    bookingForRelation?: string | undefined;
    /** Us person ka contact number (optional). */
    bookingForMobile?: string | undefined;
    /** Event-related photo / proof ka Cloudinary URL (optional). */
    bookingForPhoto?: string | undefined;
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

    // "Other" event type ka manually type kiya gaya naam (optional).
    if (eventBody.customType !== undefined) {
        const customType = asString(eventBody.customType);
        if (
            customType &&
            (customType.length < EVENT_CUSTOM_TYPE_MIN_LENGTH ||
                customType.length > EVENT_CUSTOM_TYPE_MAX_LENGTH)
        ) {
            throw new ApiError(
                400,
                `event.customType must be ${EVENT_CUSTOM_TYPE_MIN_LENGTH}-${EVENT_CUSTOM_TYPE_MAX_LENGTH} characters`
            );
        }
        result.customType = customType;
    }

    // Evidence / reference photo (Cloudinary URL) — optional.
    if (eventBody.evidencePhoto !== undefined) {
        result.evidencePhoto = asString(eventBody.evidencePhoto);
    }

    // Har selected requirement ki quantity — optional.
    if (eventBody.requirementQuantities !== undefined) {
        result.requirementQuantities = asRequirementQuantities(
            eventBody.requirementQuantities
        );
    }

    // Booking kis ke liye hai — sirf do allowed values (optional).
    if (eventBody.bookingFor !== undefined) {
        const bookingFor = asString(eventBody.bookingFor) ?? "";

        if (
            bookingFor &&
            !BOOKING_FOR_VALUES.includes(bookingFor as any)
        ) {
            throw new ApiError(
                400,
                `event.bookingFor must be one of: ${BOOKING_FOR_VALUES.join(", ")}`
            );
        }

        result.bookingFor = bookingFor;
    }

    // "Someone Else" ka naam — diya gaya ho to limits ke andar hona chahiye.
    if (eventBody.bookingForName !== undefined) {
        const name = asString(eventBody.bookingForName) ?? "";

        if (
            name &&
            (name.length < BOOKING_FOR_NAME_MIN_LENGTH ||
                name.length > BOOKING_FOR_NAME_MAX_LENGTH)
        ) {
            throw new ApiError(
                400,
                `event.bookingForName must be ${BOOKING_FOR_NAME_MIN_LENGTH}-${BOOKING_FOR_NAME_MAX_LENGTH} characters`
            );
        }

        result.bookingForName = name;
    }

    if (eventBody.bookingForRelation !== undefined) {
        const relation = asString(eventBody.bookingForRelation) ?? "";

        if (relation.length > BOOKING_FOR_RELATION_MAX_LENGTH) {
            throw new ApiError(
                400,
                `event.bookingForRelation must be at most ${BOOKING_FOR_RELATION_MAX_LENGTH} characters`
            );
        }

        result.bookingForRelation = relation;
    }

    if (eventBody.bookingForMobile !== undefined) {
        result.bookingForMobile = asOptionalMobile(
            eventBody.bookingForMobile,
            "event.bookingForMobile"
        );
    }

    // Event-related photo / proof (Cloudinary URL) — optional.
    if (eventBody.bookingForPhoto !== undefined) {
        result.bookingForPhoto = asString(eventBody.bookingForPhoto) ?? "";
    }

    // "Someone Else" ke liye booking me naam ke bina kuch record nahi hota —
    // isliye server par bhi yahi rule (client par bhi wahi validation hai).
    const resolvedFor = result.bookingFor ?? undefined;
    const resolvedName = result.bookingForName ?? "";

    if (
        resolvedFor === BOOKING_FOR_OTHER &&
        eventBody.bookingForName !== undefined &&
        resolvedName.length < BOOKING_FOR_NAME_MIN_LENGTH
    ) {
        throw new ApiError(
            400,
            `event.bookingForName is required when event.bookingFor is "${BOOKING_FOR_OTHER}"`
        );
    }

    return result;
};

export interface ApplicantSectionInput {
    name?: string;
    organization?: string | undefined;
    mobile?: string;
    address?: string;
    email?: string | undefined;
    governmentIdType?: string;
    /** Custom "Other ID" ka manually typed naam (optional). */
    governmentIdName?: string | undefined;
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
        result.mobile = asRequiredMobile(appBody.mobile, "applicant.mobile");
    }
    if (appBody.address !== undefined) {
        result.address = requiredString(appBody.address, "applicant.address");
    }
    // Email optional hai — bheja jaaye to sirf format check hota hai (khaali
    // string ya missing field par koi error nahi).
    if (appBody.email !== undefined) {
        const email = asString(appBody.email);
        if (email && !EMAIL_REGEX.test(email)) {
            throw new ApiError(400, "Invalid applicant.email");
        }
        result.email = email;
    }
    if (appBody.governmentIdType !== undefined) {
        const type = requiredString(appBody.governmentIdType, "applicant.governmentIdType");
        if ((GOVERNMENT_ID_TYPES as readonly string[]).indexOf(type) === -1) {
            throw new ApiError(400, "Invalid applicant.governmentIdType");
        }
        result.governmentIdType = type;
    }
    // "Other ID" — frontend me manually type kiya gaya custom ID naam. Fixed
    // card ("Aadhaar Card", etc.) ke saath khaali aata hai, isliye optional hai;
    // diya jaaye to 3-60 characters ka hona chahiye.
    if (appBody.governmentIdName !== undefined) {
        const idName = asString(appBody.governmentIdName);
        if (
            idName &&
            (idName.length < GOVERNMENT_ID_NAME_MIN_LENGTH ||
                idName.length > GOVERNMENT_ID_NAME_MAX_LENGTH)
        ) {
            throw new ApiError(
                400,
                `applicant.governmentIdName must be ${GOVERNMENT_ID_NAME_MIN_LENGTH}-${GOVERNMENT_ID_NAME_MAX_LENGTH} characters`
            );
        }
        result.governmentIdName = idName;
    }
    // Manual entry — frontend se type kiya gaya ID number (optional).
    if (appBody.governmentIdNumber !== undefined) {
        result.governmentIdNumber = asString(appBody.governmentIdNumber);
    }
    if (appBody.governmentIdPhoto !== undefined) {
        result.governmentIdPhoto = asString(appBody.governmentIdPhoto);
    }

    return result;
};

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
        const dn = asString(arrBody.decoratorName);
        if (dn) result.decoratorName = dn;
    }
    if (arrBody.decoratorContact !== undefined) {
        const c = asOptionalMobile(arrBody.decoratorContact, "arrangements.decoratorContact");
        if (c) result.decoratorContact = c;
    }
    if (arrBody.decorationTiming !== undefined) {
        result.decorationTiming = requiredString(arrBody.decorationTiming, "decorationTiming");
    }
    if (arrBody.catererName !== undefined) {
        const cn = asString(arrBody.catererName);
        if (cn) result.catererName = cn;
    }
    if (arrBody.catererContact !== undefined) {
        const c = asOptionalMobile(arrBody.catererContact, "arrangements.catererContact");
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

export interface ChargeItemInput {
    label: string;
    amount: number;
    paid: number;
}

export interface UnitItemInput {
    label: string;
    quantity: number;
    perUnit: number;
    /** Meter reading — recorded only, excluded from payment calculations. */
    currentUnit: number;
    /** Optional meter photo (Cloudinary URL) captured with the reading. */
    meterPhoto?: string | undefined;
    /** Closing meter photo (event end) — closing reading ka evidence. */
    closingPhoto?: string | undefined;
    amount: number;
    paid: boolean;
}

export interface PaymentSectionInput {
    charges?: ChargeItemInput[];
    units?: UnitItemInput[];
    securityDeposit?: number;
    /** Deposit return flags set on the Finalize Event screen. */
    depositReturned?: boolean;
    depositDeducted?: number;
    depositReason?: string | undefined;
    mode?: string;
    transactionNumber?: string | undefined;
    paymentProofPhoto?: string | undefined;
    /**
     * Latest payment ka proof hata do (staff ne trash tap kiya, ya galti se
     * lagaya gaya proof clean karna hai). Explicit flag hai — khaali string se
     * clear nahi hota, warna har save purana proof uda deti.
     */
    removePaymentProof?: boolean;
    /** Event-end marker — staff swiped "End Event" on Finalize. */
    finalize?: boolean;
}

const asChargeItems = (value: unknown): ChargeItemInput[] => {
    if (!Array.isArray(value)) {
        throw new ApiError(400, "payment.charges must be an array");
    }
    return value.map((raw, index) => {
        const item = (raw ?? {}) as Record<string, unknown>;
        const label = requiredString(item.label, `payment.charges[${index}].label`);
        return {
            label,
            amount: asNumber(item.amount ?? 0, `payment.charges[${index}].amount`),
            paid: asNumber(item.paid ?? 0, `payment.charges[${index}].paid`),
        };
    });
};

const asUnitItems = (value: unknown): UnitItemInput[] => {
    if (!Array.isArray(value)) {
        throw new ApiError(400, "payment.units must be an array");
    }

    // Khaali rows auto-drop: jis unit me na **title** hai na **per-unit rate",
    // uska billing me koi matlab nahi — use chup-chaap hata dete hain (purani
    // app versions aisi rows bhej sakti hain). Title ya rate me se kuch bhi
    // bhara ho to row aage jaati hai aur validation poori tarah us par chalti
    // hai — frontend bhi Next par aisi rows hi bhejta hai (pruneUnitRowsForNext).
    const filled = value.filter((raw) => {
        const item = (raw ?? {}) as Record<string, unknown>;
        const hasLabel = String(item?.label ?? "").trim().length > 0;
        const hasRate = Number(item?.perUnit ?? 0) > 0;

        return hasLabel && hasRate;
    });

    return filled.map((raw, index) => {
        const item = (raw ?? {}) as Record<string, unknown>;
        const label = requiredString(item.label, `payment.units[${index}].label`);
        const quantity = asNumber(item.quantity ?? 0, `payment.units[${index}].quantity`);
        const perUnit = asNumber(item.perUnit ?? 0, `payment.units[${index}].perUnit`);
        // Amount is always derived server-side — never trusted from the client.
        // currentUnit (meter reading) is recorded but never charged.
        return {
            label,
            quantity,
            perUnit,
            currentUnit: asNumber(item.currentUnit ?? 0, `payment.units[${index}].currentUnit`),
            // Optional meter photo (URL) — reading ka evidence.
            meterPhoto: asString(item.meterPhoto) ?? "",
            // Closing meter photo (URL) — event end / Finalize se aati hai.
            closingPhoto: asString(item.closingPhoto) ?? "",
            amount: quantity * perUnit,
            paid: item.paid === true,
        };
    });
};

export const validatePaymentSection = (
    body: Record<string, unknown>
): PaymentSectionInput => {
    const payBody = (body?.payment ?? body) as Record<string, unknown>;

    const result: PaymentSectionInput = {};

    if (payBody.charges !== undefined) {
        result.charges = asChargeItems(payBody.charges);
    }
    if (payBody.units !== undefined) {
        result.units = asUnitItems(payBody.units);
    }
    if (payBody.securityDeposit !== undefined) {
        result.securityDeposit = asNumber(payBody.securityDeposit, "payment.securityDeposit");
    }
    if (payBody.depositReturned !== undefined) {
        result.depositReturned = payBody.depositReturned === true;
    }
    if (payBody.depositDeducted !== undefined) {
        result.depositDeducted = asNumber(payBody.depositDeducted, "payment.depositDeducted");
    }
    if (payBody.depositReason !== undefined) {
        result.depositReason = asString(payBody.depositReason);
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
    if (payBody.removePaymentProof !== undefined) {
        result.removePaymentProof = payBody.removePaymentProof === true;
    }
    if (payBody.finalize !== undefined) {
        result.finalize = payBody.finalize === true;
    }

    return result;
};

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
