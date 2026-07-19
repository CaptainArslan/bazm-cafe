import 'dotenv/config';

import { defineConfig } from 'prisma/config';

const requiredEnvironmentVariables = [
  'DB_HOST',
  'DB_PORT',
  'DB_DATABASE',
  'DB_USERNAME',
  'DB_PASSWORD',
] as const;

for (const variable of requiredEnvironmentVariables) {
  if (process.env[variable] === undefined) {
    throw new Error(`Missing environment variable: ${variable}`);
  }
}

const username = encodeURIComponent(process.env.DB_USERNAME!);
const password = encodeURIComponent(process.env.DB_PASSWORD!);
const host = process.env.DB_HOST!;
const port = process.env.DB_PORT!;
const database = encodeURIComponent(process.env.DB_DATABASE!);

const databaseUrl =
  `mysql://${username}:${password}@${host}:${port}/${database}`;

export default defineConfig({
  schema: 'prisma/schema.prisma',

  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },

  datasource: {
    url: databaseUrl,
  },
});