import "dotenv/config";
import app from "../app.js";
import connectDB from "../config/database/db.js";
import Booking from "../modules/bookings/booking.model.js";
import { logger } from "../utils/logger.js";
const PORT = Number(process.env.PORT) || 5000;
// One-time (idempotent) backfill: events that were already finalized in the
// past have used units recorded but no "Ended" status yet. Mark them + stamp
// the handover time so the UI can show "Event End".
const backfillEndedEvents = async () => {
    try {
        const { modifiedCount } = await Booking.updateMany({
            "financial.units": { $elemMatch: { quantity: { $gt: 0 } } },
            status: { $ne: "Ended" },
        }, { $set: { status: "Ended", "handover.completedAt": new Date() } });
        if (modifiedCount > 0) {
            logger.info("Backfilled ended events", { modifiedCount });
        }
    }
    catch (error) {
        logger.warn("Backfill ended events failed", {
            error: error instanceof Error ? error.message : error,
        });
    }
};
const startServer = async () => {
    try {
        await connectDB();
        await backfillEndedEvents();
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