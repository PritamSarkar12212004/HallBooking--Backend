import "dotenv/config";
import app from '../app.js'
import connectDB from '../config/database/db.js'
import { logger } from '../utils/logger.js'
const PORT = process.env.PORT || 5000;

const startServer = async (): Promise<void> => {
    try {
        await connectDB();
        const server = app.listen(PORT, () => {
            logger.info('Server is running', { port: PORT });
        });

        const gracefulShutdown = (signal: string) => {
            logger.warn('Shutting down server', { signal });
            server.close(() => {
                process.exit(0);
            });
        };

        process.on("SIGINT", () => gracefulShutdown("SIGINT"));
        process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    } catch (error) {
        logger.error('Failed to start server', {
            error: error instanceof Error ? error.message : error,
        });
        process.exit(1);
    }
};

void startServer();

export default app;