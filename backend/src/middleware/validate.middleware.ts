import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

type RequestTarget = 'body' | 'params' | 'query';

export function validate(
    schema: ZodType,
    target: RequestTarget = 'body',
): RequestHandler {
    return (request, _response, next) => {
        try {
            const result = schema.parse(request[target]);

            if (target === 'body') {
                request.body = result;
            } else if (target === 'params') {
                Object.assign(request.params, result);
            } else if (target === 'query') {
                Object.assign(request.query, result);
            }

            next();
        } catch (error) {
            next(error);
        }
    };
}