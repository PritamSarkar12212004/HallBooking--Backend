import Booking from "./booking.model.js";
import User from "../user/user.model.js";
import { logger } from "../../utils/logger.js";
import { sendTemplateSms, type SendSmsResult } from "../../utils/sms.service.js";
import type { IBooking } from "./booking.type.js";

/**
 * WhatsApp confirmation for a completed hall booking.
 *
 * The booking document is created only on the last step ("Done" in step 6)
 * and then every section is PATCHed in order — `declaration` is the last one,
 * so a booking counts as confirmed once its signatures are stored. Sending is
 * fire-and-forget: the gateway can be cold for 30s+ and a failure there must
 * never fail the save.
 */

// Fallback hall name. The booking flow does not send `hallId` yet, so the
// linked Hall document is often empty — set SMS_BOOKING_HALL_NAME in the
// environment to hardcode the real hall name without a code change.
const DEFAULT_HALL_NAME = "Hall";

const INDIAN_TIME_ZONE = "Asia/Kolkata";

type SkipReason =
    | "not-ready"
    | "already-notified"
    | "no-recipient"
    | "gateway-error"
    | "inactive-status"
    | "error";

export interface BookingNotificationResult {
    sent: boolean;
    skipped?: SkipReason;
    variables?: Record<string, string>;
}

const toBookingId = (booking: IBooking): unknown =>
    (booking as unknown as { _id?: unknown })._id;

const normalizeDigits = (value?: string | null): string =>
    (value ?? "").replace(/\D/g, "");

const formatDate = (value?: Date | string | null): string => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";

    return date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: INDIAN_TIME_ZONE,
    });
};

