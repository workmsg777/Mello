# Mello Partner app

Admins register their café, select a supported city (state fills automatically), and add employees in **Your team** as **Partner support**. Employees choose **Partner login**, verify their own OTP, then manage **Menus & experiences** for that café. Admins can disable employee access and revoke sessions. Menus, photo galleries, plans, packages and events support drafts/publication. See [the partner team guide](../../../backend/docs/partner-team-and-content.md) for permissions and APIs.

For a standalone partner APK, follow [the Android build guide](../../../docs/android-builds.md). Run `npm run build:apk` from this directory after linking its own EAS project and configuring the API URL.

Uses Expo SDK 58, matching the dating app. Use Expo Go for SDK 58. After upgrading, stop the old Metro server and restart with `npx expo start --clear`.

This is a separate Expo application from the dating-user app at `frontend/`.
It has its own Android/iOS identifiers, environment configuration, dependencies,
and authentication-session storage. It supports Android, iOS and the browser.

## Start in the browser

```powershell
cd C:\Users\sahil\Desktop\Mello\frontend\apps\partner
npm ci --legacy-peer-deps
npm run web
```

Open http://localhost:8082. Partner uses port 8082 so it can run alongside the dating app on port 8081. If its Metro server is already running, open that URL or press `w` in its terminal instead of starting a second server. The API must be running on port 4000 for OTP, listings and date requests.

To validate a production web bundle, run `npm run typecheck` and `npm run build:web`. Serve the generated `web-build/` folder over HTTP rather than opening its HTML directly. Set `EXPO_PUBLIC_API_URL` before building when deploying against a remote API.

## Start on Android

```powershell
cd C:\Users\sahil\Desktop\Mello\frontend\apps\partner
npm install
npm start
```

Install Expo Go on the Android phone and scan the QR code. The computer and
phone should be on the same Wi-Fi network.

The local API uses the Expo computer's LAN address automatically during development. Copy `.env.example` to `.env` and leave this value empty when the backend runs on that computer at port `4000`:

```env
EXPO_PUBLIC_API_URL=
```

For a separate API host, an Expo tunnel, or production, set an explicit reachable API URL. Restart Expo after changing Wi-Fi networks. Start the backend, PostgreSQL, and Redis before testing.

For local OTP testing, use these backend settings and restart the backend:

```env
OTP_DELIVERY_MODE=console
OTP_EXPOSE_IN_RESPONSE=true
```

Never expose the OTP in API responses in production.

## Signup test

1. Select **Register business**.
2. Enter the owner and business details.
3. Enter a new mobile number and request an OTP.
4. Enter the OTP from the app's local-test box or backend terminal.
5. Verify that the partner workspace confirmation shows the business and owner role.

## Login test

1. Sign out and select **Partner login**.
2. Enter the registered partner mobile number.
3. Request and verify the OTP.

Dating-user and platform-user accounts are rejected by this app after verification.

The header bell receives live date requests and cancellations for partner admins. Tapping an update opens Requests. See [notification setup](../../../backend/docs/notifications.md) to enable phone push in an installed build.
