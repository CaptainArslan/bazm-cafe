import { rateLimit } from 'express-rate-limit';

export const globalRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 300,
    standardHeaders: 'draft-8',
    legacyHeaders: false,

    message: {
        success: false,
        message: 'Too many requests. Please try again shortly.',
        error: {
            code: 'RATE_LIMIT_EXCEEDED',
        },
    },
});

export const authenticationRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,

    message: {
        success: false,
        message: 'Too many authentication attempts. Try again later.',
        error: {
            code: 'AUTH_RATE_LIMIT_EXCEEDED',
        },
    },
});

export const recoveryCodeRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,

    message: {
        success: false,
        message: 'Too many recovery code attempts. Try again later.',
        error: {
            code: 'RECOVERY_RATE_LIMIT_EXCEEDED',
        },
    },
});