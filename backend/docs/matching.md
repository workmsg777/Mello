# Discovery, matching, and chat

This guide covers discovery eligibility, ranking, likes and passes, mutual matches, chat, real-time updates, and notifications. Discovery uses the existing identity, profile, onboarding, consent, partner listing, and date-planning APIs.

## Layers

```text
routes/discovery.routes.ts → controllers/discovery.controller.ts
  → DiscoveryService → DiscoveryRepository / matching repository
  → MatchingService → scoring functions / MatchingAiClient
  → DatingStateService (existing public preview)
  → NotificationService (existing transactional outbox)

routes/chat.routes.ts → controllers/chat.controller.ts
  → ChatService → ChatRepository
  → DiscoveryService.assertMatch / MatchingAiClient / NotificationService

ai/api/matching.py → api/controllers/matching.py
  → ai/services/matching.py → ai/repositories/embedding_repository.py
  → ai/embeddings/provider.py
```

Validators live in `utils/queryValidators/discoveryQueryValidator.ts`. Routes register paths/middleware; controllers validate HTTP inputs and serialize service results. Realtime message events publish after the business transaction commits. Services coordinate business rules and service-to-service calls. SQL belongs in repositories. The older partner/date methods co-located in DiscoveryService are outside this feature refactor.

The Python folder layout references `BE_Work/ai-bot/backend` only for package organization. No recruitment concepts, prompts, orchestration graph or credentials were copied.

## Eligibility and consent

People in discovery must be active adults with completed onboarding and enough approved, publicly displayable photos on both sides. Uploaded photos start pending. An operator can inspect the review queue with `npm run photos:review -- list` and record an individual review with `npm run photos:review -- approve <photo-id>` or `reject <photo-id>` from the backend directory. Pending and rejected photos stay available to their owner in the editor. Strict distance uses city centres with a same-city fallback when coordinates are missing. Verified-only remains unavailable until identity verification exists.

For browser review, open `/photo-review` in the Mello frontend and sign in with an existing platform account assigned `ADMIN` or `SUPERADMIN`. The queue provides authenticated previews of pending photos stored by the local backend. Decisions are recorded with the reviewer account and timestamp. When a worker or another reviewer decides a photo first, refresh the queue for the latest state.

### Automated photo review and the selfie experiment

Run `python ai/scripts/download_photo_models.py` from the repository root to provision the checksummed model. For Compose, set `PHOTO_MODERATION_MODE=shadow` in `backend/.env` and run `docker compose up --build` from `backend/`. Compose applies the photo queue migration, mounts the model read-only, and installs the optional CPU runtime. For a standalone Python service, install `ai/requirements-photo-moderation.txt` along with the API requirements, set the same mode in both processes, and use the existing `MATCHING_AI_URL` and `MATCHING_AI_KEY` settings in the backend.

- `off` preserves the manual queue. `shadow` scores pending photos and records the model result without changing approval. Review representative ordinary and policy-violating photos, compare the saved predictions with operator decisions, and measure false approvals and queue volume before enabling automation.
- `auto` requires an explicit `PHOTO_MODERATION_APPROVE_MAX_RISK` in the range `[0, 0.5)`. Only photos at or below that threshold become approved. The model measures explicit-content risk. The operator queue handles flagged items, unsupported images, and other policy concerns. After repeated service failures, a pending photo can be requeued with `npm run photos:review -- retry <photo-id>`. The list command includes the file on the backend host, its latest score, and the retry count.
- The photo file route checks approval and public photo visibility on each request. The editor uses an authenticated owner-only route for uploaded photos. Protect the upload directory itself when configuring a reverse proxy.
- The selfie exercise runs locally across eight sampled video frames and reports YuNet face detection coverage, SFace similarity, and MiniFASNet passive liveness scores. It stores no comparison media or biometrics and issues no badge. Use a clear reference photo and a 1–15 second clip from a consenting tester. Compare scores on genuine captures, different participants, and consented print and screen replays before deciding whether to develop an in-app version.

```powershell
python -m pip install -r ai/requirements-selfie-experiment.txt
python ai/scripts/download_photo_models.py --with-selfie-test
$env:SELFIE_VERIFICATION_TEST_ENABLED = 'true'
python ai/scripts/test_selfie.py --profile profile.jpg --video selfie.mp4
```

