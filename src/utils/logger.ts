type LogMeta = Record<string, unknown>;

const formatMessage = (
    level: string,
    message: string,
    meta?: LogMeta
): string => {
    const timestamp = new Date().toISOString();

    return JSON.stringify({
        timestamp,
        level,
        message,
        ...(meta && { meta }),
    });
};

export const logger = {
    info(message: string, meta?: LogMeta) {
        console.log(formatMessage("info", message, meta));
    },

    warn(message: string, meta?: LogMeta) {
        console.warn(formatMessage("warn", message, meta));
    },

    error(message: string, meta?: LogMeta) {
        console.error(formatMessage("error", message, meta));
    },

    debug(message: string, meta?: LogMeta) {
        if (process.env.NODE_ENV !== "production") {
            console.debug(formatMessage("debug", message, meta));
        }
    },
};