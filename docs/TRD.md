# Technical Requirements Document

## Stack

| Area | Requirements |
| --- | --- |
| Frontend | Next.js 16, React 19, Tailwind CSS 4, React Hook Form, Zod, Axios, Framer Motion, Lucide React, shadcn-style UI components. |
| Backend | Node.js, Express 5, CommonJS, JWT, bcryptjs, cookie-parser, multer, Nodemailer, Puppeteer. |
| Database | MongoDB with Mongoose; local JSON fallback store when MongoDB is unavailable. |
| AI | Google GenAI SDK with Gemini model configuration, fallback model chain, JSON parsing, validation, and streaming text support. |

## Frontend Requirements

- Use `NEXT_PUBLIC_API_URL` for browser API calls.
- Use credentials-enabled requests for cookie-authenticated API calls.
- Use `BACKEND_URL` where Next.js rewrite/proxy behavior is configured.
- Redirect unauthenticated dashboard users to `/login`.
- Redirect authenticated users away from `/login` and `/register`.
- Preserve responsive dashboard, auth, landing, resume, report, and AI strategy pages.
- Support SSE chat streaming through `fetch`.

## Backend Requirements

- Load the root `.env` file through `Backend/src/config/env.js`.
- Validate required environment variables before startup.
- Require `JWT_SECRET` in all environments.
- Require production-critical values when `NODE_ENV=production`.
- Enforce trusted origins for mutating requests.
- Use CORS with credentials enabled.
- Use HTTP-only auth cookies.
- Protect private routes with `authUser`.
- Scope report reads/writes/deletes to the authenticated owner.
- Sanitize error details before returning API errors.
- Keep uploads memory-bounded and file-type restricted.

## AI Requirements

- Read Gemini key and model configuration from environment variables.
- Generate JSON for report stages.
- Validate generated sections before saving reports.
- Support partial success when resume builder generation is temporarily unavailable due to quota or provider availability.
- Support career chat through standard JSON response and streaming SSE response.
- Return structured diagnostics without leaking secrets.

## Data Requirements

- User records must include unique username and email.
- Passwords must be stored as hashes.
- Interview reports must be owned by a user.
- Report list queries must return only reports owned by the authenticated user.
- Report detail, update, export, delete, and resume operations must be scoped to the authenticated owner.
- Existing database fields should be preserved for compatibility.

## Operational Requirements

- Build the frontend before production deployment.
- Start the backend with validated environment variables.
- Keep `.env` and deployment secrets outside git.
- Keep local fallback data out of git.
- Keep documentation updated when routes, models, env vars, or deployment behavior change.

## Current Gaps

- Automated test suites are not documented in the current implementation.
- CI/CD workflows are not documented in the current implementation.
- Public demo/screenshots are not currently included.
