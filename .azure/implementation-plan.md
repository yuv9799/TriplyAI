# Triply — Implementation Plan

## Overview
AI trip planner mobile app (Expo React Native, iOS + Android). Users generate AI-powered itineraries, edit them, share them, and export PDFs. Freemium model with Razorpay (Android) + StoreKit (iOS) payments.

---

## 1. Project Architecture

### Monorepo Structure
```
triply/
├── src/
│   ├── app/                    # expo-router pages (file-based routing)
│   │   ├── _layout.tsx          # Root layout (ClerkProvider, themes)
│   │   ├── index.tsx            # Welcome / splash
│   │   ├── (auth)/              # Auth group
│   │   │   └── sign-in.tsx
│   │   ├── (tabs)/              # Main tab navigator
│   │   │   ├── _layout.tsx
│   │   │   ├── index.tsx        # Home (suggested destinations + generate CTA)
│   │   │   ├── trips/           # My trips list
│   │   │   ├── profile/         # Profile + subscription management
│   │   │   └── settings/
│   │   ├── generate/            # Trip generation flow
│   │   │   ├── index.tsx        # Form (destination, days, travelers, budget)
│   │   │   └── loading.tsx      # Animated loading screen with progress steps
│   │   └── trip/
│   │       └── [id]/            # Trip detail screen
│   │           ├── index.tsx    # Itinerary overview
│   │           ├── day/[dayNumber].tsx  # Day detail
│   │           ├── map.tsx      # Interactive map view
│   │           └── edit.tsx     # Edit trip
│   ├── components/
│   │   ├── ui/                  # Shared UI primitives
│   │   ├── trip/                # Trip-specific components
│   │   ├── generate/            # Generation flow components
│   │   └── map/                 # Map components
│   ├── lib/
│   │   ├── api/                 # API client & endpoint functions
│   │   ├── ai/                  # Gemini integration
│   │   ├── payments/            # Razorpay logic
│   │   ├── notifications/       # Local notification helpers
│   │   └── utils/               # Shared utilities
│   ├── hooks/                   # Custom React hooks
│   ├── providers/               # React context providers
│   ├── types/                   # TypeScript type definitions
│   └── constants/               # App constants (API URLs, limits, etc.)
├── assets/                      # Static assets (images, fonts)
├── backend/                     # Node.js + Express server (TypeScript)
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts             # Express app entry point
│   │   ├── routes/
│   │   │   ├── trips.ts         # Trip CRUD + generation endpoints
│   │   │   ├── users.ts         # User profile + subscription endpoints
│   │   │   ├── payments.ts      # Razorpay order/verification endpoints
│   │   │   └── webhooks.ts      # Razorpay + App Store webhooks
│   │   ├── middleware/
│   │   │   ├── auth.ts          # Clerk JWT verification
│   │   │   └── error.ts         # Global error handler
│   │   ├── inngest/
│   │   │   ├── client.ts        # Inngest client config
│   │   │   └── functions/
│   │   │       ├── generate-trip.ts
│   │   │       ├── regenerate-trip.ts
│   │   │       └── check-limits.ts
│   │   ├── services/
│   │   │   ├── gemini.ts        # Gemini API integration
│   │   │   ├── unsplash.ts      # Unsplash image search
│   │   │   ├── weather.ts       # OpenWeatherMap integration
│   │   │   ├── imagekit.ts      # ImageKit upload + optimization
│   │   │   ├── pdf.ts           # PDF generation
│   │   │   └── payments.ts      # Razorpay + StoreKit logic
│   │   ├── db/
│   │   │   ├── client.ts        # Neon/Postgres client
│   │   │   └── migrations/      # SQL migration files
│   │   └── types/
│   │       └── index.ts         # Shared types
│   └── .env.example
├── .env.local                    # Local environment variables
├── .github/
│   └── workflows/
│       ├── ci.yml               # Lint + type-check
│       ├── eas-build.yml        # Expo EAS Build
│       └── deploy-backend.yml   # Deploy backend to Railway
└── CLAUDE.md
```

---

## 2. Database Schema (Neon / PostgreSQL)

