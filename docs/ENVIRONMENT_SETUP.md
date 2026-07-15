# Environment Setup

## Prerequisites

- Node.js compatible with Next.js 16 and Express 5.
- npm.
- MongoDB connection string for persistent storage.
- Google Gemini API key for AI generation.
- SMTP credentials for password reset email delivery.

## Install Dependencies

Install backend dependencies:

```bash
npm --prefix Backend install
```

Install frontend dependencies:

```bash
npm --prefix Frontend install
```

## Environment File

Create a root `.env` file from `.env.example`.

```text
.env.example -> .env
```

Do not commit `.env`.

## Backend Variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `NODE_ENV` | Recommended | Controls development vs production behavior. |
| `PORT` | Recommended | Backend port. Defaults to `3001`. |
| `FRONTEND_URL` | Production required | Trusted frontend origin and password reset base URL. |
| `MONGO_URI` | Production required | MongoDB connection string. |
| `JWT_SECRET` | Required | Signs JWT session cookies. |
| `GOOGLE_GENAI_API_KEY` | Production required | Enables Gemini AI generation. |
| `GEMINI_MODEL` | Optional | Preferred Gemini model. |
| `GEMINI_VERIFY_MODELS` | Optional | Enables model verification when set to `true`. |
| `GEMINI_STAGE_CONCURRENCY` | Optional | Controls parallel AI stage concurrency, capped by implementation. |
| `SMTP_HOST` | Optional | SMTP host. Defaults to Gmail SMTP in code. |
| `SMTP_PORT` | Optional | SMTP port. Defaults to `465`. |
| `SMTP_SECURE` | Optional | Whether SMTP uses a secure connection. |
| `SMTP_USER` | Required when SMTP is configured | SMTP username. |
| `SMTP_PASS` | Required when SMTP is configured | SMTP password or app password. |
| `EMAIL_FROM` | Production required | Sender shown in password reset emails. |
| `PASSWORD_RESET_TOKEN_MINUTES` | Optional | Reset token lifetime. Defaults to `15`. |

## Frontend Variables

| Variable | Purpose |
| --- | --- |
| `BACKEND_URL` | Used by Next.js rewrites/proxy behavior. |
| `NEXT_PUBLIC_API_URL` | Browser API base URL. |
| `NEXT_PUBLIC_APP_URL` | Frontend app URL used by backend CORS allow-list when available. |

## Local Development Values

Typical local values:

```text
PORT=3001
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://127.0.0.1:3001
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Run Locally

Start backend:

```bash
npm run dev:backend
```

Start frontend:

```bash
npm run dev:frontend
```

Open:

```text
http://localhost:3000
```

## Verify Setup

Backend health:

```bash
curl http://localhost:3001/health
```

Backend route summary:

```bash
curl http://localhost:3001/
```

Gemini health diagnostics:

```bash
curl http://localhost:3001/api/health/gemini
```

## Common Setup Problems

| Symptom | Likely Cause | Action |
| --- | --- | --- |
| Backend fails on startup | Missing `JWT_SECRET` | Set a long random value in `.env`. |
| AI generation fails | Missing or invalid `GOOGLE_GENAI_API_KEY` | Verify the key and Gemini API access. |
| Password reset fails | SMTP values missing or invalid | Configure `SMTP_USER`, `SMTP_PASS`, and sender details. |
| Frontend cannot call API | `NEXT_PUBLIC_API_URL` points to the wrong backend | Confirm backend origin and CORS configuration. |
| Cookie auth fails in production | HTTPS or SameSite settings are misaligned | Use HTTPS for both frontend and backend and configure deployed origins. |
| Data is not persisted in MongoDB | MongoDB is unavailable | Check `MONGO_URI`; backend may use the local fallback store when DB is disconnected. |
