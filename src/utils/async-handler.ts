import { Request, Response, NextFunction, RequestHandler } from "express";

export const asyncHandler = <TReq extends Request>(
    fn: (req: TReq, res: Response, next: NextFunction) => Promise<void>
): RequestHandler =>
    (req: Request, res: Response, next: NextFunction): void => {
        Promise.resolve(fn(req as TReq, res, next)).catch(next);
    };