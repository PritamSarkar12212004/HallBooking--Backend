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
        if (EVENT_TYPES.indexOf(type) === -1) {
            throw new ApiError(400, "Invalid event.type");
        }
        result.type = type;
    }
    if (eventBody.requirements !== undefined) {
        const requirements = asStringArray(eventBody.requirements, "event.requirements");
        for (const req of requirements) {
            if (HALL_REQUIREMENTS.indexOf(req) === -1) {
                throw new ApiError(400, `Invalid requirement: ${req}`);
            }
        }
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
        result.decoratorContact = requiredString(arrBody.decoratorContact, "decoratorContact");
    }
    if (arrBody.decorationTiming !== undefined) {
        result.decorationTiming = requiredString(arrBody.decorationTiming, "decorationTiming");
    }
    if (arrBody.catererName !== undefined) {
        result.catererName = requiredString(arrBody.catererName, "catererName");
    }
    if (arrBody.catererContact !== undefined) {
        result.catererContact = requiredString(arrBody.catererContact, "catererContact");
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
    if (payBody.securityDeposit !== undefined) {
        result.securityDeposit = asNumber(payBody.securityDeposit, "payment.securityDeposit");
    }
    if (payBody.totalAmount !== undefined) {
        result.totalAmount = asNumber(payBody.totalAmount, "payment.totalAmount");
    }
    if (payBody.advancePaid !== undefined) {
        result.advancePaid = asNumber(payBody.advancePaid, "payment.advancePaid");
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