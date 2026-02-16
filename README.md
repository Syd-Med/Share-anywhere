# Share Anywhere

> Zero-knowledge cloud storage SaaS — MEGA-like file sharing with end-to-end encryption

Share Anywhere lets you store, share, and manage files securely. Your data is encrypted in the browser before it ever reaches the server, so only you hold the keys.

---

## Features

- **Zero-knowledge encryption** — Files are encrypted client-side; the server never sees plaintext
- **File storage** — Upload, download, organize in folders, move, rename, and search
- **Secure sharing** — Share links with optional password protection and expiry
- **Folder sharing** — Share entire folders with fine-grained permissions
- **File requests** — Let others upload files to you via unique request links
- **Subscriptions** — Stripe billing with storage quotas and plan management
- **Developer API** — API keys with scoped permissions (`files:read`, `files:write`)
- **Media handling** — Image thumbnails and background processing with BullMQ

---

## Tech Stack

| Layer | Technologies |
|-------|--------------|
| **Frontend** | Next.js 14 (App Router), TypeScript, Tailwind CSS, Radix UI |
| **Backend** | Express, MongoDB (Mongoose), Redis, BullMQ |
| **Storage** | AWS S3 |
| **Auth** | JWT (access + refresh tokens), API keys |
| **Payments** | Stripe |
| **Infrastructure** | Heroku (web + worker dynos) |

---

## Quick Start

### Prerequisites

- Node.js 20+
- MongoDB (local or [MongoDB Atlas](https://www.mongodb.com/atlas))
- Redis (local or [Upstash](https://upstash.com/))
- AWS S3 bucket
- (Optional) Stripe account for subscriptions

### 1. Clone and install

```bash
git clone https://github.com/Himanshu1831/share-anywhere.git
cd share-anywhere
```

### 2. Backend setup

```bash
cd backend
cp .env.example .env
# Edit .env with your MongoDB, Redis, AWS, and JWT secrets
npm install
npm run dev
```

Backend runs at `http://localhost:3001`.

### 3. Frontend setup

```bash
cd frontend
cp .env.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:3001
npm install
npm run dev
```

Frontend runs at `http://localhost:3000`.

### 4. Worker (optional, for thumbnails & cleanup)

```bash
cd backend
node dist/worker.js   # After running `npm run build` first
```

---

## Project Structure

```
share-anywhere/
├── backend/          # Express API + BullMQ worker
│   ├── src/
│   │   ├── routes/   # auth, files, folders, shares, billing, api keys
│   │   ├── models/   # User, File, Folder, ShareLink, Plan, APIKey
│   │   ├── services/ # S3, Stripe, auth
│   │   ├── workers/  # thumbnail processor, cleanup jobs
│   │   └── middlewares/
│   └── worker.ts
├── frontend/         # Next.js app
│   ├── app/          # login, register, dashboard, share, pricing
│   ├── components/
│   └── lib/          # API client, crypto utils
├── Procfile          # Heroku web + worker
└── package.json
```

---

## Environment Variables

### Backend (`.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | MongoDB connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `JWT_SECRET` | Yes | Access token signing key |
| `JWT_REFRESH_SECRET` | Yes | Refresh token signing key |
| `FRONTEND_URL` | Yes | Frontend URL (for CORS) |
| `AWS_ACCESS_KEY_ID` | Yes | AWS S3 access |
| `AWS_SECRET_ACCESS_KEY` | Yes | AWS S3 secret |
| `AWS_REGION` | Yes | S3 region (e.g. `us-east-1`) |
| `S3_BUCKET` | Yes | S3 bucket name |
| `STRIPE_SECRET_KEY` | Phase 7 | Stripe API key |
| `STRIPE_WEBHOOK_SECRET` | Phase 7 | Stripe webhook signing secret |
| `SENTRY_DSN` | Optional | Error tracking |

### Frontend (`.env.local`)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend API URL (e.g. `http://localhost:3001`) |

---

## API

- **REST API** — `POST /api/auth/login`, `GET /api/files`, etc.
- **Developer API** — `Authorization: Bearer sa_<api_key>` — `/api/v1/*`
- **Swagger docs** — `GET /api-docs` (when backend is running)

See [API_KEYS_GUIDE.md](API_KEYS_GUIDE.md) for API key setup and usage.

---

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — System design, encryption model, data flows
- [API_KEYS_GUIDE.md](API_KEYS_GUIDE.md) — Creating and using API keys
- [PRODUCTION-CHECKLIST.md](PRODUCTION-CHECKLIST.md) — Deployment checklist
- [POST-LAUNCH-OPTIMIZATION-ROADMAP.md](POST-LAUNCH-OPTIMIZATION-ROADMAP.md) — Scaling guide

---

## Deployment

The project is configured for Heroku:

- **web** dyno: Express API
- **worker** dyno: BullMQ (thumbnails, cleanup jobs)

Deploy the Next.js frontend separately (e.g. Vercel) and set `NEXT_PUBLIC_API_URL` to your backend URL.

---

## License

MIT
