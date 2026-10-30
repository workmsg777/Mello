# Mello mobile frontend

For separately installable Mello and Mello Partner APKs, follow [the Android build guide](../docs/android-builds.md). Each app has its own `eas.json`, `build:apk` and `build:aab` commands.

Expo mobile client for dating-user authentication and restart-safe profile onboarding. It uses Expo Router, Redux Toolkit, Axios, SecureStore, and ImagePicker; the backend catalog and state endpoints are the source of truth.

The mobile apps use Expo SDK 58. Use the SDK 58 version of Expo Go. After an SDK upgrade, stop the old Metro server and run `npx expo start --clear` before scanning the new QR code.

This root Expo project is exclusively the dating-user app. The separately
installable partner application is located at [`apps/partner`](./apps/partner).

## Run on an Android phone

1. Start PostgreSQL and Redis, then start the backend on port `4000`.
2. Connect the computer and Android phone to the same Wi-Fi network.
3. Install **Expo Go** on the Android phone.
4. Copy `.env.example` to `.env`. When the API runs on the Expo computer at port `4000`, leave the URL empty to detect that computer's LAN address automatically:

   ```env
   EXPO_PUBLIC_API_URL=
   ```

5. From this `frontend` directory, run:

   ```powershell
   npm install
   npm start
   ```

6. Scan the QR code with Expo Go. Press `r` in the Expo terminal after changing `.env`.

For an API on another computer, an Expo tunnel, or a production build, set `EXPO_PUBLIC_API_URL` to an explicit URL reachable from the device. In development, a phone replaces a loopback URL such as `http://localhost:4000/api` with Expo's LAN host. Browser localhost URLs remain unchanged.

## Test the OTP flow

1. Keep **Create account** selected.
2. Enter a new 10-digit Indian mobile number.
3. Tap **Send me the code**.
4. Read the OTP in the backend terminal. For local development, setting `OTP_EXPOSE_IN_RESPONSE=true` in `backend/.env` also displays the test OTP in the app. Restart the backend after changing that setting.
5. Enter the six-digit OTP and tap **Create my account**.
6. The success screen confirms the authenticated dating-user account. Sign out, select **Log in**, and repeat to test login.

Never enable `OTP_EXPOSE_IN_RESPONSE` in production.

## Connection troubleshooting

- After changing Wi-Fi networks, restart Expo so it advertises the new LAN host. If you use an explicit LAN URL, update it using `ipconfig`.
- Allow Node.js/private-network access through Windows Firewall if the phone cannot reach port `4000`.
- `localhost` on the phone refers to the phone itself, not the development computer.
- Expo's tunnel option can help the phone reach Metro (`npx expo start --tunnel`), but the phone must still be able to reach the backend URL.

## Project checks

```powershell
npm run typecheck
npx expo-doctor
```