The photo classifier is the [Apache-2.0 Marqo model](https://huggingface.co/Marqo/nsfw-image-detection-384), using the [published ONNX conversion](https://huggingface.co/KanariKanaru/nsfw-image-detection-384-onnx). The experiment uses [YuNet (MIT)](https://github.com/opencv/opencv_zoo/blob/main/models/face_detection_yunet/LICENSE), [SFace (Apache-2.0)](https://github.com/opencv/opencv_zoo/blob/main/models/face_recognition_sface/LICENSE), and [MiniFASNet (Apache-2.0 project)](https://github.com/minivision-ai/Silent-Face-Anti-Spoofing) with its [ONNX export](https://github.com/yakhyo/face-anti-spoofing). Model checksums are enforced at load time.

Language dealbreakers are OR alternatives: at least one required acceptable language must be reported by the other person. Partner-value dealbreakers are AND requirements: every required value must be explicitly reported. Both directions are checked. Missing required answers exclude candidates. These explicit dealbreakers remain active independently of optional ranking consent.

Real scores require **both** users' latest `PERSONALIZED_MATCHING` event to be `GRANTED` for the current `CONSENT_POLICY_VERSION`. This reads the audit history, not the existence of any historical grant. A revocation or newer event for another policy disables personalization. Discovery includes an optional opt-in/off control using the existing consent API.

Soft ranking excludes sensitive option categories. Non-sensitive option answers require matching or public visibility. The public card honors field visibility, excludes pending or rejected text, and only shows approved photos. Public reasons can name a shared interest, language, or dating goal when both people allow public display. A user can permanently hide another person from a discovery card, incoming like, or matched profile. `PUT /api/discovery/exclusions/:targetId` accepts an optional `reportReason` of `SPAM`, `IMPERSONATION`, `HARASSMENT`, or `OTHER_SAFETY`. A report is recorded in `discovery_exclusions` with `reported_at` for operator review. Reporting and hiding are idempotent. Hiding excludes the pair in both directions, including chat and date-plan access.

## Dating goals and existing profiles

The dating-intentions screen separately captures personal goals, acceptable partner goals, visibility, and whether the preference is open, preferred, or essential. The profile-options API saves these choices in one transaction. Older clients can keep sending selections alone. Missing visibility for an existing intention is backfilled as `MATCHING_ONLY` and explicit privacy choices are preserved. Family plans can be an explicit requirement. Relationship style and supported lifestyle choices can be soft preferences or requirements.

Apply `20261121000100-reciprocal-matching.js` through the backend migration process before deploying this code. Count approved photos and staff the photo review queue before rollout. Monitor two-way conversations, voluntary feedback, hides, reports, and the distribution of exposure from recorded fresh sessions.

## Algorithm v2

The directional weights are intentions 25, desired partner values 25, interests 20, other soft options 10, languages 10, distance 5 and soft age 5. Values use the weighted fraction satisfied. Acceptable alternatives use the best satisfied priority divided by the strongest stated priority. A common language or accepted goal can satisfy its category. Interests use Jaccard similarity. Unknown answers contribute no weight.

The lower directional score determines pair alignment. Ordering shrinks the score toward 50 using the smaller directional evidence coverage. Ordering uses personalization from 20% coverage. A numerical card score requires at least 40% coverage and two substantive categories in each direction. Public shared facts can appear with less evidence. These thresholds and weights require evaluation on real introductions.

Fresh discovery scores the eligible pool before selecting the first page. The optional hybrid model blends 80% rules and 20% semantic similarity within the top 64 rule positions. Only comparable, successfully scored candidates exchange positions. Missing text, AI fallback, sparse evidence and a known conflict in stated goals preserve the rule position. Rule-only requests omit biography and prompt text from the scoring projection.

`MATCHING_MODE` defaults to `RULES`. For an experiment, choose `HYBRID` with `MATCHING_ROLLOUT_CONTROL=RULES` and set `MATCHING_ROLLOUT_PERCENT` to the percentage assigned to hybrid. Without that control setting the existing baseline holdout remains available. Assignment uses stable viewer buckets. Each introduction involves two people, so experimental groups may interact.

## Stable paging and impressions

`GET /api/discovery/feed` returns `feedSessionId` and `nextRankCursor` for fresh results. Continue with `?feedSessionId=...&cursor=...`. Do not combine this with shuffle/offset parameters. Sessions are owner-bound and expire in 15 minutes. A missing/expired/foreign session returns 404; the app restarts the feed. `nextOffset` remains for older clients, but snapshots are the recommended mutation-safe paging contract.

Snapshots store IDs, positions and scorer versions. Each continuation rechecks eligibility and current consent, then computes display evidence for the requested page. The original hybrid shortlist bounds semantic reevaluation. Already answered and hidden profiles are skipped. Session items record the last scorer used for delivery, and impressions copy that version when reported. Historical rows without a recorded scorer are marked unknown in reporting.

Previously passed profiles retain seeded recycled rounds and original shuffle cursors. Fresh profiles take priority when starting a request without a ranked session. Likes and mutual matches are never recycled.

`POST /api/discovery/impressions` accepts `{feedSessionId,targetIds:[...]}` (1–20). It validates session ownership/membership and deduplicates per session/target. The app reports the front card after 700 uninterrupted ms on the loaded Discover tab while the app/browser is in the foreground; returning from the background restarts that interval. Fetched cards are not automatically counted. These are client-reported exposures, not proof of human attention or measured viewport intersection. Recycled impressions are not currently attributed to ranked sessions. Snapshot/impression retention is 30 days, with opportunistic owner cleanup; schedule a global cleanup using the expiry/created indexes for users who never return.

## AI deployment

Run `docker compose up --build` from `backend/`. Node and FastAPI run in the same container and communicate over loopback. The container generates a shared key at startup when `MATCHING_AI_KEY` is blank. To supply a key in `backend/.env`, use an independent random value of at least 32 characters. Keep it out of `EXPO_PUBLIC_*` variables. See `ai/README.md` for standalone Python development.

The default `RULES` mode starts FastAPI with icebreaker assistance available. To enable semantic ranking, set `MATCHING_MODE=HYBRID` and `AI_EMBEDDINGS_ENABLED=true` in `backend/.env`, then rebuild with `docker compose up --build`. Compose pins `AI_MODEL_REVISION` and uses a persistent model-cache volume. Set `AI_MODEL_LOCAL_ONLY=false` to download the model on first startup, then restore local-only operation once the cache is populated. Model startup failure leaves assist and health operational and returns 503 for semantics, allowing Node to fall back. Node's timeout defaults to 2000 ms and accepts 100–10000 via `MATCHING_AI_TIMEOUT_MS`.

The AI service is deliberately stateless: no raw profile text or embeddings persist across requests. It deduplicates input within each batch, loads one model per process, and bounds concurrent model execution. There is no background embedding queue, pgvector index, learned behavior model or LLM text generator in v1. Those require separate retention/consent lifecycle and measured scale justification; this implementation does not claim them.

## Conversation assistance

`POST /api/chat/:matchId/icebreakers` requires an authorized, explicit mutual match. Shared active interest labels provide grounded optional drafts; no chat history is sent to AI. An unavailable assist service uses local templates. There is no automatic send, draft overwrite or chat-message insertion. Existing WebSocket unread/read/typing, retries, message idempotency and transactional notification delivery are preserved.

## Validation and measurement

```text
backend/: npm test
backend/: npm run build
backend/: npm run test:postgres
frontend/: npx tsc --noEmit -p tsconfig.dating.json
frontend/: npm run build:web
ai/: python -m unittest discover -s tests -v
```

Integration tests apply all migrations to an isolated embedded PostgreSQL database, never the configured development database. They cover actual ranked APIs, consent revocation, sparse evidence, full-pool ordering, cursor behavior after actions/edits, session ownership/expiry, exposure deduplication, reciprocal language/value filters, private projections, match-only assistance, existing HTTP/WebSocket chat and partner/date regression flows. Python tests inject a deterministic test encoder; passing them does **not** validate real multilingual model quality.

`test:postgres` is a separate opt-in verification using installed PostgreSQL executables (`PG_BIN`, default Windows PostgreSQL 18 path). It creates a new private cluster and random localhost port, ignores the configured DATABASE_URL, runs real simultaneous reciprocal likes/message sends and retries, verifies outbox deduplication/read monotonicity/rollback, stops its own server and deletes only its checked temporary directory. This verification passed locally on PostgreSQL 18. It does not use Docker or an existing database.

Use `database/reports/discovery-quality.sql` to track the share of first-exposed pairs that exchange messages in both directions within seven days of exposure. Count a pair once across variants and compare assigned treatments with the actual delivered scorer. The report also counts mutual matches, exclusions, reported pairs and private optional feedback submitted through `PUT /api/discovery/matches/:matchId/feedback` with a boolean `worthwhile`. Read voluntary responses alongside response counts. `database/reports/discovery-exposure.sql` measures zero exposure among people eligible for at least one recorded fresh session. Measure real load, outcome quality and exposure distribution before expanding rollout.

## Historical v1 verification results

- 48 backend tests passed, including existing HTTP/WebSocket chat and partner/date flows.
- 8 Python API/domain tests passed.
- Backend build, dating-only frontend typecheck, web export and Compose configuration validation passed.
- Real PostgreSQL 18 concurrency/rollback verification passed using the disposable cluster script.
- Pinned real model `e8f8c211226b894fcb81acc59f3b34ba3efd5f42` passed three fictional-text semantic API smoke cases: English 0.6107 related vs 0.3295 unrelated; Hindi–English 0.7637 vs 0.3291; Hinglish 0.3320 vs 0.1033. The three small API requests took 75–102 ms locally after model loading. These are smoke observations, not production latency guarantees or a dating-quality benchmark.
- The opposite-preference children example still had semantic similarity 0.6097, demonstrating why structured dealbreakers remain authoritative.
- The combined frontend typecheck includes an existing partner-app `TextInputInstance` error in `apps/partner/src/screens/PartnerAuthScreen.tsx`; the dating-only config checks the dating app independently.

The application database migration has not been applied to an existing development/production database. Apply it through the normal deployment migration flow. Weights and outcome quality still require representative data and controlled evaluation; no superiority over other dating apps is asserted.
