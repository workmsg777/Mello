# Authentication API

Base path: `/api/auth`

The server accepts E.164 phone numbers such as `+919876543210`. A local number
without `+` uses `DEFAULT_PHONE_COUNTRY_CODE` (India/`+91` by default).

OTPs expire after five minutes by default. Redis stores an HMAC hash of the OTP,
not the raw code, and removes it after successful signup/login verification.

## Dating-user signup

Request an OTP:

```http
POST /api/auth/signup/request-otp
Content-Type: application/json

{
  "phone": "9876543210",
  "accountType": "DATING_USER"
}
```

Verify the OTP, create the account, and log in:

```http
POST /api/auth/signup/verify
Content-Type: application/json

{
  "phone": "9876543210",
  "otp": "123456",
  "accountType": "DATING_USER",
  "device": {
    "deviceId": "browser-123",
    "deviceName": "Chrome on Windows",
    "platform": "WEB"
  }
}
```

## Partner-owner signup

First request the OTP with `accountType: "PARTNER_USER"`, then verify it with
the partner business details:

```http
POST /api/auth/signup/verify
Content-Type: application/json

{
  "phone": "+919876543210",
  "otp": "123456",
  "accountType": "PARTNER_USER",
  "partner": {
    "ownerName": "Partner Owner",
    "businessName": "Example Cafe",
    "category": "CAFE",
    "addressLine1": "12 Example Road",
    "city": "Bengaluru",
    "state": "Karnataka",
    "postalCode": "560001",
    "countryCode": "IN"
  },
  "device": {
    "platform": "WEB"
  }
}
```

This creates the partner business and a `PARTNER_USER` with the `OWNER` staff
role in one database transaction.

## Platform-user signup

Platform signup uses `accountType: "PLATFORM_USER"` and requires the private
`PLATFORM_SIGNUP_SECRET` value during verification:

```json
{
  "phone": "+919876543210",
  "otp": "123456",
  "accountType": "PLATFORM_USER",
  "platformUser": {
    "name": "Mello Admin",
    "registrationKey": "the-private-platform-registration-key"
  },
  "device": {
    "platform": "WEB"
  }
}
```

Platform registration is disabled when the server secret is missing or shorter
than 32 characters.

## Login

Request a login OTP:

```http
POST /api/auth/login/request-otp
Content-Type: application/json

{
  "phone": "+919876543210"
}
```

Verify and log in:

```http
POST /api/auth/login/verify
Content-Type: application/json

{
  "phone": "+919876543210",
  "otp": "123456",
  "device": {
    "platform": "WEB"
  }
}
```

Successful signup and login responses contain an access token, a rotating
refresh token, the account type, and the matching profile. Send the access token
to protected routes as `Authorization: Bearer <accessToken>`.

## Session endpoints

- `POST /api/auth/refresh` — body: `{ "refreshToken": "..." }`
- `POST /api/auth/logout` — body: `{ "refreshToken": "..." }`
- `GET /api/auth/me` — requires a Bearer access token

Refresh tokens are opaque random values. Only their SHA-256 hashes are stored in
the `user_sessions` table, and every refresh rotates the token.

## Local OTP delivery

Use `OTP_DELIVERY_MODE=console` locally. The OTP appears in backend logs. Setting
`OTP_EXPOSE_IN_RESPONSE=true` also includes `developmentOtp` in request-OTP
responses outside production. Never enable response exposure in production.
