# MyBoardLFi

![Version](https://img.shields.io/badge/version-1.0.0-6366f1)
![Tests](https://img.shields.io/badge/tests-26%20passing-brightgreen)
![Client](https://img.shields.io/badge/client-Netlify-00C7B7?logo=netlify)
![Server](https://img.shields.io/badge/server-Railway-0B0D0E?logo=railway)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

Multi-tenant Kanban SaaS for agency teams. Built with React 18, Express 4, and Supabase. Features workspace isolation, JWT auth, drag-and-drop boards, file uploads, and automated daily email digests.

**Client:** [myboardlfi.ibaifernandez.com](https://myboardlfi.ibaifernandez.com) · **API:** [myboardlfi-server.up.railway.app](https://myboardlfi-server.up.railway.app) · **Release:** [v1.0.0](https://github.com/ibaifernandez/myboardlfi/releases/tag/v1.0.0)

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + TailwindCSS |
| Drag & drop | react-beautiful-dnd |
| Backend | Express 4 + Node.js 18 |
| Database | Supabase (PostgreSQL + RLS) |
| Auth | Supabase Auth + custom JWT middleware + bcryptjs |
| Storage | Supabase Storage (file attachments) |
| Email | Nodemailer + node-cron (daily digest) |
| Security | Helmet + express-rate-limit |
| Testing | Jest + Supertest |
| Client deploy | Netlify (auto-deploy on push to `main`) |
| Server deploy | Railway (auto-deploy on push to `main`) |

---

## Architecture

```
client/  (React 18 + Vite, port 5175)
├── src/
│   ├── components/
│   │   ├── boards/
│   │   ├── cards/
│   │   └── workspaces/
│   └── auth/

server/  (Express 4, port 3003)
├── routes/
├── middleware/      ← JWT validation, rate limiting
├── jobs/            ← node-cron daily digest
└── supabase.js

         React ←──── JWT over HTTPS ────→ Express
                                              │
                                         Supabase
                                    (PostgreSQL + RLS
                                     + Auth + Storage)
```

- **Multi-tenancy:** workspace-level data isolation enforced via Supabase Row Level Security (RLS)
- **Auth:** JWT issued by Supabase Auth, validated in Express middleware; passwords hashed with bcryptjs
- **File uploads:** Multer handles multipart → stored in Supabase Storage buckets

---

## Features (v1.0.0)

- ✅ Multi-tenant architecture with workspace isolation
- ✅ JWT authentication with workspace role system (admin / collaborator / guest)
- ✅ Drag-and-drop Kanban boards (react-beautiful-dnd)
- ✅ Cards with priority, due date, description, checklists, and labels
- ✅ File uploads to Supabase Storage
- ✅ Daily email digest via node-cron + Nodemailer
- ✅ Security hardening: Helmet, rate limiting, parameterized queries
- ✅ Row Level Security (RLS) policies in Supabase

---

## Test suite

26 tests across 4 suites — all passing.

| Suite | Tests | Status |
|---|---|---|
| Auth API | 8 | ✅ |
| Boards API | 7 | ✅ |
| Cards API | 6 | ✅ |
| Workspaces API | 5 | ✅ |

```bash
cd server && npm test
```

---

## Getting started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier works)

### Setup

```bash
# Clone
git clone https://github.com/ibaifernandez/myboardlfi.git
cd myboardlfi

# Install server dependencies
npm install

# Install client dependencies
cd client && npm install && cd ..

# Configure environment
cp .env.example .env
# Fill in your Supabase URL, service role key, JWT secret, and SMTP credentials

# Start in development
npm run dev
# Server → http://localhost:3003
# Client → http://localhost:5175
```

### Environment variables

```env
# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# JWT
JWT_SECRET=

# Email digest (optional)
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
DIGEST_FROM_EMAIL=
DIGEST_TO_EMAIL=
```

---

## Scripts

```bash
npm run dev       # Start server + client in parallel (concurrently)
npm run server    # Server only
npm run client    # Client only (from /client)
npm test          # Run test suite (from /server)
```

---

## Branch strategy

`main` is the production branch. Both Netlify and Railway auto-deploy on push to `main`. Feature work uses short-lived branches with PR and manual merge.

---

## Documentation

- [Architecture](./docs/ARCHITECTURE.md)
- [Changelog](./docs/CHANGELOG.md)
- [Roadmap](./docs/ROADMAP.md)
- [Backlog](./docs/BACKLOG.md)
- [Deploy guide](./docs/README-deploy.md)
- [Agent instructions](./AGENTS.md)

---

*MyBoardLFi · © 2026 Ibai Fernández · MIT License*
