import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client.js';

const requiredDatabaseVariables = [
    'DB_HOST',
    'DB_PORT',
    'DB_DATABASE',
    'DB_USERNAME',
    'DB_PASSWORD',
] as const;

for (const variable of requiredDatabaseVariables) {
    if (process.env[variable] === undefined) {
        throw new Error(
            `Missing required database environment variable: ${variable}`,
        );
    }
}

const databasePort = Number(process.env.DB_PORT);

if (!Number.isInteger(databasePort) || databasePort <= 0) {
    throw new Error('DB_PORT must be a valid positive integer.');
}

const adapter = new PrismaMariaDb({
    host: process.env.DB_HOST!,
    port: databasePort,
    user: process.env.DB_USERNAME!,
    password: process.env.DB_PASSWORD!,
    database: process.env.DB_DATABASE!,
    connectionLimit: 10,
});

export const prisma = new PrismaClient({
    adapter,

    log:
        process.env.NODE_ENV === 'development'
            ? ['info', 'warn', 'error']
            : ['warn', 'error'],
});