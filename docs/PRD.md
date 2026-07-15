# Product Requirements Document

## Product Summary

Strategy Hub helps job seekers convert job descriptions, resumes, and self-descriptions into actionable interview preparation, resume optimization, ATS-focused resume builder output, and career strategy guidance.

## Target Users

- Candidates preparing for interviews.
- Professionals improving resume clarity and ATS alignment.
- Users who want a saved workspace for interview reports, resume drafts, and career strategy chat.
- Recruiters or hiring reviewers evaluating the project as a full-stack AI portfolio application.

## Goals

- Generate personalized interview reports from real user inputs.
- Provide ATS-oriented resume builder output.
- Save interview reports for later review.
- Let users track question completion and bookmarks.
- Support secure account management and password recovery.
- Offer a responsive, polished dashboard experience.
- Keep documentation accurate enough for GitHub and portfolio review.

## Non-Goals

- Replacing human career counseling.
- Guaranteeing employment outcomes.
- Storing source-control secrets.
- Providing a public multi-tenant admin console.
- Documenting features that do not exist in the implementation.

## Primary User Flows

1. A visitor opens the landing page.
2. The visitor registers or signs in.
3. The user enters a job description.
4. The user provides either a resume upload or a self-description.
5. The backend extracts resume text when a file is uploaded.
6. Gemini services generate a report.
7. The report is saved for the authenticated user.
8. The user reviews questions, skill gaps, strategy, roadmap, ATS guidance, and resume builder output.
9. The user bookmarks questions, marks progress, persists filters, exports report data, or downloads PDFs.
10. The user can use AI Strategy chat for career guidance.
11. The user can update profile/settings, change password, request password reset, sign out, or delete the account.

## Functional Requirements

Authentication:

- Register.
- Login.
- Logout.
- Session bootstrap.
- Password reset.
- Account update.
- Password change.
- Account deletion.

Interview reports:

- Generate reports from job description plus resume or self-description.
- Accept PDF, DOCX, and TXT text extraction paths.
- Save generated reports by user.
- List saved report summaries.
- Retrieve one owned report.
- Delete one owned report.
- Export JSON and Markdown.
- Persist question completion/bookmark state.
- Persist dashboard filter state.

AI and resume:

- Generate job analysis, match score, skill gaps, questions, strategy, roadmap, ATS analysis, resume suggestions, and resume builder data.
- Regenerate resume builder data for saved reports.
- Export resume PDF.
- Support career chat with non-streaming and streaming responses.

## Quality Requirements

- Clear validation errors.
- No committed secrets.
- Owner-scoped data access.
- Stable frontend build.
- Consistent route documentation.
- Safe handling of Gemini quota/configuration failures.
- Documentation kept in sync with routes, models, environment variables, and deployment behavior.

## Open TODOs

- TODO: Add screenshots or demo links after a verified deployment exists.
- TODO: Add automated test coverage and CI documentation when implemented.
- TODO: Add contributor-facing governance docs if the repository becomes open source.
