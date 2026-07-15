# Testing

## Current Verification Commands

Frontend lint:

```bash
npm --prefix Frontend run lint
```

Frontend build:

```bash
npm --prefix Frontend run build
```

Backend syntax checks:

```bash
node --check Backend/server.js
node --check Backend/src/app.js
```

Backend smoke checks after starting the API:

```bash
curl http://localhost:3001/health
curl http://localhost:3001/
```

Gemini diagnostic check:

```bash
curl http://localhost:3001/api/health/gemini
```

## Manual Regression Areas

Authentication:

- Register a new account.
- Sign in with a valid account.
- Confirm invalid credentials show a safe error.
- Confirm dashboard redirects when logged out.
- Request password reset.
- Verify reset token flow.
- Change profile details.
- Change password.
- Sign out.
- Delete account.

Report generation:

- Generate an interview report with job description and resume upload.
- Generate an interview report with job description and self-description.
- Upload supported PDF, DOCX, and TXT files.
- Confirm unsupported files are rejected.
- Open a saved report.
- Delete a saved report.

Report workspace:

- Update question completion state.
- Bookmark questions.
- Persist dashboard filters and active section.
- Export JSON.
- Export Markdown.
- Regenerate resume builder data.
- Export resume PDF.

AI strategy chat:

- Send a non-streaming chat request.
- Send a streaming chat request.
- Confirm streamed chunks appear incrementally.
- Confirm invalid empty chat messages are rejected.

Deployment smoke:

- Confirm frontend build succeeds.
- Confirm backend starts with production env vars.
- Confirm cookies work over deployed HTTPS origins.
- Confirm password reset emails are delivered.

## Current Test Coverage Status

Automated test suites are not documented in the current implementation. Verification is currently based on lint/build checks, backend syntax checks, health endpoints, and manual regression testing.

## Recommended Future Automation

- Backend route tests for auth, interview ownership, exports, and error responses.
- Model tests for password reset and report ownership.
- Service tests for local fallback store behavior.
- Frontend component tests for auth forms and report interactions.
- Playwright smoke tests for landing, register, login, dashboard, report, and AI chat.
- CI jobs for frontend lint/build, backend syntax checks, and security scanning.
