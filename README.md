# bazm-cafe

BAZM Café — a mobile-first restaurant ordering platform (Customer / Staff / Admin) running on a local Wi-Fi network.

## Structure

```
bazm-cafe/
├── backend/   # Node.js + Express + TypeScript + Prisma/MySQL API, Socket.IO
└── frontend/  # Vue 3 + TypeScript + Vite + Tailwind + shadcn-vue
```

`backend/` and `frontend/` are independent npm projects (no root workspaces) — install and run each from its own directory.

## Backend

```bash
cd backend
npm install
npx prisma generate
npm run dev      # http://localhost:3000
```

Copy `backend/.env.example` to `backend/.env` and fill in DB credentials / JWT secrets before running.

## Frontend

```bash
cd frontend
npm install
npm run dev       # http://localhost:5173, proxies /api to the backend on :3000
```

Copy `frontend/.env.example` to `frontend/.env` if you need to override `VITE_API_BASE_URL`.

Other frontend scripts: `npm run build`, `npm run typecheck`, `npm run test`, `npm run lint`.
