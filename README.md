# Strategy Hub

Strategy Hub is an AI-powered career workspace for interview preparation, resume optimization, ATS-focused resume building, career strategy chat, and saved interview reports.

The repository contains a Next.js frontend and an Express backend. The backend handles authentication, file parsing, Gemini-powered report generation, persistence, and PDF exports. The frontend provides the landing page, authentication screens, protected dashboard, report review workspace, resume tools, and AI strategy chat.

## Table of Contents

- [Project Overview](#project-overview)
- [Key Features](#key-features)
- [AI Features](#ai-features)
- [Tech Stack](#tech-stack)
- [Architecture Overview](#architecture-overview)
- [Folder Structure](#folder-structure)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Running Locally](#running-locally)
- [Available Scripts](#available-scripts)
- [Documentation](#documentation)
- [API Overview](#api-overview)
- [Deployment](#deployment)
- [Security](#security)
- [Testing](#testing)
- [Future Improvements](#future-improvements)
- [License](#license)

## Project Overview

Strategy Hub helps job seekers turn job descriptions, resumes, and self-descriptions into practical interview preparation material. Users can generate interview reports, review technical and behavioral questions, track progress, export report data, build ATS-oriented resumes, and chat with an AI career strategist.

The application is designed as a portfolio-quality full-stack project with production-oriented documentation, secure cookie-based authentication, structured backend modules, and a modern dashboard experience.

## Key Features

- Email/password registration and login.
- HTTP-only cookie sessions.
- Protected dashboard routes.
- Password reset through email.
- Account profile updates, password changes, and account deletion.
- Interview report generation from job descriptions plus resume upload or self-description.
- Resume upload support for PDF, DOCX, and TXT files.
- Saved interview reports with owner-scoped access.
- Question completion and bookmark state.
- Dashboard filter/search state persistence.
- JSON and Markdown report export.
- Resume builder preview and PDF export.
- AI strategy chat with streaming Server-Sent Events support.

## AI Features

- Candidate context generation from resume text and/or self-description.
- Job description analysis.
- Match score and skill gap generation.
- Technical, behavioral, and resume-specific interview questions.
- STAR-style behavioral answer guidance.
- Interview strategy and preparation priorities.
- 7 to 14 day preparation roadmap generation.
- ATS analysis, missing keyword detection, and resume suggestions.
- Resume builder data generation and regeneration.
- Career strategy chat through Gemini.

The backend uses the Google GenAI SDK and reads the configured Gemini model from environment variables. It also includes model fallback behavior and structured error handling for quota, timeout, and configuration failures.

## Tech Stack

| Area | Technologies |
| --- | --- |
| Frontend | Next.js 16, React 19, Tailwind CSS 4, React Hook Form, Zod |
| UI/State | shadcn-style components, Base UI, TanStack Query, Zustand, Framer Motion, Lucide React |
| Backend | Node.js, Express 5, CommonJS |
| Auth | JWT, HTTP-only cookies, bcryptjs |
| Database | MongoDB with Mongoose; local JSON fallback store for development resilience |
| AI | Google GenAI SDK |
| Uploads | multer memory storage, PDF/DOCX/TXT text extraction |
| Email | Nodemailer SMTP |
| PDF | Puppeteer-generated resume PDF output |

## Architecture Overview

```text
Browser
  |
  | Next.js pages, dashboard UI, axios/fetch requests
  v
Frontend/
  |
  | JSON, multipart form data, blobs, SSE
  v
Backend/
  |
  +-- Auth controllers and JWT cookie middleware
  +-- Interview report controllers
  +-- Gemini service pipeline
  +-- Resume PDF generation
  +-- SMTP password reset email
  |
  v
MongoDB or local fallback store
```

## Folder Structure

```text
gen-AI/
├── README.md
├── LICENSE
├── .env.example
├── .gitignore
├── package.json
├── Backend/
│   ├── README.md
│   ├── server.js
│   ├── package.json
│   └── src/
│       ├── app.js
│       ├── config/
│       ├── controllers/
│       ├── middlewares/
│       ├── models/
│       ├── routes/
│       └── services/
├── Frontend/
│   ├── README.md
│   ├── package.json
│   └── src/
│       ├── app/
│       ├── components/
│       ├── lib/
│       └── providers/
└── docs/
    ├── README.md
    ├── API_DOCUMENTATION.md
    ├── APP_FLOW.md
    ├── AUTHENTICATION.md
    ├── AI_ARCHITECTURE.md
    ├── DATABASE_SCHEMA.md
    ├── DEPLOYMENT.md
    ├── ENVIRONMENT_SETUP.md
    ├── PROJECT_STRUCTURE.md
    ├── SECURITY.md
    ├── TESTING.md
    ├── TROUBLESHOOTING.md
    └── ...
```

Note: the folder names `Backend`, `Frontend`, and `docs` match the current repository casing and script paths.

## Installation

Install backend and frontend dependencies separately:

```bash
npm --prefix Backend install
npm --prefix Frontend install
```

The root package provides helper scripts that call into these two applications.

## Environment Variables

Create a local `.env` file from `.env.example` and replace placeholders with real values.

Important backend values:

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

Important frontend values:

- `BACKEND_URL`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_APP_URL`

See [Environment Setup](docs/ENVIRONMENT_SETUP.md) for details.

## Running Locally

Start the backend:

```bash
npm run dev:backend
```

Start the frontend in another terminal:

```bash
npm run dev:frontend
```

Open the frontend at:

```text
http://localhost:3000
```

The backend defaults to:

```text
http://localhost:3001
```

## Available Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Starts the backend development server. |
| `npm run dev:backend` | Starts the Express API with nodemon. |
| `npm run dev:frontend` | Starts the Next.js development server. |
| `npm run build` | Builds the frontend. |
| `npm run lint` | Runs frontend linting. |
| `npm run lint:frontend` | Runs frontend linting. |
| `npm run start:frontend` | Starts the built frontend. |

## Documentation

Start with [docs/README.md](docs/README.md) for the complete documentation index.

Key documents:

- [Product Requirements](docs/PRD.md)
- [Technical Requirements](docs/TRD.md)
- [System Architecture](docs/SYSTEM_ARCHITECTURE.md)
- [Project Structure](docs/PROJECT_STRUCTURE.md)
- [API Documentation](docs/API_DOCUMENTATION.md)
- [Authentication](docs/AUTHENTICATION.md)
- [AI Architecture](docs/AI_ARCHITECTURE.md)
- [Database Schema](docs/DATABASE_SCHEMA.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Security](docs/SECURITY.md)
- [Testing](docs/TESTING.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)

## API Overview

The backend exposes:

- Public health routes.
- Authentication routes under `/api/auth`.
- Interview report routes under `/api/interview`.
- Resume export routes under `/api/resume-export`.
- Gemini health diagnostics under `/api/health/gemini`.

Protected endpoints require the `token` HTTP-only cookie issued during registration or login. See [API Documentation](docs/API_DOCUMENTATION.md) for request and response details.

## Deployment

The frontend and backend are separate deployable applications:

- Deploy `Frontend/` as the Next.js application.
- Deploy `Backend/` as the Express API.
- Configure MongoDB, Gemini, SMTP, and deployed frontend/backend origins through environment variables.
- Use HTTPS in production so secure cookies work correctly.

See [Deployment](docs/DEPLOYMENT.md) for the full checklist.

## Security

Security controls currently include password hashing, JWT HTTP-only cookies, production secure cookies, trusted origin checks for mutating requests, restricted CORS, sanitized errors, and ignored secret files.

See [Security](docs/SECURITY.md) and [Authentication](docs/AUTHENTICATION.md).

## Testing

Current verification is primarily build/lint/smoke/manual regression focused. See [Testing](docs/TESTING.md) for the current commands and recommended future automation.

## Future Improvements

- Add automated backend route tests.
- Add frontend component and end-to-end tests.
- Add CI workflows for lint, build, syntax checks, and security scanning.
- Add public screenshots or a demo link when a verified deployment is available.
- Add contributor-facing files such as `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, and issue templates if the repository becomes open source.
- Add formal release notes once versioned releases begin.

## License

This repository currently uses a proprietary license notice. See [LICENSE](LICENSE).
