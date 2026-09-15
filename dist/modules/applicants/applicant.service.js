import Booking from "../bookings/booking.model.js";
/** Statuses that still count as a live/active engagement with the applicant. */
const ACTIVE_STATUSES = ["Pending", "Office-Approved", "Confirmed"];
const trimString = (path) => ({
    $trim: { input: { $ifNull: [path, ""] } },
});
const photoOrDefault = {
    $ifNull: ["$applicant.governmentId.photo", ""],
};
/**
 * Builds the synthetic identity key of a booking's applicant.
 *
 * Mobile numbers are stored free-form ("+91 98765 43210", "98765-43210", …),
 * so every booking is normalised to its digits and reduced to the last 10
 * digits (country/STD prefixes are dropped). When a booking has no usable
 * mobile number the lower-cased, trimmed name is used instead, so an applicant
 * without a phone number is still grouped instead of being duplicated.
 */
const IDENTITY_KEY = {
    $let: {
        vars: {
            digits: {
                $reduce: {
                    input: {
                        $regexFindAll: {
                            input: { $ifNull: ["$applicant.mobile", ""] },
                            regex: "[0-9]+",
                        },
                    },
                    initialValue: "",
                    in: {
                        $concat: ["$$value", { $ifNull: ["$$this.match", ""] }],
                    },
                },
            },
            nameKey: {
                $toLower: { $trim: { input: { $ifNull: ["$applicant.name", ""] } } },
            },
        },
        in: {
            $cond: [
                { $gte: [{ $strLenCP: "$$digits" }, 10] },
                {
                    $concat: [
                        "m:",
                        {
                            $substrCP: [
                                "$$digits",
                                { $subtract: [{ $strLenCP: "$$digits" }, 10] },
                                10,
                            ],
                        },
                    ],
                },
                {
                    $cond: [
                        { $gt: [{ $strLenCP: "$$nameKey" }, 0] },
                        { $concat: ["n:", "$$nameKey"] },
                        "",
                    ],
                },
            ],
        },
    },
};
/**
 * Any non-empty applicant photo wins. `$max` over "photo or empty string" is
 * deterministic and an empty string always loses, so a group that has at least
 * one uploaded ID photo never ends up with an empty image.
 */
