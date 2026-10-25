# Mello

Mello is an Expo dating app with a separate partner app for cafés, restaurants and activity spaces. The API uses Express, TypeScript, PostgreSQL, Sequelize and Redis.

## Included flows

- Phone OTP signup/login, persistent sessions and profile onboarding.
- Discovery with public profiles, age/gender preferences, likes/passes and mutual matches.
- When fresh suggestions run out, Discover automatically reshuffles previously passed profiles. Already liked profiles and mutual matches remain excluded.
- **Liked you** shows incoming likes with Like back and Pass. Only two explicit likes unlock chat; a single like stays pending.
- Chat is the primary next step after matching: an inbox, real-time text messages over authenticated WebSockets, unread counts, typing indicators, read receipts and saved history. Unsent messages and drafts are saved locally for retries.
- Clearly labelled demo compatibility percentages (the real matching algorithm is intentionally deferred).
- Nearby published venues, date invitations, acceptance/cancellation and partner confirmation.
- Partner business registration, listing drafts/publication, pricing, photos by HTTPS URL, and a date-request inbox.
- Romantic user interface with an animated login, swipe gestures, match celebration, profile details and empty/error states.

## Preview the design without a backend

From frontend/:

    npm ci --legacy-peer-deps
    npm run build:web
    npm run preview

Open http://127.0.0.1:8081/preview. This is an explicitly labelled interactive preview with sample people and fictional venues. Likes, matches and invitations here are local to the current page and reset on reload. Open /auth to view the animated login.

## Start the real product locally

1. Install Node 22.13 or newer and Docker Desktop.
2. Copy backend/.env.example to backend/.env. Replace JWT_SECRET, OTP_HASH_SECRET and PLATFORM_SIGNUP_SECRET with independent random values. Keep development OTP exposure local only.
3. In backend/, run: docker compose up --build
4. PostgreSQL, Redis and the API start together. Migrations and seed catalogs run automatically. The API defaults to port 4000; uploaded photos have a persistent Docker volume.
5. Copy frontend/.env.example to frontend/.env. Leave EXPO_PUBLIC_API_URL empty to detect the Expo computer's LAN host automatically during development. For another API host, an Expo tunnel, or production, set an explicit URL reachable from the device.
6. In frontend/, run npm ci --legacy-peer-deps, then npm start. Use Expo Go on the same Wi-Fi network, or npm run web for the browser.
7. Repeat environment setup and npm ci / npm start in frontend/apps/partner/ to run the separate partner app.

If PostgreSQL and Redis are already installed, run npm ci, npm run db:migrate, npm run db:seed and npm run dev from backend/ instead of Docker.

## Test the complete journey

1. Register two dating accounts with local OTPs, finish their profiles, and choose compatible discovery preferences in the same city. Three photos and three interests are required by default.
2. Each account sees eligible people in Discover. Like each other to create a mutual spark, choose **Say hello**, and exchange messages in **Chats**. Reconnect or reload to check saved history and retry behavior.
3. Register a café, restaurant or activity business in Mello Partner. Enter a headline, location and optional price/image, turn on publication and save.
4. In the dating app, open a conversation and choose **Plan a date**, then select a venue and send a date/time invitation. Meeting plans are optional.
5. Refresh the other user's app and accept the invitation. Refresh the partner inbox and confirm availability. Refresh the user app to see venue confirmation.
6. Either person can cancel the plan. Unmatched users cannot access it, and another venue cannot confirm it.

## Add fictional profiles to the local database

From backend/, run `docker compose exec backend npm run db:seed:demo -- --city Chandigarh` (or `npm run db:seed:demo -- --city Chandigarh` when running the API directly). The city must exist in the catalog; use the same city as your test account.

This creates 22 adult profiles: 10 women, 10 straight men and 2 additional gay men, with completed onboarding and three locally generated illustrated photos each. Names and bios clearly mark them as fictional demo data. Discovery still respects mutual gender and age preferences. Demo profiles do not automatically like anyone. Use two accounts and explicitly like each other to test matching; only a mutual like opens chat. No phone identities are created and no SMS is sent. The command is safe to rerun and refuses production mode. Photos use the persistent uploads volume alongside user uploads.

## Checks

    cd backend
    npm test
    npm run build

    cd ../frontend
    npm run typecheck
    npm run build:web

    cd apps/partner
    npm run typecheck

The integration tests use an isolated embedded PostgreSQL instance and test accounts, not your configured database. They require permission to bind local sockets. API details are in backend/docs/discovery-and-dates-api.md. Chat architecture and event contracts are in [backend/docs/chat.md](backend/docs/chat.md).

## Before a public launch

For real SMS, set OTP_DELIVERY_MODE=twilio and configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_MESSAGING_SERVICE_SID (or TWILIO_FROM_NUMBER) in backend/.env. Set OTP_EXPOSE_IN_RESPONSE=false in production. The Twilio adapter has mocked contract tests; actual carrier delivery requires your configured provider account and sender. Console delivery remains available for local development. Compatibility scores are UI demonstrations, not a validated matching algorithm. Date plans use manual partner confirmation; payments, chat attachments, push notifications, inventory/capacity, moderation and identity verification are not included in this milestone. Preview photos use remote sample imagery; real profiles use the user's uploaded photos. Physical Android/iOS testing and production PostgreSQL concurrency checks remain necessary.
