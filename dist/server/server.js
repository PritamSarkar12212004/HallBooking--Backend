import "dotenv/config";
import app from "../app.js";
import connectDB from "../config/database/db.js";
import { logger } from "../utils/logger.js";
const PORT = Number(process.env.PORT) || 5000;
const startServer = async () => {
    try {
        await connectDB();
        const server = app.listen(PORT, () => {
            logger.info("Server is running", {
                port: PORT,
                environment: process.env.NODE_ENV || "development",
            });
        });
        const gracefulShutdown = (signal) => {
            logger.warn("Shutting down server", {
                signal,
            });
            server.close((error) => {
                if (error) {
                    logger.error("Error while closing server", {
                        error: error instanceof Error
                            ? error.message
                            : error,
                    });
                    process.exit(1);
                }
                logger.info("Server closed successfully");
                process.exit(0);
            });
        };
        process.once("SIGINT", () => {
            gracefulShutdown("SIGINT");
        });
        process.once("SIGTERM", () => {
            gracefulShutdown("SIGTERM");
        });
    }
    catch (error) {
        logger.error("Failed to start server", {
            error: error instanceof Error
                ? error.message
                : error,
        });
        process.exit(1);
    }
};
void startServer();
//# sourceMappingURL=server.js.map