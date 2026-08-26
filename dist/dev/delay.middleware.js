import { devControl } from "./devConfig.js";
/**
 * DEV-ONLY middleware to simulate slow/failing endpoints.
 * Reads live config from devConfig.ts and applies a delay/error per request.
 * Disable entirely by setting `devControl.enabled = false`.
 */
const delayImpl = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const findRule = (req) => {
    const path = req.originalUrl.split("?")[0] ?? "";
    const method = req.method.toUpperCase();
    const matches = devControl.routes.filter((r) => {
        const pathOk = path.includes(r.path);
        const methodOk = !r.method || r.method.toUpperCase() === method;
        return pathOk && methodOk;
    });
    // Last matching rule wins (most specific) — reverse order.
    return matches.length > 0
        ? matches[matches.length - 1]
        : undefined;
};
export const devDelayMiddleware = async (req, res, next) => {
    if (!devControl.enabled) {
        next();
        return;
    }
    const rule = findRule(req);
    // If a rule forces an error, respond with it and skip the real handler.
    if (rule?.forceError) {
        const errDelay = rule.delayMs ?? devControl.delayMs;
        if (errDelay && errDelay > 0) {
            await delayImpl(errDelay);
        }
        res.status(rule.errorStatus ?? 500).json({
            success: false,
            message: rule.errorMessage ?? "Simulated dev error",
        });
        return;
    }
    // Determine delay: rule-specific > global (or random).
    let delayMs = rule?.delayMs ?? devControl.delayMs;
    if (devControl.randomDelay && delayMs === undefined) {
        const min = devControl.delayMinMs;
        const max = devControl.delayMaxMs;
        delayMs = Math.floor(min + Math.random() * (max - min));
    }
    if (delayMs && delayMs > 0) {
        await delayImpl(delayMs);
    }
    next();
};
//# sourceMappingURL=delay.middleware.js.map