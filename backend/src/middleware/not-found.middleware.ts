import type { Request, Response } from 'express';

import { HTTP_STATUS } from '../constants/http-status.js';

export function notFoundMiddleware(
    request: Request,
    response: Response,
): Response {
    return response.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'API endpoint not found.',
        error: {
            code: 'ROUTE_NOT_FOUND',
            method: request.method,
            path: request.originalUrl,
        },
    });
}