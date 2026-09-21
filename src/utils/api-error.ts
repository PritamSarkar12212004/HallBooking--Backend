export class ApiError extends Error {
    readonly statusCode: number;

    /**
     * Machine readable code (jaise `ACCESS_DENIED`) — frontend isi se decide
     * karta hai ki sirf message dikhana hai ya session clear karke login par
     * bhejna hai. Optional rakha gaya hai, taake purane errors na tootein.
     */
    readonly code?: string;

    constructor(statusCode: number, message: string, code?: string) {
        super(message);
        this.statusCode = statusCode;

        if (code) {
            this.code = code;
        }
    }
}