# Project Structure

## Overview

Strategy Hub is organized as a two-application repository:

- `Frontend/` contains the Next.js user interface.
- `Backend/` contains the Express API and server-side services.
- `docs/` contains project documentation.

Application source code is not shared through a package workspace. Root scripts proxy into `Backend` and `Frontend`.

## Repository Layout

```text
gen-AI/
├── README.md
├── LICENSE
├── .env.example
├── .gitignore
├── package.json
├── Backend/
├── Frontend/
└── docs/
```

## Root Files

| Path | Purpose |
| --- | --- |
| `README.md` | Public-facing GitHub project overview. |
| `LICENSE` | Current proprietary license notice. |
| `.env.example` | Safe placeholder environment template. |
| `.gitignore` | Root ignore rules for secrets, dependencies, builds, logs, caches, and local data. |
| `package.json` | Root helper scripts for backend and frontend commands. |

## Backend Responsibilities

`Backend/` is responsible for:

- Express app initialization.
- CORS and trusted-origin enforcement.
- Authentication routes and controllers.
- JWT cookie issuing and validation.
- MongoDB/Mongoose persistence.
- Local JSON fallback persistence when MongoDB is unavailable.
- Resume upload parsing.
- Gemini AI report generation.
- Career chat responses and SSE streaming.
- Resume PDF rendering.
- Password reset email delivery.

Important backend folders:

| Folder | Responsibility |
| --- | --- |
| `src/config/` | Environment loading and database connection. |
| `src/controllers/` | Request handling and orchestration. |
| `src/middlewares/` | Auth and upload middleware. |
| `src/models/` | Mongoose schemas. |
| `src/routes/` | Express route definitions. |
| `src/services/` | AI, email, local store, and Gemini helpers. |

## Frontend Responsibilities

`Frontend/` is responsible for:

- Landing page.
- Authentication pages.
- Protected dashboard.
- Report generation UI.
- Report review workspace.
- Resume builder UI.
- Account/profile/settings pages.
- AI strategy chat UI.
- API client calls to the backend.
- Theme and auth providers.

Important frontend folders:

| Folder | Responsibility |
| --- | --- |
| `src/app/` | Next.js App Router pages and layouts. |
| `src/components/` | Auth, dashboard, resume, shared, and UI components. |
| `src/lib/` | API client, constants, motion helpers, and utilities. |
| `src/providers/` | Authentication and theme providers. |
| `public/` | Static frontend assets. |

## Documentation Organization

`docs/` stores durable project documentation. Topic-specific docs live here instead of crowding the root README.

The root README should stay concise and point to deeper docs.

## Naming Conventions

- Keep current directory casing: `Backend`, `Frontend`, `docs`.
- Use uppercase Markdown filenames for major docs, such as `API_DOCUMENTATION.md`.
- Use kebab-free route names in documentation exactly as implemented, such as `/api/interview/report/:interviewId`.
- Use `Strategy Hub` as the product name in prose.

## Repository State Note

The current root Git index tracks `Frontend` as a gitlink-style entry. If this repository is published or cloned elsewhere, document or resolve the intended frontend repository/submodule workflow before external contributors rely on it.