### Tables

```sql
-- Users table (mirrors Clerk users + app-level fields)
CREATE TABLE users (
  id            TEXT PRIMARY KEY,           -- Clerk user ID
  email         TEXT,
  name          TEXT,
  avatar_url    TEXT,
  subscription_tier TEXT NOT NULL DEFAULT 'free',  -- 'free' | 'premium'
  razorpay_customer_id TEXT,
  generation_count INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Destinations
CREATE TABLE destinations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city          TEXT NOT NULL,
  country       TEXT NOT NULL,
  latitude      DOUBLE PRECISION NOT NULL,
  longitude     DOUBLE PRECISION NOT NULL,
  timezone      TEXT,
  currency      TEXT,
  language      TEXT,
  description   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Trips
CREATE TABLE trips (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  destination_id  UUID NOT NULL REFERENCES destinations(id),
  title           TEXT,
  status          TEXT NOT NULL DEFAULT 'generating',  -- 'generating' | 'ready' | 'failed'
  total_days      INTEGER NOT NULL,
  travelers       INTEGER NOT NULL,
  budget          TEXT,                                -- e.g. "$2000-3000"
  total_cost_estimate DECIMAL(10,2),
  is_public       BOOLEAN DEFAULT false,
  share_token     TEXT UNIQUE,                         -- for view-only sharing
  error_message   TEXT,                                -- failure reason if status=failed
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Days
CREATE TABLE days (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id         UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  day_number      INTEGER NOT NULL,
  date            DATE,
  weather_summary TEXT,          -- e.g. "Sunny, 25°C"
  weather_icon    TEXT,          -- OpenWeatherMap icon code
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trip_id, day_number)
);

-- Activities
CREATE TABLE activities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id          UUID NOT NULL REFERENCES days(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('hotel','restaurant','attraction','transport')),
  name            TEXT NOT NULL,
  description     TEXT,
  start_time      TIME,
  end_time        TIME,
  cost_estimate   DECIMAL(10,2),
  latitude        DOUBLE PRECISION,
  longitude       DOUBLE PRECISION,
  unsplash_image_url TEXT,       -- Unsplash image URL
  imagekit_url    TEXT,          -- ImageKit optimized URL
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Subscriptions (tracks payment provider subscription state)
CREATE TABLE subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL CHECK (provider IN ('razorpay', 'storekit', 'stripe', 'lemon_squeezy')),
  provider_subscription_id TEXT,
  provider_customer_id TEXT,
  status          TEXT NOT NULL,  -- 'active' | 'cancelled' | 'expired' | 'past_due'
  plan_type       TEXT NOT NULL DEFAULT 'monthly',  -- 'monthly' | 'yearly'
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_trips_user_id ON trips(user_id);
CREATE INDEX idx_trips_status ON trips(status);
CREATE INDEX idx_trips_share_token ON trips(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX idx_days_trip_id ON days(trip_id);
CREATE INDEX idx_activities_day_id ON activities(day_id);
CREATE UNIQUE INDEX idx_subscriptions_user_provider ON subscriptions(user_id, provider);
```

---

## 3. API Endpoints (Backend Server)

### Auth
- All routes require Clerk JWT verification middleware

### Trips
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/trips/generate` | Submit trip generation request → enqueue Inngest job |
| GET | `/api/trips/:id` | Get trip with all days + activities |
| GET | `/api/trips/:id/status` | Poll trip generation status |
| GET | `/api/trips` | List user's trips (paginated) |
| PATCH | `/api/trips/:id` | Update trip metadata (title, budget, etc.) |
| DELETE | `/api/trips/:id` | Delete trip |
| POST | `/api/trips/:id/regenerate` | Trigger partial AI re-generation (counts toward limit) |

### Sharing
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/trips/:id/share` | Generate/rotate share token |
| GET | `/api/shared/:token` | Get shared trip (public, no auth required) |

### Export (Premium)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/trips/:id/export/pdf` | Generate PDF → return download URL |

