# BurnDelta

A full-stack calorie tracking web app that treats nutrition as a thermodynamic balance sheet. Log meals by uploading a photo or typing a description, get AI-powered macro estimates via the Gemini Vision API, and see exactly how many minutes of cardio it takes to offset any surplus.

---

## What it does

- Step-by-step biometric onboarding that calculates your BMR and TDEE using the Mifflin-St Jeor equation
- Meal logging via image upload, text description, or QR-based phone-to-desktop sync
- AI macro estimation through a server-side Gemini Vision gateway with mock fallback when no API key is set
- Real-time calorie ring showing remaining budget vs. consumed
- Kinetic offset calculator: surplus calories converted to exact run, cycle, and walk durations using MET values
- Calendar view with daily and weekly calorie history
- Delete individual meals
- Mobile upload page accessible by scanning a QR code from the desktop dashboard

---

## Stack

- Node.js with no framework, vanilla JS frontend
- PostgreSQL via Railway for persistent storage
- Gemini 2.5 Flash for image and text meal analysis
- Deployed on Railway with automatic deploys from GitHub

---

## Running locally

1. Copy `.env.example` to `.env` and fill in the values:

```
SESSION_SECRET=any_long_random_string
GEMINI_API_KEY=your_key_from_aistudio.google.com
DATABASE_URL=your_postgres_connection_string
```

2. Install dependencies:

```
npm install
```

3. Start the server:

```
node --env-file=.env server.mjs
```

4. Open `http://localhost:8080`

The `GEMINI_API_KEY` is optional. Without it, the app uses a built-in food knowledge base to estimate macros from text descriptions.

---

## Security

- Passwords hashed with `crypto.scrypt` and a random salt
- Session tokens are HMAC-signed and stored in HttpOnly, SameSite=Strict cookies
- Auth routes rate limited to 5 attempts per 15 minutes per IP
- All other API routes rate limited to 120 requests per 15 minutes
- Payloads size-limited and parsed as JSON only
- All user inputs validated and sanitized server-side before database writes
- Gemini API key lives only in environment variables, never exposed to the frontend
- Static assets served with a Content Security Policy header
- Mobile upload tokens expire after 10 minutes and are single-use

---

## Project structure

```
server.mjs          Node.js HTTP server, all API routes, Gemini integration
public/
  index.html        App shell
  app.js            All frontend rendering and state
  styles.css        Design system and component styles
  mobile.html       Phone upload page opened via QR code
  assets/
    newbg.png       Background image
```

---

## Built by

Aansha Dhakal — summer 2026
