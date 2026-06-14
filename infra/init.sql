-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum for Slot Status to enforce state machine rules at the DB level
CREATE TYPE slot_status AS ENUM ('AVAILABLE', 'HELD', 'BOOKED');

-- Table: Slots
CREATE TABLE slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id VARCHAR(255), -- NEW: Tracks who currently owns the lock
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status slot_status NOT NULL DEFAULT 'AVAILABLE',
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

CREATE INDEX idx_slots_status_time ON slots(status, start_time);

-- Table: Idempotency_Keys
CREATE TABLE idempotency_keys (
    key VARCHAR(255) PRIMARY KEY,
    locked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    response_code INTEGER,
    response_body JSONB,
    status VARCHAR(50) NOT NULL CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'FAILED')),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_idempotency_expires ON idempotency_keys(expires_at);