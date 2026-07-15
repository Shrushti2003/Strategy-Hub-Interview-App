# Application Flow

## Landing to Auth

1. User opens `/`.
2. User chooses Register or Sign In.
3. Frontend routes to `/register` or `/login`.
4. Auth form submits to the backend.
5. Backend validates input and credentials.
6. Backend sets an HTTP-only `token` cookie on success.
7. Frontend stores user state in the auth provider.
8. User enters the protected dashboard.

## Session Bootstrap

1. Frontend route changes trigger auth bootstrap.
2. Frontend calls `GET /api/auth/get-me`.
3. Backend validates the `token` cookie.
4. If valid, frontend stores the returned user.
5. If invalid or missing, frontend clears local session markers.
6. Unauthenticated dashboard users are redirected to `/login`.

## Report Generation

1. User opens `/dashboard/generate`.
2. User provides a job description.
3. User adds either a resume upload or self-description.
4. User may add an optional style resume upload.
5. Frontend submits multipart form data to `POST /api/interview`.
6. Backend validates request data.
7. Backend extracts text from PDF, DOCX, or TXT files.
8. Backend analyzes optional resume style text.
9. Backend builds candidate context.
10. Backend calls Gemini service helpers.
11. Backend validates and merges generated sections.
12. Backend saves the report to MongoDB or the local fallback store.
13. Frontend displays the report workspace.

## Report Review

1. User opens `/dashboard/interview/[id]`.
2. Frontend fetches the owned report.
3. User reviews questions, skill gaps, roadmap, strategy, ATS analysis, and resume builder output.
4. User can mark questions complete.
5. User can bookmark questions.
6. User can persist dashboard filters.
7. User can regenerate resume builder data.
8. User can export report JSON or Markdown.
9. User can download resume PDF output.

## AI Strategy Chat

1. User opens `/dashboard/ai-strategy`.
2. Frontend sends message history to `POST /api/interview/chat`.
3. If streaming is requested, frontend sends `Accept: text/event-stream`.
4. Backend sends SSE events.
5. Frontend appends chunks as they arrive.
6. Completed assistant response remains in chat UI state.

## Account Lifecycle

1. User can update profile details.
2. User can change password.
3. User can request password reset by email.
4. User can sign out, which clears auth state and cookie.
5. User can delete the account, which also removes owned interview reports.
