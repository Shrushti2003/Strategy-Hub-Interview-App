# System Architecture

## Overview

Strategy Hub is a two-application full-stack project:

- `Frontend/`: Next.js application for landing, auth, dashboard, report review, resume tools, account pages, and AI strategy chat.
- `Backend/`: Express API for authentication, report generation, persistence, AI services, uploads, email, and PDF export.

```text
Browser
  |
  | Next.js UI, credentials-enabled API calls
  v
Frontend/
  |
  | JSON, multipart/form-data, PDF blobs, SSE
  v
Backend/
  |
  +-- Auth controllers and JWT cookie middleware
  +-- Interview report controllers
  +-- Gemini generation pipeline
  +-- SMTP password reset email
  +-- PDF rendering
  |
  v
MongoDB or local fallback store
```

## Request Flow

1. The browser loads the Next.js app.
2. The frontend API client sends requests to `NEXT_PUBLIC_API_URL` with credentials enabled.
3. The backend applies JSON parsing, cookie parsing, CORS, trusted-origin checks, and route handling.
4. Protected routes validate the `token` cookie through `authUser`.
5. Controllers validate request data and call services.
6. Persistence uses MongoDB when connected or the local fallback store when MongoDB is unavailable.
7. AI routes call Gemini service helpers and validate generated output.
8. Responses return JSON, Markdown, PDF blobs, or SSE events depending on route.

## Frontend Architecture

| Area | Responsibility |
| --- | --- |
| `src/app/` | App Router routes and layouts. |
| `src/components/auth/` | Auth forms and password reset UI. |
| `src/components/dashboard/` | Dashboard, generation flow, AI output, and chat UI. |
| `src/components/resume/` | Resume builder and ATS score UI. |
| `src/lib/api.js` | API client and streaming chat helper. |
| `src/providers/auth-provider.jsx` | Auth state bootstrap and dashboard route guarding. |

## Backend Architecture

| Area | Responsibility |
| --- | --- |
| `src/app.js` | Express app setup, middleware, routes, errors. |
| `src/config/env.js` | Root `.env` loading, validation, secret masking. |
| `src/config/database.js` | MongoDB connection. |
| `src/routes/` | Route definitions. |
| `src/controllers/` | Request orchestration. |
| `src/models/` | Mongoose schemas. |
| `src/middlewares/` | Auth and file upload handling. |
| `src/services/` | AI, email, local store, Gemini helpers, PDF generation. |

## Authentication Flow

1. User registers or logs in.
2. Backend validates credentials.
3. Backend sets an HTTP-only JWT cookie named `token`.
4. Frontend calls `/api/auth/get-me` to bootstrap auth state.
5. Protected dashboard routes redirect unauthenticated users to `/login`.
6. Protected backend routes verify the cookie and attach `req.user`.

## Data Flow

- Users and interview reports are stored in MongoDB when connected.
- The local fallback store writes runtime-generated JSON data under `.data/` for development resilience. The directory is recreated automatically when missing and is ignored by git.
- Report ownership is enforced by querying reports with both report id and user id.

## AI Flow

1. Uploaded files are extracted into normalized text.
2. Candidate context is built from resume/self-description/job description.
3. Gemini stages generate core analysis, questions, roadmap, and resume builder data.
4. Responses are parsed as JSON and validated.
5. The merged report is saved and returned to the frontend.

## Streaming Flow

AI strategy chat supports SSE when the request includes:

```text
Accept: text/event-stream
```

The backend emits `start`, `chunk`, `done`, and `error` events.

## External Dependencies

| Service | Purpose |
| --- | --- |
| MongoDB | Persistent user and report storage. |
| Google Gemini | AI generation and streaming chat. |
| SMTP provider | Password reset email delivery. |
