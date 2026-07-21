# BAZM Café documentation

| Document | Purpose |
|----------|---------|
| [BAZM_CAFE_WORKFLOW.md](./BAZM_CAFE_WORKFLOW.md) | End-to-end product / UX / ops workflow (customer, staff, admin) |
| [BAZM_BACKEND_ARCHITECTURE_CONTRACT.md](./BAZM_BACKEND_ARCHITECTURE_CONTRACT.md) | Backend architecture contract for implementers and AI agents |
| [BAZM_AUTH_API_IMPLEMENTATION_PLAN.md](./BAZM_AUTH_API_IMPLEMENTATION_PLAN.md) | Historical auth module implementation plan (phases completed for core auth) |
| [../backend/docs/API_TESTING.md](../backend/docs/API_TESTING.md) | Postman import, DB refresh/seed, full endpoint cheat sheet |
| [../backend/docs/postman/](../backend/docs/postman/) | Postman collection + local environment |
| [../README.md](../README.md) | Repo overview and getting started |
| [../backend/README.md](../backend/README.md) | Backend Prisma / migrate / seed commands |

## Quick local refresh

```bash
cd backend
npx prisma migrate reset --force
npm run db:seed
npm run dev
```

Admin: `admin@bazm.local` / `password`
