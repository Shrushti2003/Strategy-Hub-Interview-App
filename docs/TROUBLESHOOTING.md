# Troubleshooting

## Backend Does Not Start

Check that the root `.env` file exists and includes `JWT_SECRET`.

The backend validates environment configuration during startup. In production, it also requires MongoDB, Gemini, SMTP user/pass, and email sender configuration.

## MongoDB Connection Issues

Symptoms:

- Backend logs database connection failures.
- Data appears in local development but not in MongoDB.
- Reports or users do not persist across environments.

Checks:

- Confirm `MONGO_URI` is correct.
- Confirm the MongoDB deployment allows connections from the backend host.
- Confirm database credentials are valid.
- Confirm `NODE_ENV=production` has a valid `MONGO_URI`.

The backend has a local JSON fallback store for development resilience. It is not intended as durable production storage.

## Gemini API Issues

Symptoms:

- Report generation fails.
- AI strategy chat fails.
- `/api/health/gemini` returns a failing status.
- Errors mention quota, unavailable model, invalid key, or timeout.

Checks:

- Confirm `GOOGLE_GENAI_API_KEY` is set.
- Confirm the key has access to the configured model.
- Confirm `GEMINI_MODEL` is valid for the account.
- If model verification is needed, set `GEMINI_VERIFY_MODELS=true`.
- If quota is exhausted, wait for quota reset or use a key with sufficient quota.

## Authentication Issues

Symptoms:

- Login succeeds but dashboard redirects to login.
- `GET /api/auth/get-me` returns `user: null`.
- Cookies are not retained in production.

Checks:

- Confirm frontend requests use credentials.
- Confirm backend CORS allows the frontend origin.
- Confirm frontend and backend run over HTTPS in production.
- Confirm `FRONTEND_URL`, `NEXT_PUBLIC_APP_URL`, and `NEXT_PUBLIC_API_URL` match deployed origins.
- Confirm browser privacy settings are not blocking cross-site cookies.

## Password Reset Email Issues

Symptoms:

- Password reset request returns success but email is not received.
- SMTP errors appear in backend logs.

Checks:

- Confirm `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, and `SMTP_PASS`.
- For Gmail, use an app password where required.
- Confirm `EMAIL_FROM` is accepted by the SMTP provider.
- Check spam/junk folders.

The API intentionally returns a generic success message for password reset requests so account existence is not leaked.

## Upload Issues

Supported resume formats:

- PDF
- DOCX
- TXT

The upload middleware uses in-memory storage and limits files to 5 MB. Unsupported files return an upload error.

If text extraction fails:

- Try a text-selectable PDF instead of a scanned image PDF.
- Try DOCX or TXT format.
- Confirm the uploaded file is not empty.

## Frontend Build Issues

Run:

```bash
npm --prefix Frontend run lint
npm --prefix Frontend run build
```

Common checks:

- Confirm frontend dependencies are installed.
- Confirm environment variables used by the frontend are present where required.
- Confirm the backend URL used by the frontend is valid.

## Deployment Issues

Common deployment causes:

- Backend and frontend origins do not match CORS allow-list values.
- Production cookies require HTTPS.
- MongoDB network access does not allow the backend host.
- Gemini API quota is unavailable.
- SMTP provider blocks the deployment environment.

See [DEPLOYMENT.md](DEPLOYMENT.md) for the deployment checklist.
