import type {
    ErrorRequestHandler,
    NextFunction,
    Request,
    Response,
} from 'express';
import { ZodError } from 'zod';

import { HTTP_STATUS } from '../constants/http-status.js';
import { AppError } from '../errors/app-error.js';

export const errorHandlerMiddleware: ErrorRequestHandler = (
    error: unknown,
    _request: Request,
    response: Response,
    _next: NextFunction,
): void => {
    if (error instanceof ZodError) {
        response.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).json({
            success: false,
            message: 'The submitted data is invalid.',
            error: {
                code: 'VALIDATION_ERROR',
                details: error.issues,
            },
        });

        return;
    }

    if (error instanceof AppError) {
        response.status(error.statusCode).json({
            success: false,
            code: error.code,
            message: error.message,
            error: {
                code: error.code,
                ...(error.details !== undefined && {
                    details: error.details,
                }),
            },
        });

        return;
    }

    console.error('Unhandled application error:', error);

    response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'An unexpected server error occurred.',
        error: {
            code: 'INTERNAL_SERVER_ERROR',
        },
    });
};