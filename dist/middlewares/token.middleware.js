import { verifyToken } from "../utils/jwt.service.js";
import { ApiError } from "../utils/api-error.js";
export const authenticate = (req, _res, next) => {
    try {
        const header = req.headers.authorization;
        if (!header || !header.startsWith("Bearer ")) {
            throw new ApiError(401, "Access token is required");
        }
        const token = header.split(" ")[1];
        if (!token) {
            throw new ApiError(401, "Access token is required");
        }
        req.user = verifyToken(token);
        next();
    }
    catch (error) {
        next(error);
    }
};
//# sourceMappingURL=token.middleware.js.map