### Users & Subscriptions
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/users/me` | Get current user profile + subscription status |
| POST | `/api/users/me/refresh-subscription` | Force subscription tier re-sync |
| POST | `/api/payments/razorpay/create-order` | Create Razorpay order |
| POST | `/api/payments/razorpay/verify` | Verify Razorpay payment signature |

### Webhooks
| Method | Path | Description |
|--------|------|-------------|
| POST | `/webhooks/razorpay` | Razorpay webhook (subscription events) |
| POST | `/webhooks/app-store` | App Store Server Notification (iOS IAP) |
| POST | `/webhooks/clerk` | Clerk webhook (user created/updated/deleted) |

---

## 4. Inngest Functions (Background Jobs)

### `generate-trip` Function
```
Trigger: On event "trip/generate.requested"
Steps:
  1. Receive event with { tripId, destination, days, travelers, budget }
  2. Update trip status to 'generating'
  3. Call Gemini API to generate structured itinerary
     - Prompt engineered to return JSON: { days: [{ dayNumber, activities: [...] }] }
     - Free tier: limit to 5 activities/day, shorter descriptions
     - Premium: up to 10 activities/day, rich descriptions
  4. For each activity, generate Unsplash search keywords via AI
     - Call Unsplash API → get images → upload to ImageKit
  5. For each day, call OpenWeatherMap API for forecast
  6. Parse and save all data to DB (days + activities)
  7. Increment user's generation_count
  8. Update trip status to 'ready'
  9. Send push notification to user
  10. On failure at any step: set trip.status = 'failed', set error_message

Error Handling:
  - Gemini failure: Set status=failed, allow retry
  - Unsplash failure: Continue with placeholder images
  - Weather failure: Continue without weather data
  - Any unrecoverable failure: Set status=failed, notify user
```

### `regenerate-trip` Function
```
Trigger: On event "trip/regenerate.requested"
Steps:
  Similar to generate-trip but receives existing trip context
  Sends current trip data + user edit instructions to Gemini
  Merges AI output with existing data (partial regeneration)
```

### `check-generation-limits` Function
```
Trigger: Before trip/generate.requested
Logic:
  - Check user's subscription_tier
  - If free and generation_count >= 3 → return error "Upgrade required"
  - Otherwise → allow generation event to proceed
```

---

## 5. Expo App Architecture

### Screens & Navigation Flow
```
AuthGate (Clerk)
├── Not signed in → (auth)/sign-in.tsx
└── Signed in → (tabs)/
    ├── Home (index.tsx)
    │   ├── Suggested destinations carousel
    │   └── "Generate a Trip" CTA button
    ├── Trips (trips/index.tsx)
    │   └── List of user's trips (past + in-progress)
    ├── Profile (profile/index.tsx)
    │   ├── User info
    │   ├── Subscription status / upgrade button (Razorpay Android / StoreKit iOS)
    │   ├── Generation usage bar
    │   └── Settings
    └── Settings (settings/index.tsx)

Stack screens (pushed over tabs):
├── generate/index.tsx → Trip generation form
├── generate/loading.tsx → Animated loading with progress steps
├── trip/[id]/index.tsx → Trip detail with day-by-day itinerary
├── trip/[id]/day/[dayNumber].tsx → Single day detail
├── trip/[id]/map.tsx → Interactive map of all activities
└── trip/[id]/edit.tsx → Edit trip form
```

### Key Libraries to Install
```json
{
  "dependencies": {
    "@clerk/clerk-expo": "^x.y.z",
    "@inngest/react": "^x.y.z",
    "react-native-maps": "^x.y.z",
    "react-native-reanimated-carousel": "^x.y.z",
    "react-native-pdf": "^x.y.z",
    "expo-notifications": "^x.y.z",
    "expo-linking": "^x.y.z",
    "react-native-svg": "^x.y.z",
    "zustand": "^x.y.z",
    "@tanstack/react-query": "^x.y.z",
    "date-fns": "^x.y.z",
    "react-native-razorpay": "^x.y.z"
  }
}
```

### State Management
- **Server state**: React Query (TanStack Query) — handles API caching, polling, optimistic updates
- **Client state**: Zustand (lightweight) — for UI state like generation progress, modals
- **Auth state**: Clerk's built-in hooks + context

### Polling Strategy
```
On generate/loading.tsx mount:
  - Start polling GET /api/trips/:id/status every 5 seconds
  - After 30 seconds, increase to every 10 seconds
  - After 60 seconds, show "We'll notify you when it's ready" option
  - When status = 'ready' → navigate to trip/[id]/
  - When status = 'failed' → show error with retry button
  - On component unmount → stop polling, schedule local notification
