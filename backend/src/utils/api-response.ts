import type { Response } from 'express';

type ApiSuccessOptions<T> = {
    statusCode?: number;
    message: string;
    data?: T;
    meta?: Record<string, unknown>;
};

export function sendSuccess<T>(
    response: Response,
    options: ApiSuccessOptions<T>,
): Response {
    return response.status(options.statusCode ?? 200).json({
        success: true,
        message: options.message,
        ...(options.data !== undefined && {
            data: options.data,
        }),
        ...(options.meta !== undefined && {
            meta: options.meta,
        }),
    });
}