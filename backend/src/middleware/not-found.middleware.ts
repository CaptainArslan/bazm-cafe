import type { Request, Response } from 'express';

import { HTTP_STATUS } from '../constants/http-status.js';

export function notFoundMiddleware(
    request: Request,
    response: Response,
): Response {
    const isUploadPath = request.path.startsWith('/uploads/');

    return response.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: isUploadPath
            ? 'File not found.'
            : 'API endpoint not found.',
        error: {
            code: isUploadPath ? 'FILE_NOT_FOUND' : 'ROUTE_NOT_FOUND',
            method: request.method,
            path: request.originalUrl,
        },
    });
}