const ANY_PHOTO = {
    $max: {
        $cond: [
            { $gt: [{ $strLenCP: photoOrDefault }, 0] },
            photoOrDefault,
            "",
        ],
    },
};
/** Only the fields the aggregation needs, so pre-group sorting stays cheap. */
const PRE_GROUP_PROJECTION = {
    $project: {
        _id: 1,
        createdAt: 1,
        bookingNumber: 1,
        status: 1,
        "applicant.name": 1,
        "applicant.mobile": 1,
        "applicant.organization": 1,
        "applicant.email": 1,
        "applicant.address": 1,
        "applicant.governmentId.photo": 1,
        "event.name": 1,
        "schedule.startDate": 1,
        "financial.totalAmount": 1,
        __id: 1,
        __nameFilled: 1,
    },
};
const OUTPUT_PROJECTION = {
    $project: {
        _id: 0,
        id: "$_id",
        name: 1,
        mobile: 1,
        image: 1,
        organization: 1,
        email: 1,
        address: 1,
        totalBookings: 1,
        activeBookings: 1,
        cancelledBookings: 1,
        endedBookings: 1,
        totalAmount: 1,
        firstBookingAt: 1,
        lastBookingAt: 1,
        latestBookingNumber: 1,
        latestEventName: 1,
        latestEventDate: 1,
        latestStatus: 1,
    },
};
/** Sort of the grouped rows — always ends with `_id` so pages never overlap. */
const sortStage = (sort) => {
    switch (sort) {
        case "oldest":
            return { $sort: { lastBookingAt: 1, nameLower: 1, _id: 1 } };
        case "name":
            return { $sort: { nameLower: 1, lastBookingAt: -1, _id: 1 } };
        case "bookings":
            return { $sort: { totalBookings: -1, lastBookingAt: -1, _id: 1 } };
        case "recent":
        default:
            return { $sort: { lastBookingAt: -1, nameLower: 1, _id: 1 } };
    }
};
/** Escapes user input so it can never be interpreted as a regex. */
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const buildPipeline = (params) => {
    const conditions = [
        // Skip bookings whose applicant section has not been filled in yet.
        {
            $or: [
                { "applicant.name": { $nin: ["", null] } },
                { "applicant.mobile": { $nin: ["", null] } },
            ],
        },
    ];
    if (!params.includeDrafts) {
        conditions.push({ status: { $ne: "Draft" } });
    }
    if (params.search) {
        const rx = new RegExp(escapeRegExp(params.search), "i");
        conditions.push({
            $or: [
                { "applicant.name": rx },
                { "applicant.mobile": rx },
                { "applicant.organization": rx },
                { "applicant.email": rx },
                { bookingNumber: rx },
            ],
        });
    }
    const skip = Math.max(0, (params.page - 1) * params.pageSize);
    return [
        { $match: { $and: conditions } },
        {
            $addFields: {
                __id: IDENTITY_KEY,
                __nameFilled: {
                    $gt: [{ $strLenCP: trimString("$applicant.name") }, 0],
                },
            },
        },
        // A booking without any applicant identity cannot be listed.
        { $match: { __id: { $ne: "" } } },
        PRE_GROUP_PROJECTION,
        // Within a group the most "complete" (has a name) then most recent
        // booking is picked up first, which is what `$first` in `$group` uses.
        { $sort: { __nameFilled: -1, createdAt: -1, _id: -1 } },
        {
            $group: {
                _id: "$__id",
                name: { $first: trimString("$applicant.name") },
                nameLower: { $min: { $toLower: trimString("$applicant.name") } },
                mobile: { $first: trimString("$applicant.mobile") },
                organization: { $first: trimString("$applicant.organization") },
                email: { $first: trimString("$applicant.email") },
                address: { $first: trimString("$applicant.address") },
                image: ANY_PHOTO,
                totalBookings: { $sum: 1 },
                activeBookings: {
                    $sum: { $cond: [{ $in: ["$status", ACTIVE_STATUSES] }, 1, 0] },
                },
                cancelledBookings: {
                    $sum: { $cond: [{ $eq: ["$status", "Cancelled"] }, 1, 0] },
                },
                endedBookings: {
                    $sum: { $cond: [{ $eq: ["$status", "Ended"] }, 1, 0] },
                },
                // Cancelled bookings never contribute revenue.
                totalAmount: {
                    $sum: {
                        $cond: [
                            { $eq: ["$status", "Cancelled"] },
                            0,
                            { $ifNull: ["$financial.totalAmount", 0] },
                        ],
                    },
                },
                firstBookingAt: { $min: "$createdAt" },
                lastBookingAt: { $max: "$createdAt" },
                latestBookingNumber: { $first: { $ifNull: ["$bookingNumber", ""] } },
                latestEventName: { $first: trimString("$event.name") },
                latestEventDate: { $first: "$schedule.startDate" },
                latestStatus: { $first: { $ifNull: ["$status", ""] } },
            },
        },
        sortStage(params.sort),
        {
            $facet: {
                // One round-trip gives both the page and the grand total.
                data: [{ $skip: skip }, { $limit: params.pageSize }, OUTPUT_PROJECTION],
                meta: [{ $count: "total" }],
            },
        },
    ];
};
const toIso = (value) => {
    if (!value)
        return "";
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
};
/**
 * Paginated applicant list, derived from bookings.
 *
 * There is no separate applicant collection: every booking carries its own
 * applicant sub-document, so the list is grouped out of the bookings and stays
 * consistent by construction (no dual writes, no backfill migration).
 */
export const listApplicants = async (params) => {
    const pipeline = buildPipeline(params);
    const result = await Booking.aggregate(pipeline)
        .allowDiskUse(true);
    const facet = result[0];
    const rows = facet?.data ?? [];
    const total = facet?.meta?.[0]?.total ?? 0;
    const applicants = rows.map((row) => ({
        id: row.id,
        name: row.name || "N/A",
        mobile: row.mobile || "",
        image: row.image || "",
        organization: row.organization || "",
        email: row.email || "",
        address: row.address || "",
        totalBookings: row.totalBookings ?? 0,
        activeBookings: row.activeBookings ?? 0,
        cancelledBookings: row.cancelledBookings ?? 0,
        endedBookings: row.endedBookings ?? 0,
        totalAmount: row.totalAmount ?? 0,
        firstBookingAt: toIso(row.firstBookingAt),
        lastBookingAt: toIso(row.lastBookingAt),
        latestBookingNumber: row.latestBookingNumber || "",
        latestEventName: row.latestEventName || "",
        latestEventDate: toIso(row.latestEventDate),
        latestStatus: (row.latestStatus || ""),
    }));
    return { applicants, total };
};
//# sourceMappingURL=applicant.service.js.map