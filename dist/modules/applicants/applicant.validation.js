import { ApiError } from "../../utils/api-error.js";
export const APPLICANT_SORTS = [
    "recent",
    "oldest",
    "name",
    "bookings",
];
export const APPLICANT_DEFAULT_PAGE_SIZE = 10;
export const APPLICANT_MAX_PAGE_SIZE = 50;
export const APPLICANT_MAX_SEARCH_LENGTH = 100;
const asString = (value) => typeof value === "string" ? value.trim() : undefined;
const asInt = (value, fallback) => {
    if (value === undefined || value === "")
        return fallback;
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
};
/**
 * Parses + validates the applicant list query string.
 * Throws ApiError(400) for anything the client should not be sending.
 */
export const parseListApplicantsQuery = (query) => {
    const rawSort = asString(query.sort);
    const search = asString(query.search) ?? "";
    const rawIncludeDrafts = asString(query.includeDrafts);
    if (rawSort !== undefined && APPLICANT_SORTS.indexOf(rawSort) === -1) {
        throw new ApiError(400, `Invalid sort. Allowed values: ${APPLICANT_SORTS.join(", ")}`);
    }
    if (search.length > APPLICANT_MAX_SEARCH_LENGTH) {
        throw new ApiError(400, `Search query is too long (max ${APPLICANT_MAX_SEARCH_LENGTH} characters)`);
    }
    return {
        page: Math.max(1, asInt(asString(query.page), 1)),
        pageSize: Math.min(APPLICANT_MAX_PAGE_SIZE, Math.max(1, asInt(asString(query.pageSize), APPLICANT_DEFAULT_PAGE_SIZE))),
        search,
        sort: rawSort ?? "recent",
        includeDrafts: rawIncludeDrafts === "true" || rawIncludeDrafts === "1",
    };
};
//# sourceMappingURL=applicant.validation.js.map