# Dating profile and onboarding API

All endpoints below are under `/api/dating` and require a dating-user bearer token.
Load `GET /catalog` and `GET /state` after authentication. Catalog IDs are the only supported IDs for profile choices; the server remains the source of truth for progress and validation.

## Read endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/catalog` | Versioned options, rules, consents, and onboarding steps |
| GET | `/cities?search=&limit=` | Active city search |
| GET | `/state` | Complete private editing and resume state |
| GET | `/preview` | Explicitly privacy-filtered public profile preview |
| GET | `/photos` | Ordered profile photos |

## Profile mutations

`PUT` routes are available for `/profile`, `/profile-options/:categoryId`, `/visibility/:fieldCode`, `/match-preferences`, `/option-preferences/:categoryId`, `/interests`, `/languages`, `/language-preferences`, `/values`, `/partner-value-preferences`, `/prompt-answers/:promptId`, and `/personality/:frameworkId`. Prompt answers and personality results also support `DELETE` on their item routes.

## Photos

- `POST /photos` accepts `multipart/form-data` with a `photo` field (JPEG, PNG, or WebP; maximum 10 MB).
- `PUT /photos/order` accepts every live photo ID plus `primaryPhotoId`.
- `DELETE /photos/:id` soft-deletes a profile-photo mapping.
- Local development files are served from `/uploads/profile-photos/...`; replace the media service with object storage for production.

## Onboarding and consent

| Method | Path | Body |
| --- | --- | --- |
| POST | `/onboarding/start` | `{ onboardingVersion, firstStepId }` |
| POST | `/onboarding/steps/:stepId` | `{ onboardingVersion, status: "COMPLETED" \| "SKIPPED" }` |
| POST | `/onboarding/complete` | `{ onboardingVersion }` |
| POST | `/consents` | `{ consentCode, policyVersion, status }` |

Completion is enforced server-side. It requires an adult profile with a city, all required catalog categories, discovery preferences, the configured photo and interest minimums, current required consents, and every required onboarding step.