```

---

## 6. Payment Architecture (Dual System)

### iOS (StoreKit)
```
Flow:
  1. User taps "Subscribe" on iOS
  2. App calls StoreKit (via expo-storekit or RN library) to present product sheet
  3. User completes purchase in App Store sheet
  4. App sends receipt to our backend POST /webhooks/app-store
  5. Backend verifies receipt with Apple, updates user.subscription_tier
  6. Backend inserts row into subscriptions table (provider='storekit')
  7. App refreshes user state

Products: (configured in App Store Connect)
  - triply_premium_monthly (auto-renewable subscription)
  - triply_premium_yearly (future)
```

### Android (Razorpay)
```
Flow:
  1. User taps "Subscribe" on Android
  2. App calls POST /api/payments/razorpay/create-order
  3. Backend creates Razorpay order, returns order_id + amount
  4. App opens Razorpay payment sheet (react-native-razorpay)
  5. User completes payment
  6. On success, app sends payment_id + order_id + signature to verify
  7. Backend verifies signature, updates user.subscription_tier
  8. Backend inserts row into subscriptions table (provider='razorpay')
  9. Backend also handles Razorpay webhook POST /webhooks/razorpay for recurring events
  10. App refreshes user state
```

### Subscription Reconciliation
```
- Single source of truth: user.subscription_tier in Neon DB
- Both Razorpay webhooks + App Store notifications update this field
- Subscriptions table tracks provider-specific subscription IDs for portability
- On app launch + profile screen visit: sync via GET /api/users/me
- Future: When swapping to Stripe/Lemon Squeezy, add new provider entries in subscriptions
```

---

## 7. Generation Token Cost Management

### Free Tier Limits
```
- Max 5 activities per day (vs 10 for premium)
- Activity descriptions truncated to 50 words (vs unlimited)
- No weather data (premium only)
- Max 7 days per trip (vs 14 for premium)
- Total: ~3-5K tokens per free generation vs ~10-20K for premium
```

### Monitoring
```
- Sentry performance trace on every Gemini API call
- Daily token usage tracked in PostgreSQL
- Alert at 80% of daily budget → log + notify admin
- Hard cap: reject generation requests when budget exhausted
```

---

## 8. CI/CD Pipeline

### GitHub Actions Workflows
```yaml
# .github/workflows/ci.yml
on: [pull_request]
jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - checkout
      - install dependencies
      - run: npm run lint
      - run: npm run typecheck

