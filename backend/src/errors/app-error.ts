export class AppError extends Error {
    public readonly statusCode: number;

    public readonly code: string;

    public readonly details?: unknown;

    public readonly isOperational: boolean;

    public constructor(
        message: string,
        statusCode: number,
        code = 'APPLICATION_ERROR',
        details?: unknown,
    ) {
        super(message);

        this.name = 'AppError';
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}