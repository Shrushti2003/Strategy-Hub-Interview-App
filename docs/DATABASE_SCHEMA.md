# Database Schema

## Overview

Strategy Hub uses MongoDB through Mongoose for persistent data. The backend also includes a local JSON fallback store for development resilience when MongoDB is unavailable.

Primary models:

- `User`
- `InterviewReport`

## User

Collection model: `User`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `_id` | ObjectId | Yes | Primary identifier. |
| `username` | String | Yes | Unique, trimmed. |
| `email` | String | Yes | Unique, lowercase, trimmed. |
| `password` | String | Yes | bcrypt hash. |
| `passwordChangedAt` | Date | No | Used to invalidate older JWTs. |
| `passwordResetTokenHash` | String | No | SHA-256 reset token hash; hidden by default. |
| `passwordResetExpiresAt` | Date | No | Reset token expiration; hidden by default. |
| `passwordResetRequestedAt` | Date | No | Used for reset request throttling; hidden by default. |
| `createdAt` | Date | Yes | Mongoose timestamp. |
| `updatedAt` | Date | Yes | Mongoose timestamp. |

## InterviewReport

Collection model: `InterviewReport`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `_id` | ObjectId | Yes | Primary identifier. |
| `title` | String | Yes | Generated report title. |
| `jobTitle` | String | No | Generated or extracted job title. |
| `company` | String | No | Generated or extracted company name when available. |
| `user` | ObjectId | Yes | Owner reference to `User`. |
| `jobDescription` | String | Yes | Submitted job description. |
| `jobAnalysis` | Object | No | Generated job analysis. |
| `selfDescription` | String | No | Submitted candidate self-description. |
| `resume` | String | No | Extracted resume text. |
| `styleResumeText` | String | No | Extracted optional style resume text. |
| `resumeStyleProfile` | Object | No | Optional style analysis. |
| `atsResumeData` | Object | No | Normalized ATS/resume builder data. |
| `matchScore` | Number | Yes | Generated match score. |
| `technicalQuestions` | Question[] | No | Generated technical questions. |
| `behavioralQuestions` | Question[] | No | Generated behavioral questions. |
| `resumeQuestions` | Question[] | No | Generated resume-specific questions. |
| `skillGaps` | SkillGap[] | No | Generated skill gaps. |
| `preparationPlan` | PreparationDay[] | No | Generated preparation plan. |
| `roadmap` | PreparationDay[] | No | Generated roadmap. |
| `strategy` | Object | No | Generated strategy content. |
| `atsAnalysis` | Object | No | Generated ATS analysis. |
| `resumeBuilder` | Object | No | Generated resume builder data. |
| `resumeSuggestions` | String[] | No | Generated resume suggestions. |
| `questionState` | Map | No | Completion and bookmark state by question key. |
| `dashboardState` | Object | No | Active section, search, difficulty, status, and sort state. |
| `createdAt` | Date | Yes | Mongoose timestamp. |
| `updatedAt` | Date | Yes | Mongoose timestamp. |

## Embedded Question

| Field | Type | Notes |
| --- | --- | --- |
| `question` | String | Required. |
| `intention` | String | Optional. |
| `answer` | String | Required. |
| `explanation` | String | Optional. |
| `difficulty` | String | `beginner`, `intermediate`, or `advanced`. |
| `followUps` | String[] | Optional follow-up questions. |
| `category` | String | Optional. |
| `whyInterviewerAsks` | String | Optional coaching explanation. |
| `bestPractices` | String[] | Optional answer guidance. |
| `commonMistakes` | String[] | Optional mistakes/red flags. |
| `recruiterTips` | String[] | Optional recruiter guidance. |
| `relevantSkills` | String[] | Optional evaluated skills. |
| `evaluation` | String[] | Optional scoring guidance. |
| `star` | Object | Behavioral STAR fields: situation, task, action, result. |

## Embedded SkillGap

| Field | Type | Notes |
| --- | --- | --- |
| `skill` | String | Required skill name. |
| `severity` | String | `low`, `medium`, or `high`. |

## Embedded PreparationDay

| Field | Type | Notes |
| --- | --- | --- |
| `day` | Number | Required day number. |
| `focus` | String | Required focus area. |
| `tasks` | String[] | Required task list. |

## Ownership Rules

Interview report reads, updates, exports, and deletes are scoped by both report id and authenticated user id. Account deletion also deletes reports owned by that user.
