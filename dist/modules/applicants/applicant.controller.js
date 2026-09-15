import { asyncHandler } from "../../utils/async-handler.js";
import { parseListApplicantsQuery } from "./applicant.validation.js";
import { listApplicants as listApplicantsService } from "./applicant.service.js";
/**
 * GET /api/v1/applicants
 * Query: page, pageSize, search, sort (recent|oldest|name|bookings), includeDrafts
 */
export const handleListApplicants = asyncHandler(async (req, res) => {
    const params = parseListApplicantsQuery(req.query);
    const { applicants, total } = await listApplicantsService(params);
    const totalPages = total === 0 ? 0 : Math.ceil(total / params.pageSize);
    res.status(200).json({
        success: true,
        message: "Applicants fetched successfully",
        data: {
            applicants,
            pagination: {
                page: params.page,
                pageSize: params.pageSize,
                total,
                totalPages,
                hasMore: params.page < totalPages,
            },
        },
    });
});
//# sourceMappingURL=applicant.controller.js.map