// Slot strings arriving from the calendar can be "10:00" or "10:00 AM"; both
// are normalised to the "10:00 AM" shape used across the app.
const formatTime = (value?: string | null): string => {
    const raw = value?.trim();
    if (!raw) return "-";
    if (/am|pm/i.test(raw)) return raw.toUpperCase();

    const [hours, minutes] = raw.split(":");
    const hour = Number(hours);
    if (!Number.isFinite(hour)) return raw;

    const suffix = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${(minutes ?? "00").padStart(2, "0")} ${suffix}`;
};

// The approved template already prints the rupee sign in front of every amount
// placeholder, so only the grouped number is sent (otherwise it renders twice).
const formatAmount = (value?: number | null): string =>
    Number(value ?? 0).toLocaleString("en-IN");

// Stored phones carry the 91 country code ("919876543210"). The template shows
// this as the number to call, so it is rendered the way people dial it.
const formatContactNumber = (value?: string | null): string => {
    const digits = normalizeDigits(value);
    if (digits.length === 12 && digits.startsWith("91")) {
        return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
    }
    if (digits.length === 10) {
        return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
    }
    return value?.trim() ?? "";
};

const resolveHallName = (booking: IBooking): string => {
    const fromRef = booking.hall?.name?.trim();
    if (fromRef) return fromRef;

    const fromEnv = process.env.SMS_BOOKING_HALL_NAME?.trim();
    if (fromEnv) return fromEnv;

    // Step 1 labels this field "Event / Hall Name", so it is the best guess
    // available while the booking is not linked to a Hall document.
    const fromEvent = booking.event?.name?.trim();
    return fromEvent || DEFAULT_HALL_NAME;
};

const isConfirmationReady = (booking: IBooking): boolean => {
    const signatures = booking.signatures;
    return Boolean(
        signatures?.applicantPhoto &&
        signatures?.managerPhoto &&
        booking.applicant?.mobile?.trim()
    );
};

/**
 * Number of the person who made the booking — shown in the template as the
 * "for assistance, contact us" number.
 *
 * `bookedByStaff` is free text (a name typed in step 1), so the only reliable
 * source is the User who created the booking.
 */
const resolveBookerPhone = async (booking: IBooking): Promise<string> => {
    try {
        const creator = await User.findById(booking.createdBy).select("phone");
        const phone = creator?.phone?.trim();
        if (phone) return phone;
    } catch (error) {
        logger.error("Could not load the booker's phone for confirmation", {
            message: error instanceof Error ? error.message : String(error),
        });
    }

    // Legacy data: some entries typed the number instead of a name.
    const typed = booking.bookedByStaff?.trim() ?? "";
    return normalizeDigits(typed).length >= 10 ? typed : "";
};

/**
 * Template placeholders for a booking. Exported so the mapping can be previewed
 * / asserted without touching the gateway.
 */
export const buildBookingConfirmationVariables = (
    booking: IBooking,
    contactNumber: string
): Record<string, string> => ({
    customer_name: booking.applicant?.name?.trim() || "Guest",
    booking_id: booking.bookingNumber || String(toBookingId(booking)),
    hall_name: resolveHallName(booking),
    booking_date: formatDate(booking.schedule?.startDate),
    start_time: formatTime(booking.schedule?.startTime),
    end_time: formatTime(booking.schedule?.endTime),
    guest_count: String(booking.event?.expectedAttendance ?? 0),
    total_amount: formatAmount(booking.financial?.totalAmount),
    paid_amount: formatAmount(booking.financial?.advancePaid),
    remaining_amount: formatAmount(booking.financial?.balanceAmount),
    contact_number: formatContactNumber(contactNumber),
});

// A failed send must stay retryable, so the idempotency marker is removed
// again (the next save of any section will try once more).
const releaseClaim = async (bookingId: unknown): Promise<void> => {
    try {
        await Booking.updateOne(
            { _id: bookingId },
            { $unset: { confirmationNotifiedAt: 1 } }
        );
    } catch (error) {
        logger.error("Could not reset the booking notification marker", {
            message: error instanceof Error ? error.message : String(error),
        });
    }
};

/**
 * Sends the WhatsApp confirmation template for a booking exactly once.
 *
 * The recipient is the customer (`applicant.mobile`); the template's
 * `contact_number` placeholder carries the number of the user who booked, so
 * the customer knows who to call. Callers use this fire-and-forget — it never
 * throws.
 */
export const notifyBookingConfirmed = async (
    booking: IBooking
): Promise<BookingNotificationResult> => {
    try {
        if (!isConfirmationReady(booking)) {
            return { sent: false, skipped: "not-ready" };
        }

        if (booking.status === "Cancelled" || booking.status === "Ended") {
            return { sent: false, skipped: "inactive-status" };
        }

        const bookingId = toBookingId(booking);
        if (!bookingId) {
            return { sent: false, skipped: "not-ready" };
        }

        const recipient = booking.applicant.mobile.trim();
        if (!recipient) {
            return { sent: false, skipped: "no-recipient" };
        }

        // Only the request that flips the marker from "unset" to a date may
        // call the gateway, so a double tap / retry can never send twice.
        const claimed = await Booking.findOneAndUpdate(
            { _id: bookingId, confirmationNotifiedAt: { $exists: false } },
            { $set: { confirmationNotifiedAt: new Date() } },
            { new: true }
        );

        if (!claimed) {
            return { sent: false, skipped: "already-notified" };
        }

        const bookerPhone = await resolveBookerPhone(claimed);
        const variables = buildBookingConfirmationVariables(
            claimed,
            bookerPhone || recipient
        );

        const result = await sendTemplateSms({
            phone: recipient,
            variables,
            label: `Booking confirmation (${variables.booking_id})`,
        });

        if (!result.success) {
            logger.warn("Booking confirmation not delivered, will retry", {
                bookingNumber: variables.booking_id,
            });
            await releaseClaim(bookingId);
            return { sent: false, skipped: "gateway-error", variables };
        }

        return { sent: true, variables };
    } catch (error) {
        logger.error("Booking confirmation failed", {
            message: error instanceof Error ? error.message : String(error),
        });
        return { sent: false, skipped: "error" };
    }
};

// ─── Admin copy ─────────────────────────────────────────────────────────────
// The customer message can silently fail (wrong number, DND, cold gateway), so
// the hall admin gets the same confirmation on their own number and can follow
// up manually.

// Hall admin's WhatsApp number(s) — comma separated via SMS_ADMIN_PHONES.
// Default is the whitelisted CEO phone already used across the app.
const DEFAULT_ADMIN_PHONES = ["7796419792"];

// Dedicated template for the admin copy (same placeholders as the customer
// template). Overridable via SMS_ADMIN_TEMPLATE_ID.
const DEFAULT_ADMIN_TEMPLATE_ID = "6aad033cfdcd1a027b9e437d";

const resolveAdminPhones = (): string[] => {
    const fromEnv = (process.env.SMS_ADMIN_PHONES ?? "")
        .split(",")
        .map((phone) => phone.replace(/\D/g, ""))
        .filter((phone) => phone.length >= 10);

    return fromEnv.length > 0 ? fromEnv : DEFAULT_ADMIN_PHONES;
};

/**
 * Admin's own copy of the booking confirmation — sent to the hall admin's
 * number exactly once (own idempotency marker: `adminNotifiedAt`), with the
 * same template placeholders and the same header media the customer message
 * uses. Fire-and-forget, never throws.
 */
export const notifyBookingConfirmedToAdmin = async (
    booking: IBooking
): Promise<BookingNotificationResult> => {
    try {
        if (!isConfirmationReady(booking)) {
            return { sent: false, skipped: "not-ready" };
        }

        if (booking.status === "Cancelled" || booking.status === "Ended") {
            return { sent: false, skipped: "inactive-status" };
        }

        const bookingId = toBookingId(booking);
        if (!bookingId) {
            return { sent: false, skipped: "not-ready" };
        }

        const recipients = resolveAdminPhones();
        if (recipients.length === 0) {
            return { sent: false, skipped: "no-recipient" };
        }

        const claimed = await Booking.findOneAndUpdate(
            { _id: bookingId, adminNotifiedAt: { $exists: false } },
            { $set: { adminNotifiedAt: new Date() } },
            { new: true }
        );

        if (!claimed) {
            return { sent: false, skipped: "already-notified" };
        }

        const bookerPhone = await resolveBookerPhone(claimed);
        const variables = buildBookingConfirmationVariables(
            claimed,
            bookerPhone || claimed.applicant?.mobile || ""
        );

        // `mediaUrl` jaan-boojh kar omit hai — gateway wahi header image
        // attach karta hai jo customer confirmation me already use hoti hai.
        let failed: SendSmsResult | null = null;
        for (const phone of recipients) {
            const result = await sendTemplateSms({
                phone,
                templateId:
                    process.env.SMS_ADMIN_TEMPLATE_ID?.trim() ||
                    DEFAULT_ADMIN_TEMPLATE_ID,
                variables,
                label: `Admin booking confirmation (${variables.booking_id})`,
            });

            if (!result.success) {
                failed = result;
            }
        }

        if (failed) {
            logger.warn("Admin booking confirmation not delivered, will retry", {
                bookingNumber: variables.booking_id,
                statusCode: failed.statusCode,
            });
            await releaseClaim(bookingId);
            return { sent: false, skipped: "gateway-error", variables };
        }

        return { sent: true, variables };
    } catch (error) {
        logger.error("Admin booking confirmation failed", {
            message: error instanceof Error ? error.message : String(error),
        });
        return { sent: false, skipped: "error" };
    }
};