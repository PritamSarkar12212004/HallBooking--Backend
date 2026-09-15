import type { BookingStatus } from "../bookings/booking.type.js";

/**
 * Sort keys supported by the applicant list.
 * - recent   : most recently booked applicant first
 * - oldest   : longest standing applicant first
 * - name     : alphabetical (A → Z)
 * - bookings : highest number of bookings first
 */
export type ApplicantSort = "recent" | "oldest" | "name" | "bookings";

export interface ListApplicantsQuery {
    page: number;
    pageSize: number;
    search: string;
    sort: ApplicantSort;
    includeDrafts: boolean;
}

/**
 * A single row of the applicant list.
 *
 * Applicants are derived from bookings (there is no separate applicant
 * collection), so `id` is a synthetic identity key — `m:<mobile>` when the
 * mobile number is usable, otherwise `n:<lower-cased name>`.
 */
export interface ApplicantListItem {
    id: string;
    name: string;
    mobile: string;
    image: string;
    organization: string;
    email: string;
    address: string;
    totalBookings: number;
    activeBookings: number;
    cancelledBookings: number;
    endedBookings: number;
    totalAmount: number;
    firstBookingAt: string;
    lastBookingAt: string;
    latestBookingNumber: string;
    latestEventName: string;
    latestEventDate: string;
    latestStatus: BookingStatus | "";
}

export interface PaginatedApplicants {
    applicants: ApplicantListItem[];
    total: number;
}
