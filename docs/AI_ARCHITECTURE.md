# AI Architecture

## Overview

Strategy Hub uses Google Gemini through the `@google/genai` SDK. AI behavior is implemented in backend services under `Backend/src/services/ai-service.js` and `Backend/src/services/gemini/`.

The AI system supports:

- Interview report generation.
- Resume style analysis.
- ATS analysis and resume suggestions.
- Resume builder generation and regeneration.
- Career strategy chat.
- Streaming chat responses.
- Resume PDF rendering from generated resume data.

## Main Service Layers

| Layer | Files | Responsibility |
| --- | --- | --- |
| Public AI service | `Backend/src/services/ai-service.js` | Exposes report, chat, style, and PDF functions to controllers. |
| Gemini client | `Backend/src/services/gemini/gemini-client.js` | Calls Gemini, handles model chain selection, retries, streaming, JSON parsing, and provider errors. |
| Report generator | `Backend/src/services/gemini/report-generator.js` | Builds candidate context, runs generation stages, validates sections, merges final reports. |
| Prompt builder | `Backend/src/services/gemini/prompt-builder.js` | Builds prompts for core report, questions, roadmap, ATS, strategy, and resume builder sections. |
| Response validator | `Backend/src/services/gemini/response-validator.js` | Validates and normalizes generated sections. |
| Context builder | `Backend/src/services/gemini/context-builder.js` | Creates candidate/job context from resume, self-description, job description, and user data. |
| ATS generator | `Backend/src/services/gemini/ats-generator.js` | Normalizes ATS resume data. |
| Resume generator | `Backend/src/services/gemini/resume-generator.js` | Handles resume style analysis and PDF rendering helpers. |

## Model Configuration

The configured model comes from:

```text
GEMINI_MODEL
```

If not provided, the backend falls back to the code default.

The Gemini client also maintains a candidate model chain and can try fallback models when the provider reports model unavailability or related retryable conditions.

Optional model verification:

```text
GEMINI_VERIFY_MODELS=true
```

## Interview Generation Flow

1. Controller validates the request.
2. Resume and optional style resume files are extracted.
3. Resume style is analyzed when style resume text exists.
4. Candidate context is built from resume text, self-description, job description, and user data.
5. Core report stage generates:
   - title
   - job title
   - company
   - match score
   - job analysis
   - skill gaps
   - ATS analysis
   - resume suggestions
   - strategy
6. Parallel stages generate:
   - technical, behavioral, and resume questions
   - roadmap and resume builder data
7. Results are validated and merged.
8. The report is saved to MongoDB or the local fallback store.
9. The API returns the saved interview report.

## Generated Report Sections

The current implementation can generate:

- Job analysis.
- Match score.
- Skill gaps.
- Technical questions.
- Behavioral questions with STAR guidance.
- Resume-specific questions.
- Strategy recommendations.
- Preparation roadmap.
- ATS analysis.
- Resume suggestions.
- Resume builder data.

## Resume Builder Regeneration

Endpoint:

```text
POST /api/interview/:interviewId/resume-builder
```

This regenerates only the resume builder and ATS resume data for an owned report. It uses the saved report inputs and existing analysis.

## Career Strategy Chat

Endpoint:

```text
POST /api/interview/chat
```

The chat service:

- Keeps only valid `user` and `assistant` messages.
- Uses the last 10 messages.
- Trims each message to a bounded length.
- Generates either a JSON reply or streamed Markdown text depending on the request.

For streaming requests, the frontend sends:

```text
Accept: text/event-stream
```

The backend emits SSE events:

- `start`
- `chunk`
- `done`
- `error`

## Error Handling

AI errors are wrapped as structured generation errors with:

- step
- reason
- details
- payload
- status code
- retryability

The Gemini client classifies common provider failures including invalid API keys, permission errors, quota exhaustion, timeouts, unavailable models, and retryable server errors.

## Partial Success Behavior

If resume builder generation fails because of quota or temporary provider availability, report generation can continue with roadmap data and return a warning. The resume builder can be regenerated later.

## Important Boundaries

- Prompts instruct Gemini not to invent employers, degrees, dates, certifications, contact details, or work history.
- Generated output is validated before being merged into the saved report.
- AI output quality depends on user-provided resume/self-description and job description quality.
- The system is not a guarantee of interview or hiring outcomes.
