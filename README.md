# Meridian — React Frontend

Modern React (Vite) frontend for the Meridian mental-health support backend.
This is a one-to-one rewrite of the original static HTML/JS frontend — same
backend, same Supabase auth, same routes, but a single-page React app.

## Quick start

```bash
# 1. Install
npm install

# 2. Set up environment
cp .env.example .env
#    then edit .env and paste your Supabase URL + anon key

# 3. Run dev server  →  http://localhost:5173
npm run dev

# 4. Production build → ./dist
npm run build
npm run preview      # serve the production build locally on port 4173
```

## Environment variables

| Variable                | Description                                  |
| ----------------------- | -------------------------------------------- |
| `VITE_SUPABASE_URL`     | Your Supabase project URL                    |
| `VITE_SUPABASE_ANON_KEY`| Public anon key (NOT service role)           |

The backend API host is hard-coded the same way the original was:
- `localhost:8000` when running on `localhost`
- `https://astroknotsheep-meridian-api.hf.space` otherwise

If you need a different production API host, change `API_BASE` in
`src/lib/api.js`.

## Folder structure

```
meridian-react/
├── public/
│   └── favicon.svg
├── src/
│   ├── main.jsx              # React entry
│   ├── App.jsx               # Routes
│   ├── index.css             # Globals + design tokens
│   ├── lib/
│   │   ├── supabase.js       # Supabase client
│   │   └── api.js            # apiFetch with fresh-token auth headers
│   ├── context/
│   │   └── AuthContext.jsx   # session + profile, signOut
│   ├── components/
│   │   ├── ProtectedRoute.jsx
│   │   ├── ShaderBackground.jsx
│   │   ├── CursorGlow.jsx
│   │   ├── AmbientOrbs.jsx
│   │   ├── AppNav.jsx
│   │   └── ProfileDropdown.jsx
│   ├── pages/
│   │   ├── Landing.jsx       # /
│   │   ├── Auth.jsx          # /auth   (also handles ?confirmed=true)
│   │   ├── Verified.jsx      # /verified
│   │   ├── Onboarding.jsx    # /onboarding
│   │   ├── Chat.jsx          # /chat   (?session=<id> optional)
│   │   ├── History.jsx       # /history
│   │   └── Profile.jsx       # /profile
│   └── styles/
│       ├── background.css
│       ├── landing.css
│       ├── auth.css
│       ├── card-page.css
│       ├── chat.css
│       ├── app-nav.css
│       ├── history.css
│       └── profile.css
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── vercel.json
└── vite.config.js
```

## Routing & auth model

| Path           | Public | Requires session | Requires consent |
| -------------- | ------ | ---------------- | ---------------- |
| `/`            | ✓      |                  |                  |
| `/auth`        | ✓      |                  |                  |
| `/verified`    | ✓      |                  |                  |
| `/onboarding`  |        | ✓                |                  |
| `/chat`        |        | ✓                | ✓                |
| `/history`     |        | ✓                | ✓                |
| `/profile`     |        | ✓                | ✓                |

When a protected route lacks consent, the user is redirected to `/onboarding`.
When any backend call returns `403` it's treated as "consent not granted" and
the user is sent to `/onboarding`. `401` redirects to `/auth`.

`Authorization` headers are pulled fresh from `supabase.auth.getSession()`
before every API call — this avoids the stale-token bug that the original
frontend had to patch around with `authHeaders()`.

## Supabase setup

Update the **Site URL** and **Redirect URLs** in your Supabase project's
Authentication settings to include:

- `https://your-domain.example/auth?confirmed=true`
- `http://localhost:5173/auth?confirmed=true`  (for local dev)

## Deploy to Vercel

```bash
vercel
```

`vercel.json` is already configured: SPA rewrites send every path to
`index.html`, so React Router handles routing.

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in your Vercel project's
environment variables before deploying.

## Backend endpoints used

All under the `API_BASE` (Supabase JWT in `Authorization: Bearer <token>`):

| Method | Path                          | Used by                  |
| ------ | ----------------------------- | ------------------------ |
| GET    | `/profile`                    | Auth flow, Onboarding, Profile |
| PUT    | `/profile`                    | Profile                  |
| POST   | `/profile/consent`            | Onboarding               |
| POST   | `/chat`                       | Chat                     |
| GET    | `/sessions`                   | Chat, History, Profile   |
| GET    | `/sessions/{id}/messages`     | Chat                     |

These match the original frontend exactly. No backend changes required.
