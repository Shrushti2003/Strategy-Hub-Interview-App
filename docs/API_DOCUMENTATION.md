# API Documentation

## Overview

Default local base URL:

```text
http://localhost:3001
```

Protected routes require the `token` HTTP-only cookie issued by login or registration. The frontend sends credentials with API requests.

## Common Response Patterns

Success responses usually include a `message` field and route-specific data.

Common error shape:

```json
{
  "success": false,
  "step": "where-the-error-happened",
  "reason": "Safe user-facing reason",
  "details": "Sanitized diagnostics",
  "message": "Safe user-facing message"
}
```

Some validation errors return a simpler shape:

```json
{
  "message": "Validation message"
}
```

## Sessions and Cookies

Cookie name:

```text
token
```

Cookie behavior:

- HTTP-only.
- Set on successful registration and login.
- Cleared on logout, invalid sessions, and password reset.
- Secure and `sameSite=none` in production.
- `sameSite=lax` in development.

## Health

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/` | Public | Backend status and small route summary. |
| `GET` | `/health` | Public | Basic health response. |
| `GET` | `/api/health/gemini` | Public | Gemini configuration/connectivity diagnostics. |

### `GET /health`

Response:

```json
{
  "status": "ok"
}
```

## Auth Routes

### `POST /api/auth/register`

Access: public

Request body:

```json
{
  "username": "Jane Doe",
  "email": "jane@example.com",
  "password": "password123"
}
```

Success response:

```json
{
  "message": "User registered successfully",
  "user": {
    "id": "user-id",
    "username": "Jane Doe",
    "email": "jane@example.com",
    "createdAt": "timestamp"
  }
}
```

Sets the `token` cookie.

### `POST /api/auth/login`

Access: public

Request body:

```json
{
  "email": "jane@example.com",
  "password": "password123"
}
```

Success response:

```json
{
  "message": "Login successful",
  "user": {
    "id": "user-id",
    "username": "Jane Doe",
    "email": "jane@example.com",
    "createdAt": "timestamp"
  }
}
```

Sets the `token` cookie.

### `POST /api/auth/forgot-password`

Access: public

Request body:

```json
{
  "email": "jane@example.com"
}
```

Success response:

```json
{
  "message": "If an account exists for that email, a password reset link has been sent."
}
```

The response intentionally does not reveal whether the email exists.

### `GET /api/auth/reset-password/verify?token=...`

Access: public

Query parameters:

| Name | Required | Description |
| --- | --- | --- |
| `token` | Yes | Raw password reset token from the reset link. |

Success response:

```json
{
  "message": "Password reset link is valid"
}
```

### `POST /api/auth/reset-password`

Access: public

Request body:

```json
{
  "token": "reset-token",
  "password": "newPassword123"
}
```

Success response:

```json
{
  "message": "Password reset successfully. You can now sign in."
}
```

Clears the current `token` cookie.

### `GET /api/auth/get-me`

Access: public session check

Success with active session:

```json
{
  "user": {
    "id": "user-id",
    "username": "Jane Doe",
    "email": "jane@example.com",
    "createdAt": "timestamp"
  }
}
```

Success without active session:

```json
{
  "message": "No active session",
  "user": null
}
```

### `POST /api/auth/logout`

Access: public

Response:

```json
{
  "message": "Logout successful"
}
```

Clears the `token` cookie.

### `GET /api/auth/logout`

Access: public

Same behavior as `POST /api/auth/logout`.

### `PATCH /api/auth/account`

Access: private

Request body:

```json
{
  "username": "Jane Updated",
  "email": "jane.updated@example.com"
}
```

Success response:

```json
{
  "message": "Account updated successfully",
  "user": {
    "id": "user-id",
    "username": "Jane Updated",
    "email": "jane.updated@example.com",
    "createdAt": "timestamp"
  }
}
```

### `PATCH /api/auth/password`

Access: private

Request body:

```json
{
  "currentPassword": "oldPassword123",
  "newPassword": "newPassword123"
}
```

Success response includes a refreshed auth cookie:

```json
{
  "message": "Password updated successfully",
  "user": {
    "id": "user-id",
    "username": "Jane Doe",
    "email": "jane@example.com",
    "createdAt": "timestamp"
  }
}
```

### `DELETE /api/auth/account`

Access: private

Deletes the current user and owned interview reports.

Response:

```json
{
  "message": "Account deleted successfully"
}
```

## Interview Report Routes

### `POST /api/interview`

Access: private

Content type:

```text
multipart/form-data
```

Fields:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `jobDescription` | string | Yes | Job description text. |
| `selfDescription` | string | Required if no resume | Candidate-provided self-description. |
| `resume` | file | Required if no self-description | Resume file. |
| `styleResume` | file | No | Optional sample resume for style analysis. |

Text extraction is implemented for:

- PDF
- DOCX
- TXT

Upload limit:

```text
5 MB per file
```

Success response:

```json
{
  "success": true,
  "partialSuccess": false,
  "generationWarnings": [],
  "message": "Interview report generated successfully.",
  "interviewReport": {}
}
```

If resume builder generation is temporarily unavailable, the route can still return a successful report with `partialSuccess: true` and generation warnings.

### `GET /api/interview`

Access: private

Returns saved report summaries for the current user.

Response:

```json
{
  "message": "Interview reports fetched successfully.",
  "interviewReports": [
    {
      "_id": "report-id",
      "title": "Interview Strategy",
      "jobTitle": "Software Engineer",
      "company": "",
      "matchScore": 80,
      "createdAt": "timestamp",
      "updatedAt": "timestamp"
    }
  ]
}
```

### `GET /api/interview/report/:interviewId`

Access: private

Returns one owned report.

Response:

```json
{
  "message": "Interview report fetched successfully.",
  "interviewReport": {}
}
```

### `DELETE /api/interview/:interviewId`

Access: private

Deletes one owned report.

Response:

```json
{
  "message": "Interview report deleted successfully."
}
```

### `PUT /api/interview/:interviewId/question-state`

Access: private

Request body:

```json
{
  "questionKey": "technical-0",
  "completed": true,
  "bookmarked": false
}
```

Success response:

```json
{
  "message": "Question state updated successfully.",
  "questionState": {
    "technical-0": {
      "completed": true,
      "bookmarked": false
    }
  }
}
```

### `PUT /api/interview/:interviewId/dashboard-state`

Access: private

Request body:

```json
{
  "activeSection": "technical",
  "search": "",
  "difficulty": "all",
  "status": "all",
  "sort": "default"
}
```

Success response:

```json
{
  "message": "Dashboard state updated successfully.",
  "dashboardState": {
    "activeSection": "technical",
    "search": "",
    "difficulty": "all",
    "status": "all",
    "sort": "default"
  }
}
```

### `GET /api/interview/export/:interviewId?format=json`

Access: private

Query parameters:

| Name | Values | Default | Description |
| --- | --- | --- | --- |
| `format` | `json`, `markdown` | `json` | Export format. |

JSON export returns `application/json`.

Markdown export returns `text/markdown`.

### `POST /api/interview/:interviewId/resume-builder`

Access: private

Regenerates resume builder data for an owned report.

Response:

```json
{
  "success": true,
  "message": "Resume Builder regenerated successfully.",
  "resumeBuilder": {},
  "atsResumeData": {},
  "interviewReport": {}
}
```

### `POST /api/interview/resume/pdf/:interviewReportId`

Access: private

Generates a resume PDF from a saved report.

Response:

```text
application/pdf
```

## AI Strategy Chat

### `POST /api/interview/chat`

Access: private

Request body:

```json
{
  "messages": [
    {
      "role": "user",
      "content": "Help me prepare for a React interview."
    }
  ]
}
```

Non-streaming success response:

```json
{
  "message": "AI response generated successfully.",
  "reply": "..."
}
```

### Streaming Chat

Send:

```text
Accept: text/event-stream
```

The backend sends SSE events:

| Event | Description |
| --- | --- |
| `start` | Stream started. |
| `chunk` | Partial text chunk. |
| `done` | Final reply. |
| `error` | Stream error message. |

Example event shape:

```text
event: chunk
data: {"text":"partial response"}
```

## Resume Export

### `POST /api/resume-export/pdf`

Access: private

Exports a resume builder payload as a PDF.

Request body is the resume builder payload used by the frontend resume builder.

Response:

```text
application/pdf
```

## Common Status Codes

| Status | Meaning |
| --- | --- |
| `200` | Successful request. |
| `201` | Resource created, such as a generated interview report. |
| `400` | Validation error or invalid request. |
| `401` | Authentication failure on protected routes. |
| `403` | Origin/CORS rejection or forbidden request. |
| `404` | Owned resource not found. |
| `410` | Expired password reset token. |
| `422` | Upload text extraction failed. |
| `429` | Rate limit or AI quota condition. |
| `500` | Server error. |
| `502` | Upstream/model generation failure. |
| `503` | Service temporarily unavailable. |