# .github/workflows/eas-build.yml
on: [push to main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - checkout
      - eas build --platform all --profile production

# .github/workflows/deploy-backend.yml
on: [push to main, path: 'backend/**']
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - deploy to Railway
```

### Environment Config
```
Local:     .env.local (local Neon branch, Clerk test instance, Razorpay test keys)
Staging:   Railway environment (staging Neon, staging Clerk, Razorpay test)
Production: Railway environment (production Neon, production Clerk, Razorpay live)
```

---

## 9. Implementation Order (Step-by-Step)

### Phase 1: Foundation (Days 1-3)
- [ ] 1.1 Set up backend project (Express + TypeScript)
- [ ] 1.2 Create `.env.local` with all API keys
- [ ] 1.3 Create Neon database + run initial migrations
- [ ] 1.4 Set up Clerk project + configure Email + Google OAuth
- [ ] 1.5 Integrate Clerk into Expo app (ClerkProvider, sign-in screen)
- [ ] 1.6 Set up Inngest project + dev server
- [ ] 1.7 Set up Sentry in both frontend + backend
- [ ] 1.8 Create GitHub Actions CI workflow

### Phase 2: Core Generation Flow (Days 4-8)
- [ ] 2.1 Build trip generation form screen
- [ ] 2.2 Implement Gemini prompt engineering + itinerary parsing
- [ ] 2.3 Create Inngest `generate-trip` function
- [ ] 2.4 Build loading screen with animated progress steps
- [ ] 2.5 Implement polling mechanism + local notification
- [ ] 2.6 Build trip detail screen (day-by-day view)
- [ ] 2.7 Implement basic trip listing on Home + Trips screens

### Phase 3: Integrations (Days 9-12)
- [ ] 3.1 Integrate Unsplash API (keyword search with AI-generated terms)
- [ ] 3.2 Integrate ImageKit (image upload + optimization)
- [ ] 3.3 Integrate OpenWeatherMap API (weather data)
- [ ] 3.4 Build interactive map view (react-native-maps)
- [ ] 3.5 Implement trip editing UI + `regenerate-trip` Inngest function
- [ ] 3.6 Implement view-only sharing links

### Phase 4: Payments (Days 13-16)
- [ ] 4.1 Set up Razorpay products + plans (monthly)
- [ ] 4.2 Implement Razorpay order creation + verification endpoints
- [ ] 4.3 Implement Razorpay webhook handler + subscription sync
- [ ] 4.4 Build subscription management UI (profile screen)
- [ ] 4.5 Implement generation limit enforcement
- [ ] 4.6 Build upgrade prompt screens
- [ ] 4.7 iOS StoreKit setup (App Store Connect product + receipt verification)
- [ ] 4.8 Implement App Store Server Notification handler

### Phase 5: Premium Features + Polish (Days 17-19)
- [ ] 5.1 Implement PDF export (server-side generation)
- [ ] 5.2 Add welcome screen with suggested destinations
- [ ] 5.3 Error states + empty states + loading skeletons
- [ ] 5.4 Animated transitions + micro-interactions
- [ ] 5.5 Accessibility audit (labels, roles, screen reader support)

### Phase 6: Staging & Testing (Days 20-22)
- [ ] 6.1 Deploy backend to Railway staging environment
- [ ] 6.2 End-to-end testing (generation, auth, payments, limits)
- [ ] 6.3 Performance testing (generation time, image loading)
- [ ] 6.4 Crash-free validation on real devices
- [ ] 6.5 App Store + Play Store prep (screenshots, descriptions, privacy policy)

---

## 10. Confirmed Decisions (from Interview)

| Question | Decision |
|---|---|
| Auth providers | Email + Google (no Apple v1) |
| AI model | Gemini |
| Images | Unsplash (keyword search) + ImageKit (optimization) |
| Weather | OpenWeatherMap |
| Payments (Android) | Razorpay (swappable to Stripe/Lemon Squeezy later) |
| Payments (iOS) | StoreKit (Apple IAP) |
| Subscription model | Monthly recurring (yearly in future) |
| Backend | Separate Node.js + Express in `backend/` directory |
| Backend hosting | Railway |
| Database | Neon (PostgreSQL) |
| Background jobs | Inngest |
| Error monitoring | Sentry |
| Code reviews | CodeRabbit |
| CI/CD | GitHub Actions + EAS Build |
| Environments | Local → Staging (Railway) → Production (Railway) |

---

## 11. Deployment Architecture (Railway)

```
[Expo App (iOS/Android)] ← HTTPS → [Railway: Node.js Express Server]
                                          ├── Neon PostgreSQL (via internal network or SSL)
                                          ├── Inngest (background job queue)
                                          ├── Gemini API (external)
                                          ├── Unsplash API (external)
                                          ├── OpenWeatherMap API (external)
                                          ├── ImageKit (external, CDN)
                                          ├── Razorpay API (external, Android payments)
                                          └── Apple StoreKit (external, iOS payments)
```

Railway provides:
- Automatic deploys from GitHub
- Built-in Neon PostgreSQL integration
- Environment variable management
- Subdomain for API (e.g., triply-api.railway.app)
- Automatic SSL
- Simple scaling