# Deployment

## Overview

Strategy Hub deploys as two applications:

- `Frontend/`: Next.js application.
- `Backend/`: Express API.

The backend also requires MongoDB, Gemini API access, and SMTP credentials for password reset email.

## Deployment Units

| Unit | Source Directory | Runtime |
| --- | --- | --- |
| Frontend | `Frontend/` | Next.js |
| Backend | `Backend/` | Node.js / Express |
| Database | External | MongoDB |
| AI Provider | External | Google Gemini |
| Email Provider | External | SMTP |

## Backend Deployment

Install dependencies:

```bash
npm --prefix Backend install
```

Start command:

```bash
npm --prefix Backend run start
```

The backend reads the root `.env` file locally. In hosted environments, configure the same values through the platform environment variable UI.

## Frontend Deployment

Install dependencies:

```bash
npm --prefix Frontend install
```

Build command:

```bash
npm --prefix Frontend run build
```

Start command:

```bash
npm --prefix Frontend run start
```

## Required Production Environment Variables

Backend:

| Variable | Purpose |
| --- | --- |
| `NODE_ENV=production` | Enables production cookie behavior. |
| `PORT` | Backend port assigned by host or configured manually. |
| `FRONTEND_URL` | Deployed frontend origin. |
| `MONGO_URI` | MongoDB connection string. |
| `JWT_SECRET` | Long random signing secret. |
| `GOOGLE_GENAI_API_KEY` | Gemini API key. |
| `GEMINI_MODEL` | Preferred Gemini model. |
| `GEMINI_VERIFY_MODELS` | Optional model verification flag. |
| `GEMINI_STAGE_CONCURRENCY` | Optional AI stage concurrency setting. |
| `SMTP_HOST` | SMTP host. |
| `SMTP_PORT` | SMTP port. |
| `SMTP_SECURE` | SMTP secure connection flag. |
| `SMTP_USER` | SMTP user. |
| `SMTP_PASS` | SMTP password/app password. |
| `EMAIL_FROM` | Password reset sender. |
| `PASSWORD_RESET_TOKEN_MINUTES` | Reset token lifetime. |

Frontend:

| Variable | Purpose |
| --- | --- |
| `BACKEND_URL` | Backend origin used by Next.js rewrite/proxy configuration. |
| `NEXT_PUBLIC_API_URL` | Browser-visible backend API origin. |
| `NEXT_PUBLIC_APP_URL` | Deployed frontend origin. |

## Cookie and CORS Requirements

Production cookie behavior requires:

- HTTPS frontend.
- HTTPS backend.
- `NODE_ENV=production`.
- `FRONTEND_URL` set to the deployed frontend origin.
- `NEXT_PUBLIC_API_URL` set to the deployed backend origin.

The backend allows configured frontend origins plus localhost development origins.

## Production Checklist

- Set `NODE_ENV=production`.
- Use a long random `JWT_SECRET`.
- Configure `FRONTEND_URL` with the exact frontend origin.
- Configure `NEXT_PUBLIC_APP_URL` with the exact frontend origin.
- Configure `NEXT_PUBLIC_API_URL` with the exact backend origin.
- Configure `MONGO_URI` and confirm network access from the backend host.
- Configure `GOOGLE_GENAI_API_KEY`.
- Configure SMTP credentials and confirm password reset email delivery.
- Confirm frontend build succeeds.
- Confirm backend starts without environment validation errors.
- Confirm `/health` returns `{"status":"ok"}`.
- Confirm `/api/health/gemini` returns useful diagnostics.
- Confirm login sets a cookie in the browser.
- Confirm protected dashboard routes work after refresh.
- Confirm `.env`, local data stores, logs, caches, and build outputs are not committed.

## Common Deployment Issues

| Issue | Cause | Fix |
| --- | --- | --- |
| Login works but refresh logs out | Cookie not stored or sent | Use HTTPS, correct frontend/backend origins, and credentials-enabled requests. |
| CORS error | Deployed frontend origin is not allowed | Set `FRONTEND_URL` and `NEXT_PUBLIC_APP_URL` correctly. |
| AI routes fail | Missing/invalid Gemini key or quota exhausted | Check `GOOGLE_GENAI_API_KEY`, model access, and quota. |
| Password reset emails do not send | SMTP credentials invalid | Verify SMTP host, port, secure flag, user, pass, and sender. |
| Reports are not durable | MongoDB not connected | Check `MONGO_URI` and database network rules. |
| Frontend calls localhost in production | `NEXT_PUBLIC_API_URL` not set | Set it to the deployed backend API origin before build. |

## Release Notes

This repository currently uses `docs/CHANGELOG.md` for project documentation changes. Add formal release notes when versioned releases begin.
