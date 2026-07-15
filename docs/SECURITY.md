# Security

## Current Controls

- Passwords are hashed with bcrypt.
- JWT sessions are stored in an HTTP-only cookie named `token`.
- Production cookies use `secure=true` and `sameSite=none`.
- Development cookies use `sameSite=lax`.
- Password reset tokens are stored only as SHA-256 hashes.
- Password reset requests use a one-minute per-account guard.
- Password changes invalidate older JWTs.
- Protected API routes use `authUser`.
- Report access is scoped to the authenticated owner.
- Mutating requests are checked against trusted origins.
- CORS is restricted to configured frontend origins and local development origins.
- Express disables `x-powered-by`.
- Security headers include content type, referrer, and permissions policies.
- Error messages are sanitized to avoid leaking secret values.
- `.env`, `.env.*`, local data files, logs, caches, and build outputs are ignored by git.

## Secret Handling

Keep these values only in local or deployment environment variables:

- `MONGO_URI`
- `JWT_SECRET`
- `GOOGLE_GENAI_API_KEY`
- `SMTP_USER`
- `SMTP_PASS`
- private certificates
- service account files

`.env.example` must contain placeholders only.

## Authentication Security

The backend signs JWTs with `JWT_SECRET` and stores them in an HTTP-only cookie. The frontend cannot read the cookie directly and must ask the backend for session state through `/api/auth/get-me`.

If a user changes or resets their password, older tokens are considered invalid.

## Upload Security

The upload middleware:

- Uses memory storage.
- Limits files to 5 MB.
- Limits files to formats used by the implemented text extraction paths: PDF, DOCX, and TXT.
- Returns an upload error for unexpected file types.

Uploaded files are parsed for text extraction. They are not documented as being stored permanently.

## Production Checklist

- Use a long random `JWT_SECRET`.
- Set `NODE_ENV=production`.
- Use HTTPS for frontend and backend.
- Set `FRONTEND_URL` to the deployed frontend origin.
- Set `NEXT_PUBLIC_APP_URL` to the deployed frontend origin.
- Set `NEXT_PUBLIC_API_URL` to the deployed backend origin.
- Restrict MongoDB network access to deployment hosts where possible.
- Use app-specific SMTP credentials.
- Rotate secrets if they are exposed.
- Verify no real secrets are committed.
- Confirm password reset email does not leak account existence.
- Confirm CORS rejects untrusted origins.

## Known Security Boundaries

- The local fallback store is for development resilience, not production durability.
- AI-generated content should be treated as generated guidance, not authoritative career, legal, or financial advice.
- Rate limiting beyond the documented password reset guard is not currently documented in the implementation.
- TODO: Add formal vulnerability disclosure policy if this repository becomes open source.
