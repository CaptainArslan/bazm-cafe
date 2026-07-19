# BAZM Cafe Backend

BAZM Cafe is a local-first restaurant ordering and kitchen-management backend built with Node.js, Express, TypeScript, MySQL and Prisma ORM.

## Technology

- Node.js
- Express
- TypeScript
- MySQL
- Prisma ORM
- Prisma MySQL/MariaDB driver adapter

## Requirements

- Node.js LTS
- npm
- MySQL
- Git

## Project setup

Clone or enter the project directory:

```powershell
cd D:\node_projects\bazm-cafe\backend
```

Install dependencies:

```powershell
npm install
```

## Initial project creation commands

These commands were used to initialize the project:

```powershell
npm init -y

npm pkg set name="bazm-cafe-backend"
npm pkg set description="Local-first BAZM Cafe restaurant backend"
npm pkg set main="dist/server.js"
npm pkg set type="module"

npm pkg set "scripts.dev=tsx watch src/server.ts"
npm pkg set "scripts.build=tsc"
npm pkg set "scripts.start=node dist/server.js"
npm pkg set "scripts.typecheck=tsc --noEmit"

npm pkg delete scripts.test
```

## Installed backend packages

Runtime dependencies:

```powershell
npm install express dotenv
```

Development dependencies:

```powershell
npm install --save-dev typescript tsx @types/node @types/express
```

Prisma dependencies:

```powershell
npm install --save-dev prisma
npm install @prisma/client @prisma/adapter-mariadb
```

## Prisma initialization

Prisma was initialized using:

```powershell
npx prisma init --datasource-provider mysql --output ../src/generated/prisma
```

## Environment configuration

Copy `.env.example` to `.env`:

```powershell
Copy-Item .env.example .env
```

Required database variables:

```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=bazm_cafe
DB_USERNAME=bazm_user
DB_PASSWORD=
```

Never commit `.env`.

## MySQL database creation

```sql
CREATE DATABASE bazm_cafe
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

CREATE USER 'bazm_user'@'localhost'
IDENTIFIED BY 'YOUR_STRONG_PASSWORD';

GRANT ALL PRIVILEGES
ON bazm_cafe.*
TO 'bazm_user'@'localhost';

FLUSH PRIVILEGES;
```

## Prisma commands

Format the schema:

```powershell
npx prisma format
```

Validate the schema:

```powershell
npx prisma validate
```

Create a development migration:

```powershell
npx prisma migrate dev --name migration_name
```

Create a migration without applying it:

```powershell
npx prisma migrate dev --name migration_name --create-only
```

Apply existing production migrations:

```powershell
npx prisma migrate deploy
```

Generate Prisma Client:

```powershell
npx prisma generate
```

Check migration status:

```powershell
npx prisma migrate status
```

Open Prisma Studio:

```powershell
npx prisma studio
```

## Existing migrations

### Authentication migration

```powershell
npx prisma migrate dev --name create_authentication_tables --create-only
npx prisma migrate dev
```

Creates:

- `users`
- `refresh_tokens`
- `password_reset_tokens`

### Restaurant and ordering migration

```powershell
npx prisma migrate dev --name create_restaurant_order_tables --create-only
npx prisma migrate dev
```

Creates:

- `restaurant_tables`
- `categories`
- `products`
- `orders`
- `order_items`
- `payments`
- `order_status_histories`
- `stock_movements`

Prisma also maintains:

- `_prisma_migrations`

## Development commands

Type-check the application:

```powershell
npm run typecheck
```

Start development mode:

```powershell
npm run dev
```

Build the application:

```powershell
npm run build
```

Run the compiled application:

```powershell
npm start
```

## Health endpoints

Application health:

```text
GET http://localhost:3000/api/v1/health
```

Database health:

```text
GET http://localhost:3000/api/v1/health/database
```

## Current modules

```text
src/modules/
├── auth/
├── staff/
├── tables/
├── categories/
├── products/
├── orders/
├── kitchen/
└── payments/
```

## Socket.IO

Install the real-time server:

```powershell
npm install socket.io
```

Socket.IO is attached to the same Node HTTP server used by Express.

Development endpoint:

```text
http://localhost:3000/socket.io
```

Handshake test:

```text
http://localhost:3000/socket.io/?EIO=4&transport=polling
```

Current test events:

```text
Server → Client: connection:ready
Client → Server: connection:ping
```

Socket.IO TypeScript types are included in the `socket.io` package. Do not install `@types/socket.io`.

## Current backend status

The backend now includes:

- a TypeScript Express entry point
- shared config, middleware, route, type, and utility helpers
- Prisma schema and migration setup
- feature module folders for auth, staff, tables, categories, products, orders, kitchen, and payments

## Database tables

```text
users
refresh_tokens
password_reset_tokens
restaurant_tables
categories
products
orders
order_items
payments
order_status_histories
stock_movements
```

## Migration safety

Development:

```powershell
npx prisma migrate dev
```

Production:

```powershell
npx prisma migrate deploy
```

Do not run the following command against production:

```powershell
npx prisma migrate reset
```

It deletes and recreates the database.


## Notes

This backend is ready for local development and can be extended with additional restaurant workflows as needed.
