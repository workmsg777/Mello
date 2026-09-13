# Mello Partner mobile app

This is a separate Expo application from the dating-user app at `frontend/`.
It has its own Android/iOS identifiers, environment configuration, dependencies,
and authentication-session storage.

## Start on Android

```powershell
cd C:\Users\sahil\Desktop\Mello\frontend\apps\partner
npm install
npm start
```

Install Expo Go on the Android phone and scan the QR code. The computer and
phone should be on the same Wi-Fi network.

The local API address is configured in `.env`:

```env
EXPO_PUBLIC_API_URL=http://192.168.31.145:4000/api
```

Update the address when the computer's Wi-Fi IPv4 changes. Start the backend,
PostgreSQL, and Redis before testing.

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
