import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { env } from './config/environment.js';
import { errorHandlerMiddleware } from './middleware/error-handler.middleware.js';
import { globalRateLimiter } from './middleware/rate-limit.middleware.js';
import { notFoundMiddleware } from './middleware/not-found.middleware.js';
import { apiRouter } from './routes/index.js';
import { sendSuccess } from './utils/api-response.js';

export const app = express();

app.disable('x-powered-by');

app.use(helmet());

app.use(
    cors({
        origin: env.FRONTEND_URL,
        credentials: true,
    }),
);

app.use(globalRateLimiter);

app.use(
    express.json({
        limit: '1mb',
    }),
);

app.use(
    express.urlencoded({
        extended: true,
        limit: '1mb',
    }),
);

app.use(cookieParser());

app.use(express.static('public'));

app.get('/', (_request, response) => {
    return sendSuccess(response, {
        message: 'Welcome to the BAZM Cafe API.',
        data: {
            version: '1.0.0',
            api: '/api/v1',
            health: '/api/v1/health',
        },
    });
});

app.get('/api/v1/health', (_request, response) => {
    return sendSuccess(response, {
        message: 'BAZM Cafe API is healthy.',
        data: {
            application: env.APP_NAME,
            environment: env.NODE_ENV,
            timestamp: new Date().toISOString(),
        },
    });
});

app.use('/api/v1', apiRouter);

app.use(notFoundMiddleware);

app.use(errorHandlerMiddleware);