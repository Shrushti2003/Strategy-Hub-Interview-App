# Authentication

## Overview

Strategy Hub uses email/password authentication with JWT sessions stored in an HTTP-only `token` cookie.

The backend owns session creation and validation. The frontend calls `/api/auth/get-me` to bootstrap user state and redirects unauthenticated dashboard users to `/login`.

## Registration

Endpoint:

```text
POST /api/auth/register
```

Request body:

```json
{
  "username": "Jane Doe",
  "email": "jane@example.com",
  "password": "password123"
}
```

Validation:

- `username`, `email`, and `password` are required.
- Email must be valid.
- Username must be at least 2 characters.
- Password must be at least 8 characters and include at least one letter and one number.
- Username and email must be unique.

On success, the backend hashes the password, creates the user, sets the `token` cookie, and returns public user data.

## Login

Endpoint:

```text
POST /api/auth/login
```

Request body:

```json
{
  "email": "jane@example.com",
  "password": "password123"
}
```

On success, the backend sets the `token` cookie and returns public user data.

## Session Cookie

Cookie name:

```text
token
```

Cookie behavior:

- HTTP-only.
- Signed JWT.
- Seven-day max age.
- `sameSite=lax` in development.
- `sameSite=none` and `secure=true` in production.

JWT payload includes:

- User id as `sub`.
- Email.
- Username.

## Session Bootstrap

Endpoint:

```text
GET /api/auth/get-me
```

Behavior:

- If the cookie is valid, returns public user data.
- If the cookie is missing, invalid, or older than the last password change, clears the cookie and returns `user: null`.
- The endpoint returns a 200 response for no active session so the frontend can handle auth state gracefully.

## Protected Routes

Backend protected routes use `authUser` middleware.

Protected route groups include:

- Account update.
- Password change.
- Account deletion.
- Interview report generation.
- Saved report retrieval.
- Report state updates.
- Report export.
- Resume PDF generation.
- AI strategy chat.

The middleware verifies the JWT cookie, loads the user from MongoDB or the local fallback store, checks password-change invalidation, and attaches public user data to `req.user`.

## Frontend Authorization Flow

The frontend auth provider:

1. Calls `getMe()` during route changes.
2. Stores user state in React context.
3. Persists a local session marker in `localStorage`.
4. Redirects unauthenticated `/dashboard` users to `/login`.
5. Redirects authenticated users away from `/login` and `/register` to `/dashboard`.

The local session marker is not the source of authorization. The backend cookie remains authoritative.

## Logout

Endpoints:

```text
POST /api/auth/logout
GET /api/auth/logout
```

The backend clears the `token` cookie and returns a success message. The frontend also clears local session markers.

## Password Reset

Request reset:

```text
POST /api/auth/forgot-password
```

Verify reset token:

```text
GET /api/auth/reset-password/verify?token=...
```

Reset password:

```text
POST /api/auth/reset-password
```

Implementation details:

- Reset tokens are random 32-byte hex strings.
- Only SHA-256 token hashes are stored.
- Token expiration is controlled by `PASSWORD_RESET_TOKEN_MINUTES`.
- Reset requests are rate-limited per account by a one-minute guard.
- Password reset clears the current auth cookie.

## Account Management

Authenticated users can:

- Update username/email through `PATCH /api/auth/account`.
- Change password through `PATCH /api/auth/password`.
- Delete the account through `DELETE /api/auth/account`.

Deleting an account also deletes owned interview reports.
