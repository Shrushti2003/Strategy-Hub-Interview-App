# Strategy Hub Backend

This directory contains the Express backend for Strategy Hub. It handles authentication, protected API routes, interview report generation, Gemini integration, persistence, file uploads, password reset email, and PDF export.

## Technologies Used

| Area | Technologies |
| --- | --- |
| Runtime | Node.js, CommonJS |
| API | Express 5 |
| Auth | JWT, HTTP-only cookies, bcryptjs |
| Database | MongoDB, Mongoose |
| Local fallback | Runtime-generated JSON file store under `.data/` |
| Uploads | multer memory storage |
| AI | Google GenAI SDK |
| Email | Nodemailer SMTP |
| PDF | Puppeteer |

## Folder Structure

```text
Backend/
├── README.md
├── server.js
├── package.json
└── src/
    ├── app.js
    ├── config/
    ├── controllers/
    ├── middlewares/
    ├── models/
    ├── routes/
    └── services/
```

## Application Entry Points

| File | Purpose |
| --- | --- |
| `server.js` | Connects to the database and starts the HTTP server. |
| `src/app.js` | Creates the Express app, configures middleware, mounts routes, and handles errors. |

## API Modules

| Route Module | Mounted At | Purpose |
| --- | --- | --- |
| `src/routes/auth-routes.js` | `/api/auth` | Registration, login, logout, session, password reset, account operations. |
| `src/routes/interview-routes.js` | `/api/interview` | Report generation, saved reports, state updates, export, chat, resume PDF. |
| `src/routes/resume-export-routes.js` | `/api/resume-export` | Resume builder payload PDF export. |

Health routes are defined directly in `src/app.js`:

- `GET /`
- `GET /health`
- `GET /api/health/gemini`

## Controllers

| Controller | Responsibility |
| --- | --- |
| `auth-controller.js` | User registration, login, password reset, account updates, password changes, logout, account deletion. |
| `interview-controller.js` | Upload parsing orchestration, report generation, report CRUD-like actions, question/dashboard state, exports, resume PDFs, AI chat. |
| `resume-export-controller.js` | PDF export for resume builder payloads. |

## Middleware

| Middleware | Responsibility |
| --- | --- |
| `auth-middleware.js` | Verifies JWT cookie, loads user, invalidates stale sessions, attaches `req.user`. |
| `file-upload-middleware.js` | Uses in-memory upload handling with a 5 MB limit. Text extraction is implemented for PDF, DOCX, and TXT files. |

## Authentication

Authentication uses:

- bcrypt password hashes.
- JWT tokens signed with `JWT_SECRET`.
- HTTP-only cookie named `token`.
- Seven-day cookie lifetime.
- Secure cross-site cookie settings in production.
- Password-change invalidation for older tokens.

See [Authentication](../docs/AUTHENTICATION.md).

## Database

The backend uses MongoDB through Mongoose when connected.

Models:

- `User`
- `InterviewReport`

If MongoDB is unavailable in development, the backend can use a local JSON fallback store through `src/services/local-store.js`. The `.data/store.json` file is recreated automatically at runtime when missing and is ignored by git. The fallback store is not intended for durable production storage.

See [Database Schema](../docs/DATABASE_SCHEMA.md).

## AI Services

AI behavior is organized under `src/services/ai-service.js` and `src/services/gemini/`.

The backend can:

- Extract resume text from PDF, DOCX, and TXT.
- Analyze optional resume style text.
- Build candidate/job context.
- Generate interview strategy reports.
- Generate question sets.
- Generate roadmap and resume builder data.
- Regenerate resume builder data for saved reports.
- Stream career chat responses through SSE.
- Generate resume PDFs.

See [AI Architecture](../docs/AI_ARCHITECTURE.md).

## Environment Variables

Backend reads the root `.env` file through `src/config/env.js`.

Important variables:

- `NODE_ENV`
- `PORT`
- `FRONTEND_URL`
- `MONGO_URI`
- `JWT_SECRET`
- `GOOGLE_GENAI_API_KEY`
- `GEMINI_MODEL`
- `GEMINI_VERIFY_MODELS`
- `GEMINI_STAGE_CONCURRENCY`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `EMAIL_FROM`
- `PASSWORD_RESET_TOKEN_MINUTES`

See [Environment Setup](../docs/ENVIRONMENT_SETUP.md).

## Local Development

Install dependencies:

```bash
npm --prefix Backend install
```

Start development server:

```bash
npm --prefix Backend run dev
```

Start production-style server:

```bash
npm --prefix Backend run start
```

Default backend URL:

```text
http://localhost:3001
```

## Error Handling

The Express error middleware returns structured JSON:

```json
{
  "success": false,
  "step": "express:error-middleware",
  "reason": "Safe user-facing reason",
  "details": "Sanitized diagnostics",
  "message": "Safe user-facing message"
}
```

AI generation errors include additional step and payload diagnostics. Secret-like values are sanitized before being returned.

## Logging

The backend logs:

- Server startup.
- Generation stages.
- AI request attempts and failures.
- Upload extraction diagnostics.
- Database save stages.
- Performance timings for report generation.

Logs are written to standard output/error. Log files are ignored by git.

## Related Documentation

- [API Documentation](../docs/API_DOCUMENTATION.md)
- [Authentication](../docs/AUTHENTICATION.md)
- [AI Architecture](../docs/AI_ARCHITECTURE.md)
- [Security](../docs/SECURITY.md)
- [Deployment](../docs/DEPLOYMENT.md)
