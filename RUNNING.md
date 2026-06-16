## Running locally

Exam Shield is a monorepo: `/server` (Express + Prisma + PostgreSQL) and `/client` (React + Vite).

### Prerequisites
- Node.js 18+
- PostgreSQL running locally

### 1. Backend
```bash
cd server
cp .env.example .env        # set DATABASE_URL and JWT_SECRET
npm install
npm run prisma:generate
npm run prisma:migrate      # creates tables
npm run seed                # demo users + question bank
npm run dev                 # http://localhost:4000
```

Demo accounts (password `password123`): `admin@`, `examiner@`, `proctor@`, `student@` `examshield.dev`.

### 2. Frontend
```bash
cd client
cp .env.example .env
npm install
npm run dev                 # http://localhost:5173
```

The Vite dev server proxies `/api` and `/captures` to the backend.

## Demo flow
1. Sign in as **examiner** → **New exam**. Choose Offline or Online, set sets / per-difficulty counts / lead-time hours / exam date.
2. **Offline:** papers auto-generate at `examDate - leadTime` (or click *Generate now*), then download balanced, audit-stamped PDFs per set.
3. **Online:** sign in as **student**, enter the exam ID, and start. The paper is assembled on the spot; the lockdown + AI proctor run live.
4. Sign in as **proctor** to watch the live violation feed with captured snapshots.
