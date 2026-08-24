import mongoose from "mongoose";
import { logger } from "../../utils/logger.js";
const connectDB = async () => {
    try {
        const mongoURI = process.env.MONGO_URI;
        if (!mongoURI) {
            throw new Error("MONGO_URI is not defined in environment variables");
        }
        mongoose.connection.on("connected", () => {
            logger.info("MongoDB connection established.");
        });
        mongoose.connection.on("disconnected", () => {
            logger.warn("MongoDB connection lost. Attempting to reconnect...");
        });
        mongoose.connection.on("reconnected", () => {
            logger.info("MongoDB reconnected successfully.");
        });
        mongoose.connection.on("error", (error) => {
            logger.error("MongoDB connection error", {
                error: error instanceof Error ? error.message : error,
            });
        });
        await mongoose.connect(mongoURI, {});
        logger.info("MongoDB connected successfully", {
            database: mongoose.connection.name,
            host: mongoose.connection.host,
            state: mongoose.connection.readyState,
        });
    }
    catch (error) {
        logger.error("MongoDB connection failed", {
            error: error instanceof Error ? error.message : error,
            uriHost: process.env.MONGO_URI
                ? new URL(process.env.MONGO_URI).host
                : "MONGO_URI not set",
        });
        process.exit(1);
    }
};
export default connectDB;
//# sourceMappingURL=db.js.map