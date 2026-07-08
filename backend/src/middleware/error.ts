import { NextFunction, Request, Response } from "express";

export class AppError extends Error {
    constructor(
        public statusCode: number,
        message: string,
        public isOperational = true
    ) {
        super(message);
        Object.setPrototypeOf(this, AppError.prototype);
    }
}

export function errorHandler(
    err: Error,
    _req: Request,
    res: Response,
    _next: NextFunction
) {
    console.error("Error:", err);

    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            error: err.message,
            ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
        });
        return;
    }

    // Unknown errors
    res.status(500).json({
        error: "Internal server error",
        ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
}