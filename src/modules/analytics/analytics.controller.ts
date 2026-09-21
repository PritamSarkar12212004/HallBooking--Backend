import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { parseAnalyticsQuery } from "./analytics.validation.js";
import { getCeoAnalytics } from "./analytics.service.js";

/**
 * GET /api/v1/analytics/ceo
 * Query: period (today|week|month|quarter|year|all|custom), from, to
 *
 * CEO business analytics — ek hi response me overview, finance, events,
 * venue, customers, staff aur reports sections.
 */
export const handleCeoAnalytics = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
        const query = parseAnalyticsQuery(req.query as Record<string, unknown>);
        const analytics = await getCeoAnalytics(query);

        res.status(200).json({
            success: true,
            message: "CEO analytics fetched successfully",
            data: analytics,
        });
    }
);
