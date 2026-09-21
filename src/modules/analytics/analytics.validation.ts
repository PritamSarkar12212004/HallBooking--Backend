/**
 * Query validation for the CEO analytics endpoint.
 *
 * Galat `period` ko ignore karke default ("month") use karte hain, aur
 * `from`/`to` sirf valid ISO date hone par `custom` period banate hain.
 */
import type { AnalyticsQuery } from "./analytics.service.js";

const PERIOD_KEYS = ["today", "week", "month", "quarter", "year", "all", "custom"] as const;

const asDateString = (value: unknown): string | undefined => {
    if (typeof value !== "string" || value.trim().length === 0) return undefined;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return undefined;
    return value.trim();
};

export const parseAnalyticsQuery = (
    raw: Record<string, unknown>
): AnalyticsQuery => {
    const rawPeriod = typeof raw.period === "string" ? raw.period.trim().toLowerCase() : "";
    const period = (PERIOD_KEYS as readonly string[]).includes(rawPeriod)
        ? rawPeriod
        : "month";

    return {
        period,
        from: asDateString(raw.from),
        to: asDateString(raw.to),
    };
};
