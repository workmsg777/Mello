# Discovery, partners and date planning

All endpoints require a bearer token tied to an active account and an unrevoked session.

## Dating users

Prefix: `/api/discovery`. Only dating users with a completed, active profile can enter.

| Method | Path                              | Behaviour                                                                                                                      |
| ------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| GET    | `/feed?limit=10&offset=0`         | Fresh public profiles first; once exhausted, shuffled previously passed profiles. Already liked profiles and mutual matches stay excluded. |
| POST   | `/actions`                        | `{ targetId, action: "LIKE" or "PASS" }`; reciprocal likes return `{ matched: true, matchId }`.                                |
| GET    | `/matches`                        | Mutual matches, newest first, with public profiles.                                                                            |
| GET    | `/venues?kind=CAFE`               | Published, active venues in the user's selected city and country. Kind is optional: CAFE, RESTAURANT, ACTIVITY.                |
| GET    | `/matches/:matchId/plans`         | Date plans visible only to the two matched users.                                                                              |
| POST   | `/matches/:matchId/plans`         | `{ partnerId, proposedAt, note? }`. ISO 8601 timestamp with timezone; at least 15 minutes ahead, within 180 days.              |
| PATCH  | `/matches/:matchId/plans/:planId` | `{ status: "ACCEPTED", "DECLINED", or "CANCELLED" }`. Only the invited person can accept or decline. Either person can cancel. |

Discovery checks both people's age and gender preferences and option dealbreakers. Distance restrictions use city-centre coordinates; without coordinates a strict distance restriction falls back to the same city. There is no identity verification system yet: a `verifiedProfilesOnly` restriction therefore returns no unverified candidates. Profiles without the configured minimum number of photos are excluded.

Discovery returns `feedMode: "FRESH" | "RECYCLED"`, `shuffleSeed`, `nextCursor` and `nextOffset` alongside `profiles`. The app automatically fetches another batch after the last card is answered, using offset zero for fresh profiles so removed decisions do not cause skips. In recycled mode, pass the returned `shuffleSeed` and `after=nextCursor` to continue a shuffled round without repeats. When `nextCursor` is null, omit the cycle parameters to begin a new shuffled round. Fresh profiles always take priority, including during a recycled round. Existing age, gender, distance and account eligibility checks apply to both modes. A previous PASS may become a LIKE; an existing LIKE cannot be changed to a PASS through this endpoint. Chat still requires two explicit likes.

Compatibility is deliberately illustrative. The response includes `compatibility: { percentage, isDemo: true, label: "Demo compatibility" }`. A stable symmetric placeholder lives in `src/services/discovery.rules.ts`; it is not used for ranking, eligibility or personal-data inference. Replace this boundary when the actual algorithm is approved.

Ordered user-row locks and a unique canonical pair prevent duplicate matches during reciprocal likes. Profile DTOs omit birthdays, contact information, consents and private preferences. Sensitive option answers appear only when marked `PROFILE`.

## Partners

Prefix: `/api/partner`. A partner token can access only its own workspace.

| Method | Path            | Behaviour                                                                                      |
| ------ | --------------- | ---------------------------------------------------------------------------------------------- |
| GET    | `/workspace`    | Business details, listing and staff role.                                                      |
| PUT    | `/listing`      | Owners/managers save and publish their own venue. Staff cannot edit.                           |
| GET    | `/requests`     | Accepted or cancelled date requests for this venue; no dating-profile or phone data.           |
| PATCH  | `/requests/:id` | `{ status: "CONFIRMED" or "DECLINED" }` for a pending, accepted, future request at this venue. |

Listing fields: `name`, `description`, `address`, `city`, `state`, `postalCode`, `kind`, `headline`, nullable HTTPS `imageUrl`, nullable integer `priceForTwoInr`, `durationMinutes` (15–1440), up to six `tags`, `isPublished`, and nullable `latitude`/`longitude` (supply both or neither).

Listings begin unpublished. City matching is case-insensitive; use the catalog's city spelling. Distances shown in the user app are approximate distances from the selected city's centre, not live GPS distances.

## Date lifecycle

1. One matched person proposes a published venue and time.
2. The other person accepts or declines. The proposer cannot accept their own invitation.
3. Accepted plans appear in the partner inbox.
4. The venue confirms availability or declines.
5. Either matched person can cancel; cancelled or terminal invitations cannot be accepted again.

A plan is a reservation request until both people agree and the venue confirms. This MVP does not collect payments, guarantee capacity, send push/SMS notifications, or implement venue hours and inventory. Refresh the app to see the latest responses.

## Validation

Run `npm test` from `backend/`. The integration suite creates a disposable embedded PostgreSQL database, applies all migrations and seeds, creates test sessions, completes onboarding through the API, and exercises discovery, privacy, matching, partner ownership, date transitions, revocation and photo replacement. It does not require Redis or alter the development database. Embedded PostgreSQL DDL runs in autocommit because its single underlying session cannot support Sequelize's separate-connection enum refresh inside a DDL transaction; application transactions use Sequelize normally. Validate simultaneous-write behaviour against ordinary PostgreSQL before production.
