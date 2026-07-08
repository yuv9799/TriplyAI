# WanderAI

> **AI-Powered Travel Itinerary Planner** — Your personal AI travel companion that builds complete day-by-day trip itineraries with maps, weather, cost estimates, and images.

<div align="center">
  <img src="https://img.shields.io/badge/platform-iOS%20%7C%20Android-blue?style=flat-square" alt="Platform: iOS + Android" />
  <img src="https://img.shields.io/badge/framework-Expo%20SDK%2057-black?style=flat-square" alt="Framework: Expo SDK 57" />
  <img src="https://img.shields.io/badge/backend-Node.js%20%2F%20Express-green?style=flat-square" alt="Backend: Node.js / Express" />
  <img src="https://img.shields.io/badge/database-Neon%20PostgreSQL-blue?style=flat-square" alt="Database: Neon PostgreSQL" />
  <img src="https://img.shields.io/badge/AI-Gemini%201.5--Pro-orange?style=flat-square" alt="AI: Gemini 1.5 Pro" />
</div>

---

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Data Model](#data-model)
- [API Endpoints](#api-endpoints)
- [User Flows](#user-flows)
- [Screen Map](#screen-map)
- [Authentication & Authorization](#authentication--authorization)
- [Payment Architecture](#payment-architecture)
- [Background Jobs](#background-jobs)
- [Integrations](#integrations)
- [Environments](#environments)
- [CI/CD Pipeline](#cicd-pipeline)
- [Getting Started](#getting-started)
- [Future Roadmap](#future-roadmap)

---

## Overview

**WanderAI** is a mobile app (iOS + Android) built with Expo React Native that lets users generate AI-powered travel itineraries. Users describe their destination, trip duration, number of travelers, and budget — and the app uses Google Gemini to produce a complete day-by-day itinerary with:

- 🏨 **Hotels**, 🍽️ **Restaurants**, 🎯 **Attractions**, 🚗 **Transport**
- 📍 Interactive maps with navigation links
- 🌤️ Live weather forecasts for each day
- 🖼️ AI-selected destination images (via Unsplash + ImageKit)
- 💰 Cost estimates per activity and total trip budget
- ✏️ Editable itinerary with AI-powered partial re-generation
- 🔗 View-only sharing links
- 📄 PDF export (Premium tier)
- 🔄 **Cross-platform**: iOS + Android

### Monetization Model
- **Free tier**: 3 basic itinerary generations (limited activities/day, no weather/images/maps)
- **Premium tier**: Unlimited generations, full rich itineraries, weather, images, maps, PDF export
- **Payments**: Razorpay (Android) + StoreKit (iOS) — dual system for App Store compliance

---

## Architecture

### High-Level Architecture Diagram

```mermaid
graph TB
    subgraph "Mobile App (Expo RN)"
        A[Expo React Native App]
        B[Clerk Auth]
        C[React Query]
        D[Zustand Store]
        A --> B
        A --> C
        A --> D
    end

    subgraph "Backend (Node.js / Express)"
        E[Express Server]
        F[Clerk Middleware]
        G[REST API Routes]
        H[Inngest Client]
        E --> F
        E --> G
        E --> H
    end

    subgraph "Database"
        I[(Neon PostgreSQL)]
    end

    subgraph "Background Jobs (Inngest)"
        J[Generate Trip Function]
        K[Regenerate Trip Function]
        L[Check Limits Function]
    end

    subgraph "External Services"
        M[Gemini API]
        N[Unsplash API]
        O[OpenWeatherMap API]
        P[ImageKit CDN]
        Q[Razorpay API]
        R[Apple StoreKit]
        S[Sentry]
    end

    A -->|HTTPS| E
    G --> I
    H --> J
    H --> K
    H --> L
    J --> M
    J --> N
    J --> O
    J --> P
    G --> Q
    A --> R
    E --> S
    A --> S
```

### Request Flow: Trip Generation

```mermaid
sequenceDiagram
    participant User
    participant App as Expo App
    participant API as Express API
    participant DB as Neon DB
    participant Inngest as Inngest
    participant Gemini as Gemini AI
    participant Unsplash as Unsplash API
    participant Weather as OpenWeatherMap
    
    User->>App: Fill trip form + tap "Generate"
    App->>API: POST /api/trips/generate
    API->>DB: Check user tier & limits
    API->>DB: Create trip (status: generating)
    API-->>App: Return tripId + status
    API->>Inngest: Send trip/generate.requested
    App->>App: Show loading screen
    
    Inngest->>DB: Fetch trip details
    Inngest->>Gemini: Generate itinerary JSON
    Gemini-->>Inngest: Structured itinerary with days + activities
    
    loop For each day
        Inngest->>Weather: Fetch forecast
        Weather-->>Inngest: Weather data
        loop For each activity
            Inngest->>Gemini: Generate search keywords
            Inngest->>Unsplash: Search for image
            Unsplash-->>Inngest: Image URL
            Inngest->>ImageKit: Upload & optimize
        end
        Inngest->>DB: Save day + activities
    end
    
    Inngest->>DB: Update trip status → ready
    Inngest->>DB: Increment generation_count
    
    loop Every 5 seconds
        App->>API: GET /api/trips/:id/status
        API-->>App: status: ready
    end
    
    App->>User: Navigate to trip detail screen
```

---

## Tech Stack

### Frontend (Expo React Native)
| Technology | Purpose |
|---|---|
| **Expo SDK 57** | React Native framework |
| **expo-router** | File-based navigation |
| **Clerk** | Authentication (Email + Google OAuth) |
| **@tanstack/react-query** | Server state management, caching, polling |
| **Zustand** | Client-side state management |
| **react-native-maps** | Interactive map views |
| **react-native-reanimated** | Animations & transitions |
| **expo-notifications** | Local push notifications |
| **date-fns** | Date formatting & manipulation |

### Backend (Node.js / Express)
| Technology | Purpose |
|---|---|
| **Express** | HTTP server & routing |
| **TypeScript** | Type safety |
| **@neondatabase/serverless** | PostgreSQL connection |
| **pg** | PostgreSQL connection pool |
| **@clerk/clerk-sdk-node** | JWT verification |
| **@google/generative-ai** | Gemini AI SDK |
| **Inngest** | Background job orchestration |
| **Razorpay** | Payment processing (Android) |
| **ImageKit** | Image upload & CDN optimization |
| **Zod** | Request validation |
| **Helmet** | Security headers |
| **Morgan** | HTTP request logging |

### Database (Neon PostgreSQL)
- Serverless PostgreSQL
- 6 tables with foreign keys, indexes, and constraints
- Migration-based schema management

### External Integrations
| Service | Purpose | Plan |
|---|---|---|
| Google Gemini 1.5 Pro | Itinerary generation | Pay-per-token |
| Unsplash | Free stock images | 50 req/hr (free) |
| OpenWeatherMap | Live weather forecasts | 1K calls/day (free) |
| ImageKit | Image optimization & CDN | 20GB bandwidth (free) |
| Razorpay | Android payments | 2% per transaction |
| Apple StoreKit | iOS payments | 15-30% Apple commission |
| Sentry | Error & performance monitoring | 5K events/mo (free) |

---

## Project Structure

```
wanderai/
│
├── src/                              # Expo React Native App
│   ├── app/                          # expo-router file-based pages
│   │   ├── _layout.tsx               # Root layout (ClerkProvider, theme)
│   │   ├── index.tsx                 # Welcome / splash screen
│   │   ├── (auth)/                   # Authentication group
│   │   │   └── sign-in.tsx
│   │   ├── (onboarding)/             # Preferences onboarding
│   │   │   └── preferences.tsx
│   │   ├── (tabs)/                   # Main tab navigator
│   │   │   ├── _layout.tsx
│   │   │   ├── index.tsx             # Home / Explore
│   │   │   ├── trips/                # Saved trips list
│   │   │   ├── profile/              # User profile + settings
│   │   │   └── explore/              # Places explorer
│   │   ├── generate/                 # Trip generation flow
│   │   │   ├── index.tsx             # Trip planner form
│   │   │   └── loading.tsx           # Animated loading screen
│   │   └── trip/
│   │       └── [id]/                 # Trip detail screens
│   │           ├── index.tsx         # Itinerary overview
│   │           ├── day/[day].tsx     # Single day detail
│   │           ├── map.tsx           # Interactive map
│   │           └── edit.tsx          # Edit trip
│   │
│   ├── components/                   # Reusable UI components
│   │   ├── ui/                       # Primitives (Button, Card, Input, etc.)
│   │   ├── trip/                     # Trip-specific components
│   │   ├── generate/                 # Generation flow components
│   │   └── map/                      # Map components
│   │
│   ├── lib/                          # Business logic & utilities
│   │   ├── api/                      # API client & endpoint functions
│   │   ├── notifications/            # Push notification helpers
│   │   └── utils/                    # Shared utilities
│   │
│   ├── hooks/                        # Custom React hooks
│   │   ├── useTripPolling.ts         # Poll trip generation status
│   │   └── useSubscription.ts        # Subscription management
│   │
│   ├── providers/                    # React context providers
│   │   ├── query-provider.tsx        # React Query provider
│   │   └── theme-provider.tsx        # Theme context
│   │
│   ├── types/                        # TypeScript type definitions
│   └── constants/                    # App constants & config
│
├── backend/                          # Node.js Express Server
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts                  # Express entry point
│   │   ├── routes/                   # API route handlers
│   │   │   ├── trips.ts              # Trip CRUD + generation
│   │   │   ├── users.ts              # User profile + subscriptions
│   │   │   ├── payments.ts           # Razorpay order/verify
│   │   │   └── webhooks.ts           # Clerk webhooks
│   │   ├── middleware/
│   │   │   ├── auth.ts               # Clerk JWT verification
│   │   │   └── error.ts              # Global error handler
│   │   ├── db/
│   │   │   ├── client.ts             # Database connection
│   │   │   ├── migrate.ts            # Migration runner
│   │   │   └── migrations/           # SQL migration files
│   │   ├── services/
│   │   │   ├── gemini.ts             # Gemini AI integration
│   │   │   ├── unsplash.ts           # Unsplash image search
│   │   │   ├── weather.ts            # OpenWeatherMap API
│   │   │   ├── imagekit.ts           # Image upload & optimization
│   │   │   └── pdf.ts                # PDF generation (stub)
│   │   └── inngest/
│   │       ├── client.ts             # Inngest client
│   │       └── functions/
│   │           └── generate-trip.ts   # Async generation pipeline
│   │
│   └── .env.example
│
├── .github/workflows/                # CI/CD pipelines
│   └── ci.yml                        # Lint + type-check on PR
├── .env.local                        # Local environment variables
├── app.json                          # Expo configuration
└── tsconfig.json                     # TypeScript configuration
```

---

## Data Model

### Entity Relationship Diagram

```mermaid
erDiagram
    USERS ||--o{ TRIPS : owns
    USERS ||--o{ SUBSCRIPTIONS : has
    DESTINATIONS ||--o{ TRIPS : located_in
    TRIPS ||--o{ DAYS : contains
    DAYS ||--o{ ACTIVITIES : contains

    USERS {
        text id PK "Clerk user ID"
        text email
        text name
        text avatar_url
        text subscription_tier "free | premium"
        text razorpay_customer_id
        int generation_count
        timestamptz created_at
    }

    DESTINATIONS {
        uuid id PK
        text city
        text country
        double latitude
        double longitude
        text timezone
        text currency
        text language
        text description
    }

    TRIPS {
        uuid id PK
        text user_id FK
        uuid destination_id FK
        text title
        text status "generating | ready | failed"
        int total_days
        int travelers
        text budget
        decimal total_cost_estimate
        boolean is_public
        text share_token UK
        text error_message
        timestamptz created_at
    }

    DAYS {
        uuid id PK
        uuid trip_id FK
        int day_number
        date date
        text weather_summary
        text weather_icon
        timestamptz created_at
    }

    ACTIVITIES {
        uuid id PK
        uuid day_id FK
        text type "hotel | restaurant | attraction | transport"
        text name
        text description
        time start_time
        time end_time
        decimal cost_estimate
        double latitude
        double longitude
        text unsplash_image_url
        text imagekit_url
        int sort_order
    }

    SUBSCRIPTIONS {
        uuid id PK
        text user_id FK
        text provider "razorpay | storekit | stripe | lemon_squeezy"
        text provider_subscription_id
        text provider_customer_id
        text status
        text plan_type "monthly | yearly"
        timestamptz current_period_start
        timestamptz current_period_end
    }
```

### Key Constraints
- `users.id` → Clerk user ID (external identity provider)
- `trips.status` → One of: `generating`, `ready`, `failed`
- `activities.type` → One of: `hotel`, `restaurant`, `attraction`, `transport`
- `subscriptions.provider` → Extensible: `razorpay`, `storekit`, `stripe`, `lemon_squeezy`
- Unique constraint on `(trip_id, day_number)` for days
- Unique constraint on `(user_id, provider)` for subscriptions
- Share token is unique for public trip links

---

## API Endpoints

All endpoints (except webhooks) require Clerk JWT authentication via `Authorization: Bearer <token>` header.

### Trips
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/trips/generate` | Submit trip generation → enqueues Inngest job |
| `GET` | `/api/trips` | List user's trips (paginated) |
| `GET` | `/api/trips/:id` | Get full trip with days + activities |
| `GET` | `/api/trips/:id/status` | Poll generation status |
| `PATCH` | `/api/trips/:id` | Update trip metadata |
| `DELETE` | `/api/trips/:id` | Delete trip + cascading days/activities |
| `POST` | `/api/trips/:id/regenerate` | Trigger partial AI re-generation |
| `POST` | `/api/trips/:id/share` | Generate view-only share link |

### Sharing
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/shared/:token` | Get shared trip (public, no auth) |

### Export
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/trips/:id/export/pdf` | Generate PDF (Premium) |

### Users & Payments
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/users/me` | Get current user profile |
| `POST` | `/api/users/me/refresh-subscription` | Force re-sync subscription tier |
| `POST` | `/api/payments/razorpay/create-order` | Create Razorpay payment order |
| `POST` | `/api/payments/razorpay/verify` | Verify Razorpay payment signature |

### Webhooks
| Method | Path | Description | Source |
|--------|------|-------------|--------|
| `POST` | `/webhooks/clerk` | User created/updated/deleted | Clerk |
| `POST` | `/webhooks/razorpay` | Payment/subscription events | Razorpay |
| `POST` | `/webhooks/app-store` | Receipt validation | Apple |

### Health
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Server health check |

---

## User Flows

### 1. First-Time User Flow

```mermaid
flowchart TD
    A[Open App] --> B[Splash Screen]
    B --> C[Welcome Screen]
    C --> D{Sign Up Method}
    D --> E[Email + Password]
    D --> F[Google OAuth]
    E --> G[Verify Email]
    F --> G
    G --> H[Preferences Onboarding]
    H --> I[Trip Style Selection]
    I --> J[Budget Selection]
    J --> K[Interest Selection]
    K --> L[Home Screen]
```

### 2. Trip Generation Flow

```mermaid
flowchart TD
    A[Home Screen] --> B[Trip Planner Form]
    B --> C[Enter: Destination]
    C --> D[Enter: Trip Duration]
    D --> E[Enter: Travelers]
    E --> F[Enter: Budget]
    F --> G{Tap Generate}
    G --> H{Free user & >= 3 trips?}
    H -->|Yes| I[Upgrade Prompt]
    H -->|No| J[Create Trip in DB]
    J --> K[Enqueue Inngest Job]
    K --> L[Loading Screen]
    L --> M[Poll: /status every 5s]
    M --> N{Status?}
    N -->|generating| M
    N -->|ready| O[Navigate to Trip Detail]
    N -->|failed| P[Show Error + Retry]
    I --> Q[Payment Flow]
    Q --> J
```

### 3. Payment Flow

```mermaid
flowchart TD
    A[Upgrade Prompt] --> B{Platform?}
    B -->|Android| C[Razorpay]
    B -->|iOS| D[StoreKit]
    C --> E[POST /create-order]
    E --> F[Open Razorpay Sheet]
    F --> G[User Pays]
    G --> H[POST /verify]
    H --> I[Update subscription_tier]
    I --> J[Refresh user state]
    D --> K[Present StoreKit Sheet]
    K --> L[User Pays via Apple]
    L --> M[Send receipt to backend]
    M --> N[Verify with Apple]
    N --> O[Update subscription_tier]
    O --> J
```

---

## Screen Map

### Navigation Structure

```mermaid
flowchart LR
    subgraph "Auth Group"
        SP[Splash] --> WL[Welcome]
        WL --> SI[Sign In]
        WL --> SU[Sign Up]
    end

    subgraph "Onboarding"
        PR[Preferences]
    end

    subgraph "Tab Navigator"
        HM[Home / Explore]
        TR[My Trips]
        PRF[Profile]
        EXP[Explore Places]
    end

    subgraph "Stack Screens"
        GF[Trip Form]
        GL[Loading Screen]
        TD[Trip Detail]
        DY[Day Detail]
        MP[Map View]
        ED[Edit Trip]
    end

    SI --> PR
    SU --> PR
    PR --> HM

    HM --> GF
    GF --> GL
    GL --> TD
    TD --> DY
    TD --> MP
    TD --> ED
    TR --> TD
    EXP --> TD
```

### Screen Descriptions

| Screen | Route | Purpose |
|--------|-------|---------|
| **Splash** | `/` | Branded splash with destination image |
| **Welcome** | `/(auth)/welcome` | "Your next adventure starts here" + sign-in options |
| **Sign In** | `/(auth)/sign-in` | Email/password or Google sign-in |
| **Sign Up** | `/(auth)/sign-up` | New account creation |
| **Preferences** | `/(onboarding)/preferences` | Trip style, budget, interests selection |
| **Home** | `/(tabs)/` | Search bar, categories, destination cards, "Generate" CTA |
| **Trip Form** | `/generate/` | Destination, days, travelers, budget → "Generate My Trip" |
| **Loading** | `/generate/loading` | Animated progress: "Researching destination...", "Planning itinerary...", "Finalizing..." |
| **Trip Detail** | `/trip/[id]/` | Day-by-day itinerary, weather, map preview, highlights |
| **Day Detail** | `/trip/[id]/day/[day]` | Single day's activities with times |
| **Map View** | `/trip/[id]/map` | Interactive map with all activity pins |
| **Edit Trip** | `/trip/[id]/edit` | Modify activities, add/remove days (triggers AI re-gen) |
| **My Trips** | `/(tabs)/trips` | Grid of saved trips organized by status |
| **Profile** | `/(tabs)/profile` | Stats, subscription, settings, logout |
| **Explore** | `/(tabs)/explore` | Search places with filters |

---

## Authentication & Authorization

### Auth Providers
- **Email + Password** (via Clerk)
- **Google OAuth** (via Clerk)
- Apple sign-in deferred to v2

### Auth Flow
```mermaid
flowchart LR
    A[ClerkProvider wraps root] --> B{Session exists?}
    B -->|No| C[Redirect to Welcome]
    B -->|Yes| D[Redirect to Home]
    C --> E[User signs up/in]
    E --> F[Clerk webhook: user.created]
    F --> G[Backend creates user row]
    G --> D
```

### Authorization Matrix
| Resource | Free User | Premium User | Public |
|----------|-----------|--------------|--------|
| View own trips | ✅ | ✅ | ❌ |
| Generate trip (up to 3) | ✅ | ✅ | ❌ |
| Generate trip (after 3) | ❌ | ✅ | ❌ |
| View maps | ❌ | ✅ | ❌ |
| Weather data | ❌ | ✅ | ❌ |
| Activity images | ❌ | ✅ | ❌ |
| Full itinerary detail | Basic | Full | ❌ |
| PDF export | ❌ | ✅ | ❌ |
| View shared trip | ✅ | ✅ | ✅ |
| Upgrade to Premium | ✅ | N/A | ❌ |

---

## Payment Architecture

### Dual Payment System

```mermaid
graph TB
    subgraph "Android"
        A[User taps Subscribe]
        B[Razorpay Checkout]
        C[Verify Signature]
        D[Update DB: premium]
        A --> B --> C --> D
    end

    subgraph "iOS"
        E[User taps Subscribe]
        F[StoreKit Sheet]
        G[Send Receipt to Backend]
        H[Apple Verification]
        I[Update DB: premium]
        E --> F --> G --> H --> I
    end

    subgraph "Database"
        J[(users.subscription_tier)]
        K[(subscriptions table)]
        D --> J
        D --> K
        I --> J
        I --> K
    end

    subgraph "Future"
        L[Stripe Web]
        M[Lemon Squeezy]
        L --> J
        M --> J
    end
```

### Subscription Model
- **Monthly**: ₹299/mo (Razorpay Android) / equivalent StoreKit price
- **Yearly**: ₹2,999/yr (future)
- Single source of truth: `users.subscription_tier` in Neon DB
- Both payment providers update the same field
- `subscriptions` table tracks provider-specific IDs for portability

---

## Background Jobs (Inngest)

### generate-trip Function
```mermaid
flowchart TD
    A[Event: trip/generate.requested] --> B[Step 1: Fetch Trip]
    B --> C[Step 2: Check User Tier]
    C --> D[Step 3: Generate Itinerary via Gemini]
    D --> E[Step 4: Loop Days]
    E --> F[Get Weather]
    F --> G[Loop Activities]
    G --> H[Generate Keywords via Gemini]
    H --> I[Search Unsplash]
    I --> J[Upload to ImageKit]
    J --> G
    G --> K[Save Activities to DB]
    K --> L[Save Day to DB]
    L --> E
    E --> M[Step 5: Mark Trip Ready]
    M --> N[Step 6: Increment Count]
    N --> O[Done]
```

### Error Handling Strategy
| Failure Mode | Behavior |
|---|---|
| Gemini API timeout/error | Set trip status = `failed`, show "Retry Generation" |
| Unsplash API down | Skip images for affected activities (use placeholder) |
| OpenWeatherMap down | Skip weather data for all days |
| ImageKit upload failure | Use raw Unsplash URL as fallback |
| User closes app mid-gen | Continue in background; trip appears when user returns |
| Free tier exceeded | Return 403 "Upgrade required" before job starts |

---

## Integrations

### Environment Variables
All 12 services are configured via `.env.local`:

```
# Clerk (Authentication)
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx

# Neon (PostgreSQL)
DATABASE_URL=postgresql://user:password@host/db

# Gemini (AI)
GEMINI_API_KEY=your_gemini_api_key

# Unsplash (Images)
UNSPLASH_ACCESS_KEY=your_unsplash_access_key
UNSPLASH_SECRET_KEY=your_unsplash_secret_key

# Inngest (Background Jobs)
INNGEST_EVENT_KEY=your_inngest_event_key
INNGEST_SIGNING_KEY=your_inngest_signing_key

# ImageKit (Image Optimization)
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your_id/
IMAGEKIT_PUBLIC_KEY=public_xxx
IMAGEKIT_PRIVATE_KEY=private_xxx

# Sentry (Error Monitoring)
SENTRY_DSN=https://xxx@sentry.io/xxx
SENTRY_AUTH_TOKEN=your_sentry_auth_token

# OpenWeatherMap (Weather)
OPENWEATHERMAP_API_KEY=your_openweathermap_api_key

# Razorpay (Payments - Android)
RAZORPAY_KEY_ID=rzp_test_xxx
RAZORPAY_KEY_SECRET=your_razorpay_secret
```

---

## Environments

| Environment | Backend | Database | Clerk | Payments |
|---|---|---|---|---|
| **Local** | `localhost:3001` | Neon dev branch | Test instance | Test keys |
| **Staging** | Railway staging | Neon staging | Staging instance | Test keys |
| **Production** | Railway prod | Neon prod | Production | Live keys |

---

## CI/CD Pipeline

```mermaid
flowchart LR
    A[Push to main] --> B[GitHub Actions]
    B --> C{Lint & TypeCheck}
    C -->|Pass| D[EAS Build]
    C -->|Fail| E[Block PR]
    D --> F[Deploy Backend to Railway]
    D --> G[Build iOS + Android binaries]
    F --> H[Staging Environment]
    G --> I[TestFlight / Play Console]
```

---

## Getting Started

### Prerequisites
- Node.js 20+
- Expo CLI (`npm install -g expo-cli`)
- Expo Go app on your phone (or emulator)
- All 12 API keys configured (see [Integrations](#integrations))

### Local Development

```bash
# 1. Install frontend dependencies
npm install

# 2. Install backend dependencies
cd backend && npm install && cd ..

# 3. Run database migrations
cd backend && npx tsx src/db/migrate.ts && cd ..

# 4. Start backend server (in one terminal)
cd backend && npm run dev

# 5. Start Expo app (in another terminal)
npx expo start

# 6. Scan QR code with Expo Go
```

### Backend API
The backend runs on `http://localhost:3001`. Health check: `GET /health`

---

## Future Roadmap

### v2 (Planned)
- **Collaborative trips**: Multiple users editing the same itinerary
- **AI travel assistant**: Real-time chat with AI about your trip
- **Offline mode**: Local SQLite cache for viewing trips without internet
- **Web version**: Shared React components via React Native Web
- **Social features**: Public trip profiles, following users, trip likes
- **Yearly subscription plan**: Discounted annual pricing
- **Stripe / Lemon Squeezy**: Expand payment providers for global markets
- **Deep linking**: Share trip links that open directly in the app
- **Apple Sign-In**: Additional auth provider for iOS

### v3 (Stretch)
- **Booking integration**: Direct hotel/flight booking via affiliate APIs
- **Community itineraries**: Browse and copy public itineraries
- **Trip journal**: Add notes and photos during the trip
- **Flight/hotel price tracking**: Alerts when prices drop
- **Multi-language support**: i18n for major languages
- **Accessibility**: Full VoiceOver/TalkBack support

---

## Repository

- **GitHub**: https://github.com/yuv9799/TriplyAI
- **License**: MIT

---

<div align="center">
  <p>Built with ❤️ using Expo, Node.js, Gemini AI, and Neon PostgreSQL</p>
</div>