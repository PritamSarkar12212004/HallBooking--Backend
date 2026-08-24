import { ApiError } from "../utils/api-error.js";
import { logger } from "../utils/logger.js";
export const notFoundHandler = (_req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found",
    });
};
export const errorMiddleware = (error, _req, res, _next) => {
    const statusCode = error instanceof ApiError ? error.statusCode : 500;
    const message = error instanceof Error ? error.message : "Internal server error";
    if (statusCode >= 500) {
        logger.error("Unexpected server error", {
            error: message,
            ...(error instanceof Error && { stack: error.stack }),
        });
    }
    res.status(statusCode).json({
        success: false,
        message,
        ...(statusCode >= 500 && process.env.NODE_ENV !== "production"
            ? { stack: error instanceof Error ? error.stack : undefined }
            : {}),
    });
};
//# sourceMappingURL=error.middleware.js.map