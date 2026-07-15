# Strategy Hub Documentation

This directory contains the project documentation for Strategy Hub. The documents are organized by audience and purpose: product understanding, implementation details, operations, security, and troubleshooting.

## Documentation Index

| Document | Purpose |
| --- | --- |
| [PRD.md](PRD.md) | Product requirements, target users, goals, non-goals, and primary user flows. |
| [TRD.md](TRD.md) | Technical requirements for the frontend, backend, AI services, data, and operations. |
| [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md) | High-level architecture, request flow, route groups, and backend module responsibilities. |
| [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) | Repository layout, folder responsibilities, naming conventions, and documentation organization. |
| [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) | MongoDB/Mongoose data model documentation for users and interview reports. |
| [API_DOCUMENTATION.md](API_DOCUMENTATION.md) | Backend endpoints, request formats, response formats, authentication, upload behavior, and streaming behavior. |
| [AUTHENTICATION.md](AUTHENTICATION.md) | Registration, login, logout, password reset, session cookies, protected routes, and authorization flow. |
| [AI_ARCHITECTURE.md](AI_ARCHITECTURE.md) | Gemini integration, generation stages, prompt pipeline, validation, fallback behavior, and AI-powered features. |
| [SECURITY.md](SECURITY.md) | Current security controls, secret handling, production checklist, and known security boundaries. |
| [TESTING.md](TESTING.md) | Current verification commands, manual regression areas, and recommended future automation. |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Frontend/backend deployment guidance, required environment variables, production checklist, and common deployment issues. |
| [ENVIRONMENT_SETUP.md](ENVIRONMENT_SETUP.md) | Local setup guide for prerequisites, dependencies, environment configuration, and common setup problems. |
| [APP_FLOW.md](APP_FLOW.md) | User-facing application flows for auth, report generation, report review, AI chat, and account management. |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Practical debugging guide for database, AI, auth, uploads, builds, and deployment. |
| [CHANGELOG.md](CHANGELOG.md) | Documentation and project hygiene change history. |

## Reading Order

For a quick project review:

1. [README.md](../README.md)
2. [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)
3. [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md)
4. [API_DOCUMENTATION.md](API_DOCUMENTATION.md)
5. [DEPLOYMENT.md](DEPLOYMENT.md)

For implementation and maintenance:

1. [TRD.md](TRD.md)
2. [AUTHENTICATION.md](AUTHENTICATION.md)
3. [AI_ARCHITECTURE.md](AI_ARCHITECTURE.md)
4. [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)
5. [TESTING.md](TESTING.md)

## Documentation Rules

- Document only behavior that exists in the repository.
- Keep folder names and commands aligned with the actual repository casing: `Backend`, `Frontend`, and `docs`.
- Use TODO notes for unknown future details instead of guessing.
- Update related docs when routes, environment variables, deployment behavior, or data models change.
