# Strategy Hub Frontend

This directory contains the Next.js frontend for Strategy Hub. It provides the public landing page, authentication screens, protected dashboard, interview report workspace, resume tools, account pages, and AI strategy chat interface.

## Technologies Used

| Area | Technologies |
| --- | --- |
| Framework | Next.js 16, React 19 |
| Styling | Tailwind CSS 4, custom global styles |
| UI | shadcn-style components, Base UI, Lucide React |
| Forms | React Hook Form, Zod |
| Data/API | Axios, Fetch for SSE chat, TanStack Query dependency available |
| Motion | Framer Motion |
| State | React context, local component state, Zustand dependency available |
| Notifications | Sonner |

## Folder Structure

```text
Frontend/
├── README.md
├── package.json
├── next.config.mjs
├── src/
│   ├── app/
│   ├── components/
│   ├── lib/
│   └── providers/
└── public/
```

## Important Folders

| Path | Purpose |
| --- | --- |
| `src/app/` | Next.js App Router pages and layouts. |
| `src/app/dashboard/` | Protected dashboard routes. |
| `src/components/auth/` | Login, register, and password reset UI. |
| `src/components/dashboard/` | Dashboard generation flow, AI output, command palette, and chat widgets. |
| `src/components/resume/` | Resume builder, preview, and ATS score UI. |
| `src/components/shared/` | Shared visual and interaction components. |
| `src/components/ui/` | Reusable UI primitives. |
| `src/lib/api.js` | Backend API client and streaming chat helper. |
| `src/providers/auth-provider.jsx` | Frontend auth state and dashboard redirect behavior. |
| `src/providers/theme-provider.jsx` | Theme provider wrapper. |

## Routing

| Route | Purpose |
| --- | --- |
| `/` | Landing page. |
| `/register` | User registration. |
| `/login` | User login. |
| `/forgot-password` | Password reset request. |
| `/reset-password` | Password reset form. |
| `/dashboard` | Protected dashboard home. |
| `/dashboard/generate` | Interview report generation workspace. |
| `/dashboard/interview/[id]` | Saved report detail and resume builder workspace. |
| `/dashboard/ai-strategy` | AI strategy chat. |
| `/dashboard/resume` | Resume workspace. |
| `/dashboard/profile` | Account profile page. |
| `/dashboard/settings` | Settings page. |

## API Client

The frontend uses `src/lib/api.js` for backend requests.

Default API base URL:

```text
process.env.NEXT_PUBLIC_API_URL || http://localhost:3001
```

Axios is configured with:

```js
withCredentials: true
```

This allows the browser to send the backend `token` HTTP-only cookie with API requests.

## Authentication Flow

The frontend auth provider:

1. Calls `GET /api/auth/get-me` to bootstrap session state.
2. Stores the authenticated user in React context.
3. Uses the backend cookie as the authoritative session.
4. Saves a local session marker for UI bookkeeping.
5. Redirects unauthenticated dashboard users to `/login`.
6. Redirects authenticated users away from `/login` and `/register`.

## State Management

Current state management is mostly local React state and React context:

- `AuthProvider` stores user and loading state.
- Dashboard/report pages store report UI state locally and persist selected report state through backend endpoints.
- AI streaming chat uses fetch, a reader, and component state to append SSE chunks.

## Environment Variables Used

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Browser API base URL used by `src/lib/api.js`. |
| `NEXT_PUBLIC_APP_URL` | Frontend app URL used by backend origin configuration when present. |
| `BACKEND_URL` | Used by `next.config.mjs` rewrite/proxy configuration. |

## Local Development

Install dependencies:

```bash
npm --prefix Frontend install
```

Start the development server:

```bash
npm --prefix Frontend run dev
```

The app normally runs at:

```text
http://localhost:3000
```

Make sure the backend is running at the URL configured by `NEXT_PUBLIC_API_URL`.

## Build Process

Run linting:

```bash
npm --prefix Frontend run lint
```

Build the app:

```bash
npm --prefix Frontend run build
```

Start the built app:

```bash
npm --prefix Frontend run start
```

## Related Documentation

- [Root README](../README.md)
- [Environment Setup](../docs/ENVIRONMENT_SETUP.md)
- [Authentication](../docs/AUTHENTICATION.md)
- [API Documentation](../docs/API_DOCUMENTATION.md)
- [Deployment](../docs/DEPLOYMENT.md)
