# Build two separate Android apps

| App | Project directory | Android package |
| --- | --- | --- |
| Mello dating app | `C:\Users\sahil\Desktop\Mello\frontend` | `com.mello.app` |
| Mello Partner | `C:\Users\sahil\Desktop\Mello\frontend\apps\partner` | `com.mello.partner` |

Both apps use the same backend but have separate Expo projects, sessions, package IDs and build artifacts. Run EAS commands in the correct app directory. Do not copy an `extra.eas.projectId` from one app to the other.

Each project now has `eas.json` with `preview` for a directly installable APK and `production` for a Google Play AAB. These are standalone release builds and do not require Expo Go or Metro.

## 1. Make the backend reachable

Deploy the backend with HTTPS, or use an HTTPS tunnel to the local API for a temporary test. Replace `https://YOUR-BACKEND-DOMAIN/api` in the commands below with the real URL. The endpoint must include `/api`. The dating app's reverse proxy/tunnel must also support WebSockets at `/socket.io/` on the same origin. An Expo Metro tunnel alone does not expose your backend.

Both apps need PostgreSQL, Redis and the API to remain running. Uploaded profile images must be available at the backend's `/uploads/profile-photos/` path. Neither APK contains the backend, database or image store. A temporary tunnel stops working when closed; a changed hostname requires updating the build environment and rebuilding.

Do not use `localhost` or leave the API URL blank for an installed APK. The dynamic Expo config rejects EAS cloud builds without a HTTPS API URL ending in `/api`. `EXPO_PUBLIC_API_URL` is public application configuration; never put database passwords, JWT secrets or SMS credentials in it or other `EXPO_PUBLIC_*` variables.

## 2. Login to Expo (once)

Create an Expo account at https://expo.dev/signup if needed, then run:

```powershell
npx eas-cli@latest login
```

## 3. Link and build Mello

```powershell
cd C:\Users\sahil\Desktop\Mello\frontend
npm ci --legacy-peer-deps
npx eas-cli@latest init
npx eas-cli@latest env:set --name EXPO_PUBLIC_API_URL --value "https://YOUR-BACKEND-DOMAIN/api" --environment preview --visibility plaintext
npm run build:apk
```

During initialization, create/select the EAS project for **mello**. If the CLI asks to add the project ID to the dynamic config, add `extra.eas.projectId` to this app's `app.json` (merging any existing `extra` object). The `app.config.js` function preserves `app.json` values. Use the actual project ID returned by EAS.

For a new Android app, allow EAS to generate a new Android keystore when asked. If updating an already distributed app, reuse its original keystore. Keep access to the Expo account and signing credentials so future updates remain installable.

## 4. Link and build Mello Partner

```powershell
cd C:\Users\sahil\Desktop\Mello\frontend\apps\partner
npm ci --legacy-peer-deps
npx eas-cli@latest init
npx eas-cli@latest env:set --name EXPO_PUBLIC_API_URL --value "https://YOUR-BACKEND-DOMAIN/api" --environment preview --visibility plaintext
npm run build:apk
```

Create/select a **separate mello-partner EAS project**. Keep its project ID in `frontend/apps/partner/app.json`, using the same dynamic-config instructions above. Configure the API variable here too: project-scoped EAS variables are not shared automatically with the dating app.

## 5. Download and install

Each build command returns an Expo build-page link. Wait for that build to finish, then download its APK from that page. Transfer/open each APK on the Android phone and complete Android's installation prompts. The phone shows **Mello** and **Mello Partner** as separate installed applications.

Verify signup/login in each app, uploaded images, mutual matching and WebSocket chat in Mello, and listing/date-request actions in Mello Partner. APK compilation and device tests are separate from a JavaScript/Hermes bundle export.

## Google Play later

From each app directory, set the API URL for the `production` EAS environment, then build an AAB:

```powershell
npx eas-cli@latest env:set --name EXPO_PUBLIC_API_URL --value "https://YOUR-BACKEND-DOMAIN/api" --environment production --visibility plaintext
npm run build:aab
```

This produces a separate `.aab` per app for its own Play Console listing. An AAB is not the file to directly install on a phone. Publishing, Play Console setup, production backend hosting and store approval are separate steps.

## References

- https://docs.expo.dev/build-reference/apk/
- https://docs.expo.dev/build-reference/build-with-monorepos/
- https://docs.expo.dev/eas/environment-variables/
