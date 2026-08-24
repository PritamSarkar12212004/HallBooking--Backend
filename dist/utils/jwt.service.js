import jwt from "jsonwebtoken";
const JWT_SECRET = process.env.JWT_SECRET || "hallbooking_dev_secret";
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || "7d");
export const signToken = (payload) => jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
export const verifyToken = (token) => {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
};
//# sourceMappingURL=jwt.service.js.map