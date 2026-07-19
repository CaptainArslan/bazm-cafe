import 'dotenv/config';

import { z } from 'zod';

const environmentSchema = z.object({
    NODE_ENV: z
        .enum(['development', 'test', 'production'])
        .default('development'),

    APP_NAME: z.string().min(1).default('BAZM Cafe'),
    APP_URL: z.string().url().default('http://localhost:3000'),

    HOST: z.string().min(1).default('0.0.0.0'),

    PORT: z.coerce
        .number()
        .int()
        .positive()
        .max(65535)
        .default(3000),

    DB_CONNECTION: z.literal('mysql').default('mysql'),
    DB_HOST: z.string().min(1),
    DB_PORT: z.coerce.number().int().positive().max(65535),
    DB_DATABASE: z.string().min(1),
    DB_USERNAME: z.string().min(1),
    DB_PASSWORD: z.string(),

    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
    JWT_REFRESH_EXPIRES_DAYS: z.coerce.number().int().positive().default(30),

    PASSWORD_RESET_EXPIRES_MINUTES: z.coerce
        .number()
        .int()
        .positive()
        .default(30),

    BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),

    GUEST_SESSION_EXPIRES_HOURS: z.coerce
        .number()
        .int()
        .positive()
        .max(1)
        .default(1),

    FRONTEND_URL: z.string().url().default('http://localhost:5173'),
});

const result = environmentSchema.safeParse(process.env);

if (!result.success) {
    console.error('Invalid environment configuration:');
    console.error(z.treeifyError(result.error));

    throw new Error('Application environment validation failed.');
}

export const env = result.data;