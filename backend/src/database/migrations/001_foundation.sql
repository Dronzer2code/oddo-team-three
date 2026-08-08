-- ============================================================
-- RideSync — Migration 001: Foundation
-- Organizations, settings, users, invitations, vehicles.
-- Adapted from the project's draft foundation schema:
--   * PostGIS dropped (corridor matching is plain lat/lng maths;
--     the platform does not do real-time geo tracking in the MVP).
--   * gen_random_uuid() is core in PostgreSQL 13+, so pgcrypto is
--     no longer required.
--   * Account statuses extended to the four states the product
--     specification requires (pending/active/suspended/deactivated).
--   * Vehicle statuses aligned with the specification
--     (active/inactive/under_review).
-- ============================================================

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE organization_status AS ENUM ('active', 'suspended');

CREATE TYPE user_role AS ENUM ('admin', 'employee');

CREATE TYPE account_status AS ENUM ('pending', 'active', 'suspended', 'deactivated');

CREATE TYPE vehicle_status AS ENUM ('active', 'inactive', 'under_review');

CREATE TYPE vehicle_type AS ENUM ('hatchback', 'sedan', 'suv', 'van', 'bike');

CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'canceled', 'expired');

CREATE TYPE distance_unit AS ENUM ('km', 'mi');

-- ============================================================
-- ORGANIZATIONS
-- ============================================================

CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(150) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    status organization_status NOT NULL DEFAULT 'active',

    logo_url VARCHAR(500),
    contact_email VARCHAR(320),
    contact_phone VARCHAR(30),
    address VARCHAR(300),

    timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    distance_unit distance_unit NOT NULL DEFAULT 'km',
    carpooling_enabled BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT organizations_name_not_blank CHECK (length(trim(name)) > 0),
    CONSTRAINT organizations_slug_not_blank CHECK (length(trim(slug)) > 0),
    CONSTRAINT organizations_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    CONSTRAINT organizations_slug_unique UNIQUE (slug)
);

-- ============================================================
-- ORGANIZATION SETTINGS (operational configuration)
-- ============================================================

CREATE TABLE org_settings (
    organization_id UUID PRIMARY KEY
        REFERENCES organizations(id) ON DELETE CASCADE,

    fuel_cost_per_litre NUMERIC(10,2) NOT NULL DEFAULT 0,
    travel_cost_per_km NUMERIC(10,2) NOT NULL DEFAULT 0,
    default_mileage_kmpl NUMERIC(6,2) NOT NULL DEFAULT 12.00,

    max_detour_minutes INTEGER NOT NULL DEFAULT 15,
    corridor_radius_m INTEGER NOT NULL DEFAULT 1000,

    vehicle_approval_required BOOLEAN NOT NULL DEFAULT TRUE,
    ride_approval_required BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT org_settings_fuel_cost_nonnegative CHECK (fuel_cost_per_litre >= 0),
    CONSTRAINT org_settings_travel_cost_nonnegative CHECK (travel_cost_per_km >= 0),
    CONSTRAINT org_settings_mileage_positive CHECK (default_mileage_kmpl > 0),
    CONSTRAINT org_settings_detour_nonnegative CHECK (max_detour_minutes >= 0),
    CONSTRAINT org_settings_corridor_radius_positive CHECK (corridor_radius_m > 0)
);

-- ============================================================
-- USERS (admins and employees live in one table; role separates them)
-- ============================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID NOT NULL
        REFERENCES organizations(id) ON DELETE RESTRICT,

    name VARCHAR(150) NOT NULL,
    email VARCHAR(320) NOT NULL,
    phone VARCHAR(30),

    password_hash TEXT NOT NULL,

    role user_role NOT NULL DEFAULT 'employee',
    status account_status NOT NULL DEFAULT 'pending',

    employee_code VARCHAR(40),
    department VARCHAR(80),
    home_location VARCHAR(200),
    work_location VARCHAR(200),

    last_activity_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT users_name_not_blank CHECK (length(trim(name)) > 0),
    CONSTRAINT users_email_not_blank CHECK (length(trim(email)) > 0)
);

-- Referenced by every organization-scoped child table so that a child row
-- can never point at a parent belonging to a different organization.
ALTER TABLE users
    ADD CONSTRAINT users_organization_id_id_unique UNIQUE (organization_id, id);

CREATE UNIQUE INDEX users_email_unique ON users (lower(email));
CREATE INDEX users_organization_id_idx ON users (organization_id);
CREATE INDEX users_organization_role_idx ON users (organization_id, role);
CREATE UNIQUE INDEX users_employee_code_unique
    ON users (organization_id, upper(employee_code))
    WHERE employee_code IS NOT NULL;

-- ============================================================
-- INVITATIONS (organization-controlled onboarding)
-- ============================================================

CREATE TABLE invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID NOT NULL
        REFERENCES organizations(id) ON DELETE CASCADE,

    email VARCHAR(320) NOT NULL,
    name VARCHAR(150) NOT NULL,
    employee_code VARCHAR(40),
    department VARCHAR(80),

    token VARCHAR(128) NOT NULL,
    status invitation_status NOT NULL DEFAULT 'pending',

    invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
    accepted_user_id UUID REFERENCES users(id) ON DELETE SET NULL,

    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT invitations_token_unique UNIQUE (token)
);

CREATE UNIQUE INDEX invitations_pending_email_unique
    ON invitations (organization_id, lower(email))
    WHERE status = 'pending';

CREATE INDEX invitations_organization_idx ON invitations (organization_id, status);

-- ============================================================
-- VEHICLES
-- ============================================================

CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID NOT NULL
        REFERENCES organizations(id) ON DELETE RESTRICT,

    owner_id UUID NOT NULL,

    make VARCHAR(80) NOT NULL,
    model VARCHAR(80) NOT NULL,
    registration_number VARCHAR(30) NOT NULL,
    vehicle_type vehicle_type NOT NULL DEFAULT 'sedan',
    color VARCHAR(40),

    seating_capacity INTEGER NOT NULL,

    status vehicle_status NOT NULL DEFAULT 'under_review',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT vehicles_make_not_blank CHECK (length(trim(make)) > 0),
    CONSTRAINT vehicles_model_not_blank CHECK (length(trim(model)) > 0),
    CONSTRAINT vehicles_registration_not_blank CHECK (length(trim(registration_number)) > 0),
    CONSTRAINT vehicles_seating_capacity_valid CHECK (seating_capacity BETWEEN 1 AND 50)
);

ALTER TABLE vehicles
    ADD CONSTRAINT vehicles_owner_same_organization_fk
    FOREIGN KEY (organization_id, owner_id)
    REFERENCES users (organization_id, id)
    ON DELETE RESTRICT;

ALTER TABLE vehicles
    ADD CONSTRAINT vehicles_organization_id_id_unique UNIQUE (organization_id, id);

-- Registration numbers are unique per organization, case-insensitively.
CREATE UNIQUE INDEX vehicles_registration_number_unique
    ON vehicles (organization_id, upper(registration_number));
CREATE INDEX vehicles_organization_id_idx ON vehicles (organization_id);
CREATE INDEX vehicles_owner_id_idx ON vehicles (owner_id);
CREATE INDEX vehicles_status_idx ON vehicles (status);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER organizations_set_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER org_settings_set_updated_at
    BEFORE UPDATE ON org_settings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER users_set_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER invitations_set_updated_at
    BEFORE UPDATE ON invitations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER vehicles_set_updated_at
    BEFORE UPDATE ON vehicles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
