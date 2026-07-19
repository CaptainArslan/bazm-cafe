import type {
    NextFunction,
    Request,
    RequestHandler,
    Response,
} from 'express';

type AsyncRequestHandler = (
    request: Request,
    response: Response,
    next: NextFunction,
) => Promise<unknown>;

export function asyncHandler(
    handler: AsyncRequestHandler,
): RequestHandler {
    return (request, response, next) => {
        Promise.resolve(handler(request, response, next)).catch(next);
    };
}