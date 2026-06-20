-- Enable UUID and Crypto generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enum for Slot Status to enforce state machine rules at the DB level
CREATE TYPE slot_status AS ENUM ('AVAILABLE', 'HELD', 'BOOKED');

-- Enums for User Roles and Provider Applications
CREATE TYPE user_role AS ENUM ('USER', 'PROVIDER', 'ADMIN');
CREATE TYPE application_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- Table: Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'USER',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table: Provider Applications
CREATE TABLE provider_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    status application_status NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed Admin User
INSERT INTO users (id, username, password_hash, role)
VALUES (uuid_generate_v4(), 'admin', crypt('admin123', gen_salt('bf')), 'ADMIN');

-- Table: Appointment_Types
CREATE TABLE appointment_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table: Providers
CREATE TABLE providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Association Table: Provider_Appointment_Types
CREATE TABLE provider_appointment_types (
    provider_id UUID NOT NULL REFERENCES providers(id),
    appointment_type_id UUID NOT NULL REFERENCES appointment_types(id),
    PRIMARY KEY (provider_id, appointment_type_id)
);

-- Table: Slots
CREATE TABLE slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL, -- NEW: Tracks who currently owns the lock
    provider_id UUID REFERENCES providers(id),
    appointment_type_id UUID REFERENCES appointment_types(id),
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

CREATE INDEX idx_slots_provider_id ON slots(provider_id);
CREATE INDEX idx_slots_status ON slots(status);
CREATE INDEX idx_slots_start_time ON slots(start_time);
CREATE INDEX idx_pat_provider_id ON provider_appointment_types(provider_id);
CREATE INDEX idx_pat_appt_type_id ON provider_appointment_types(appointment_type_id);