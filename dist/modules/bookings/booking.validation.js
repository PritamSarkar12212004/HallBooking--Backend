import { ApiError } from "../../utils/api-error.js";
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
];
export const GOVERNMENT_ID_TYPES = [
    "Aadhaar Card",
    "PAN Card",
    "Driving Licence",
    "Passport",
];
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
];
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
];
export const PAYMENT_MODES = ["Cash", "UPI", "Cheque", "NEFT/RTGS"];
// "21 Aug 2026" -> Date
const parseDisplayDate = (value) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        throw new ApiError(400, `Invalid date: "${value}". Use a format like "21 Aug 2026".`);
    }
    return parsed;
};
const asString = (value) => typeof value === "string" ? value.trim() : undefined;
const requiredString = (value, label) => {
    const str = asString(value);
    if (!str) {
        throw new ApiError(400, `${label} is required`);
    }
    return str;
};
const asNumber = (value, label) => {
    const num = Number(value);
    if (!Number.isFinite(num)) {
        throw new ApiError(400, `${label} must be a valid number`);
    }
    return num;
};
const asStringArray = (value, label) => {
    if (value === undefined || value === null) {
        return [];
    }
    if (!Array.isArray(value)) {
        throw new ApiError(400, `${label} must be an array`);
    }
    return value.map((item) => String(item).trim()).filter(Boolean);
};
export const validateHallCalendar = (body) => {
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
    const result = {
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
export const validateEventSection = (body) => {
    const eventBody = (body?.event ?? body);
    const result = {};
    if (eventBody.expectedAttendance !== undefined) {
        result.expectedAttendance = asNumber(eventBody.expectedAttendance, "event.expectedAttendance");
    }
    if (eventBody.type !== undefined) {
        const type = requiredString(eventBody.type, "event.type");
        result.type = type;
    }
    if (eventBody.requirements !== undefined) {
        const requirements = asStringArray(eventBody.requirements, "event.requirements");
        result.requirements = requirements;
    }
    return result;
};
export const validateApplicantSection = (body) => {
    const appBody = (body?.applicant ?? body);
    const result = {};
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
        if (GOVERNMENT_ID_TYPES.indexOf(type) === -1) {
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
export const validateArrangementsSection = (body) => {
    const arrBody = (body?.arrangements ?? body);
    const result = {};
    if (arrBody.decoratorName !== undefined) {
        result.decoratorName = requiredString(arrBody.decoratorName, "decoratorName");
    }
    if (arrBody.decoratorContact !== undefined) {
        const c = asString(arrBody.decoratorContact);
        if (c)
            result.decoratorContact = c;
    }
    if (arrBody.decorationTiming !== undefined) {
        result.decorationTiming = requiredString(arrBody.decorationTiming, "decorationTiming");
    }
    if (arrBody.catererName !== undefined) {
        result.catererName = requiredString(arrBody.catererName, "catererName");
    }
    if (arrBody.catererContact !== undefined) {
        const c = asString(arrBody.catererContact);
        if (c)
            result.catererContact = c;
    }
    if (arrBody.kitchenRequired !== undefined) {
        const kr = arrBody.kitchenRequired;
        if (kr !== "Yes" && kr !== "No") {
            throw new ApiError(400, "Invalid arrangements.kitchenRequired (must be Yes or No)");
        }
        result.kitchenRequired = kr;
    }
    return result;
};
export const validatePaymentSection = (body) => {
    const payBody = (body?.payment ?? body);
    const result = {};
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
        if (PAYMENT_MODES.indexOf(mode) === -1) {
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
export const validateDeclarationSection = (body) => {
    const decBody = (body?.declaration ?? body);
    const result = {};
    if (decBody.applicantSignature !== undefined) {
        result.applicantSignature = requiredString(decBody.applicantSignature, "declaration.applicantSignature");
    }
    if (decBody.managerSignature !== undefined) {
        result.managerSignature = requiredString(decBody.managerSignature, "declaration.managerSignature");
    }
    if (decBody.termsAccepted !== undefined) {
        result.termsAccepted = Boolean(decBody.termsAccepted);
    }
    return result;
};
//# sourceMappingURL=booking.validation.js.map