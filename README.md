# BurnDelta

BurnDelta is a secure local prototype of the app described in the PDF: a biometric onboarding flow plus a dark telemetry dashboard that logs meals from an image or text fallback, estimates calories/macros through a server-side Gemini gateway, and calculates cardio minutes required to offset calorie surplus.

## Run

1. Copy `.env.example` to `.env` and set `SESSION_SECRET`.
2. Optionally set `GEMINI_API_KEY` for live image analysis. Without it, the app uses a safe demo estimator.
3. Start the app:

```bash
npm start
```

Then open `http://localhost:8080`.

## Security Notes

- Auth routes are rate limited to 5 attempts per 15 minutes per IP.
- All API endpoints are rate limited and return rate limit headers.
- Session cookies are HttpOnly and SameSite=Strict.
- Passwords are hashed with Node `crypto.scrypt`.
- Payloads are size limited and parsed as JSON only.
- Biometric, auth, meal, text, and image inputs are validated and sanitized server-side.
- Gemini API keys are read only from environment variables and never sent to frontend code.
- Static assets are served with a restrictive Content Security Policy.

Run the local security scan:

```bash
npm run security:audit
```

## Prototype Limits

This version uses in-memory users, sessions, profiles, and meal logs so it can run without external dependencies. For production, replace the in-memory stores with Supabase/Postgres, add persistent session storage, add CSRF tokens for cookie-authenticated mutations, and configure HTTPS.
