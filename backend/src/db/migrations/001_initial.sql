-- Triply Database Schema v1
-- Migration 001: Initial tables

-- Users table (mirrors Clerk users + app-level fields)
CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email         TEXT,
    name          TEXT,
    avatar_url    TEXT,
    subscription_tier TEXT NOT NULL DEFAULT 'free',
    razorpay_customer_id TEXT UNIQUE,
    generation_count INTEGER NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Destinations
CREATE TABLE IF NOT EXISTS destinations (
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
CREATE TABLE IF NOT EXISTS trips (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    destination_id  UUID NOT NULL REFERENCES destinations(id),
    title           TEXT,
    status          TEXT NOT NULL DEFAULT 'generating',
    total_days      INTEGER NOT NULL,
    travelers       INTEGER NOT NULL,
    budget          TEXT,
    total_cost_estimate DECIMAL(10,2),
    is_public       BOOLEAN DEFAULT false,
    share_token     TEXT UNIQUE,
    error_message   TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Days
CREATE TABLE IF NOT EXISTS days (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id         UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    day_number      INTEGER NOT NULL,
    date            DATE,
    weather_summary TEXT,
    weather_icon    TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(trip_id, day_number)
);

-- Activities
CREATE TABLE IF NOT EXISTS activities (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day_id          UUID NOT NULL REFERENCES days(id) ON DELETE CASCADE,
    type            TEXT NOT NULL CHECK (type IN ('hotel', 'restaurant', 'attraction', 'transport')),
    name            TEXT NOT NULL,
    description     TEXT,
    start_time      TIME,
    end_time        TIME,
    cost_estimate   DECIMAL(10,2),
    latitude        DOUBLE PRECISION,
    longitude       DOUBLE PRECISION,
    unsplash_image_url TEXT,
    imagekit_url    TEXT,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Subscriptions (tracks payment provider subscription state)
CREATE TABLE IF NOT EXISTS subscriptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider        TEXT NOT NULL CHECK (provider IN ('razorpay', 'storekit', 'stripe', 'lemon_squeezy')),
    provider_subscription_id TEXT,
    provider_customer_id TEXT,
    status          TEXT NOT NULL,
    plan_type       TEXT NOT NULL DEFAULT 'monthly',
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trips_user_id ON trips(user_id);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
CREATE INDEX IF NOT EXISTS idx_trips_share_token ON trips(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_days_trip_id ON days(trip_id);
CREATE INDEX IF NOT EXISTS idx_activities_day_id ON activities(day_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_user_provider ON subscriptions(user_id, provider);