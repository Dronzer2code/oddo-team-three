-- ============================================================
-- RideSync — Migration 002: Carpool operations
-- Rides, requests, trips, payments, versioned costs, audit log.
-- ============================================================

CREATE TYPE ride_status AS ENUM ('published', 'full', 'in_progress', 'completed', 'canceled');
CREATE TYPE ride_request_status AS ENUM ('pending', 'accepted', 'rejected', 'canceled');
CREATE TYPE trip_status AS ENUM ('in_progress', 'completed', 'canceled');
CREATE TYPE trip_role AS ENUM ('driver', 'passenger');
CREATE TYPE payment_status AS ENUM ('pending', 'settled', 'waived');
CREATE TYPE cost_config_type AS ENUM ('fuel_price', 'travel_cost');

-- ============================================================
-- COST CONFIGURATIONS (versioned — never overwritten)
-- ============================================================

CREATE TABLE cost_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID NOT NULL
        REFERENCES organizations(id) ON DELETE CASCADE,

    type cost_config_type NOT NULL,
    value NUMERIC(12,2) NOT NULL,
    unit VARCHAR(30) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    mileage_kmpl NUMERIC(6,2),

    effective_from TIMESTAMPTZ NOT NULL,
    effective_until TIMESTAMPTZ,

    note VARCHAR(300),

    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT cost_configurations_value_positive CHECK (value > 0),
    CONSTRAINT cost_configurations_period_valid
        CHECK (effective_until IS NULL OR effective_until > effective_from)
);

CREATE INDEX cost_configurations_lookup_idx
    ON cost_configurations (organization_id, type, effective_from DESC);

-- ============================================================
-- RIDES
-- ============================================================

CREATE TABLE rides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID NOT NULL
        REFERENCES organizations(id) ON DELETE RESTRICT,

    driver_id UUID NOT NULL,
    vehicle_id UUID NOT NULL,

    start_location VARCHAR(200) NOT NULL,
    destination VARCHAR(200) NOT NULL,
    departure_at TIMESTAMPTZ NOT NULL,

    total_seats INTEGER NOT NULL,
    seats_taken INTEGER NOT NULL DEFAULT 0,

    estimated_distance_km NUMERIC(8,2) NOT NULL,
    estimated_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
    cost_per_seat NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency CHAR(3) NOT NULL DEFAULT 'INR',

    notes VARCHAR(500),

    status ride_status NOT NULL DEFAULT 'published',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT rides_start_not_blank CHECK (length(trim(start_location)) > 0),
    CONSTRAINT rides_destination_not_blank CHECK (length(trim(destination)) > 0),
    CONSTRAINT rides_total_seats_valid CHECK (total_seats BETWEEN 1 AND 49),
    CONSTRAINT rides_seats_taken_valid CHECK (seats_taken >= 0 AND seats_taken <= total_seats),
    CONSTRAINT rides_distance_positive CHECK (estimated_distance_km > 0)
);

ALTER TABLE rides
    ADD CONSTRAINT rides_driver_same_organization_fk
    FOREIGN KEY (organization_id, driver_id)
    REFERENCES users (organization_id, id) ON DELETE RESTRICT;

ALTER TABLE rides
    ADD CONSTRAINT rides_vehicle_same_organization_fk
    FOREIGN KEY (organization_id, vehicle_id)
    REFERENCES vehicles (organization_id, id) ON DELETE RESTRICT;

ALTER TABLE rides
    ADD CONSTRAINT rides_organization_id_id_unique UNIQUE (organization_id, id);

CREATE INDEX rides_organization_departure_idx ON rides (organization_id, departure_at);
CREATE INDEX rides_driver_idx ON rides (driver_id);
CREATE INDEX rides_status_idx ON rides (organization_id, status);

-- ============================================================
-- RIDE REQUESTS
-- ============================================================

CREATE TABLE ride_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID NOT NULL,
    ride_id UUID NOT NULL,
    passenger_id UUID NOT NULL,

    seats INTEGER NOT NULL DEFAULT 1,
    status ride_request_status NOT NULL DEFAULT 'pending',
    note VARCHAR(300),

    responded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    responded_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ride_requests_seats_valid CHECK (seats BETWEEN 1 AND 10)
);

ALTER TABLE ride_requests
    ADD CONSTRAINT ride_requests_ride_same_organization_fk
    FOREIGN KEY (organization_id, ride_id)
    REFERENCES rides (organization_id, id) ON DELETE RESTRICT;

ALTER TABLE ride_requests
    ADD CONSTRAINT ride_requests_passenger_same_organization_fk
    FOREIGN KEY (organization_id, passenger_id)
    REFERENCES users (organization_id, id) ON DELETE RESTRICT;

-- One live request per passenger per ride (rejected/canceled may be retried).
CREATE UNIQUE INDEX ride_requests_live_unique
    ON ride_requests (ride_id, passenger_id)
    WHERE status IN ('pending', 'accepted');

CREATE INDEX ride_requests_ride_idx ON ride_requests (ride_id, status);
CREATE INDEX ride_requests_passenger_idx ON ride_requests (passenger_id, status);

-- ============================================================
-- TRIPS (immutable history; vehicle + cost are snapshotted)
-- ============================================================

CREATE TABLE trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID NOT NULL,
    ride_id UUID NOT NULL,
    driver_id UUID NOT NULL,

    start_location VARCHAR(200) NOT NULL,
    destination VARCHAR(200) NOT NULL,

    -- Snapshots: these must never be recomputed from live configuration.
    vehicle_snapshot JSONB NOT NULL,
    cost_snapshot JSONB NOT NULL,
    cost_configuration_id UUID REFERENCES cost_configurations(id) ON DELETE SET NULL,

    distance_km NUMERIC(8,2) NOT NULL DEFAULT 0,
    fuel_consumed_litres NUMERIC(8,2) NOT NULL DEFAULT 0,
    total_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
    cost_per_km NUMERIC(10,2) NOT NULL DEFAULT 0,
    currency CHAR(3) NOT NULL DEFAULT 'INR',

    status trip_status NOT NULL DEFAULT 'in_progress',

    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT trips_distance_nonnegative CHECK (distance_km >= 0),
    CONSTRAINT trips_ride_unique UNIQUE (ride_id)
);

ALTER TABLE trips
    ADD CONSTRAINT trips_ride_same_organization_fk
    FOREIGN KEY (organization_id, ride_id)
    REFERENCES rides (organization_id, id) ON DELETE RESTRICT;

ALTER TABLE trips
    ADD CONSTRAINT trips_driver_same_organization_fk
    FOREIGN KEY (organization_id, driver_id)
    REFERENCES users (organization_id, id) ON DELETE RESTRICT;

ALTER TABLE trips
    ADD CONSTRAINT trips_organization_id_id_unique UNIQUE (organization_id, id);

CREATE INDEX trips_organization_status_idx ON trips (organization_id, status);
CREATE INDEX trips_completed_at_idx ON trips (organization_id, completed_at);
CREATE INDEX trips_driver_idx ON trips (driver_id);

-- ============================================================
-- TRIP PARTICIPANTS
-- ============================================================

CREATE TABLE trip_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID NOT NULL,
    trip_id UUID NOT NULL,
    user_id UUID NOT NULL,

    role trip_role NOT NULL,
    seats INTEGER NOT NULL DEFAULT 1,
    share_amount NUMERIC(12,2) NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT trip_participants_seats_valid CHECK (seats >= 1),
    CONSTRAINT trip_participants_unique UNIQUE (trip_id, user_id)
);

ALTER TABLE trip_participants
    ADD CONSTRAINT trip_participants_trip_same_organization_fk
    FOREIGN KEY (organization_id, trip_id)
    REFERENCES trips (organization_id, id) ON DELETE CASCADE;

ALTER TABLE trip_participants
    ADD CONSTRAINT trip_participants_user_same_organization_fk
    FOREIGN KEY (organization_id, user_id)
    REFERENCES users (organization_id, id) ON DELETE RESTRICT;

CREATE INDEX trip_participants_user_idx ON trip_participants (user_id);
CREATE INDEX trip_participants_trip_idx ON trip_participants (trip_id);

-- ============================================================
-- PAYMENTS (cost sharing between employees)
-- ============================================================

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID NOT NULL,
    trip_id UUID NOT NULL,

    payer_id UUID NOT NULL,
    receiver_id UUID NOT NULL,

    amount NUMERIC(12,2) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    status payment_status NOT NULL DEFAULT 'pending',

    paid_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT payments_amount_nonnegative CHECK (amount >= 0),
    CONSTRAINT payments_parties_differ CHECK (payer_id <> receiver_id)
);

ALTER TABLE payments
    ADD CONSTRAINT payments_trip_same_organization_fk
    FOREIGN KEY (organization_id, trip_id)
    REFERENCES trips (organization_id, id) ON DELETE RESTRICT;

CREATE INDEX payments_payer_idx ON payments (payer_id, status);
CREATE INDEX payments_receiver_idx ON payments (receiver_id, status);
CREATE INDEX payments_organization_idx ON payments (organization_id);

-- ============================================================
-- AUDIT LOG
-- ============================================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID NOT NULL
        REFERENCES organizations(id) ON DELETE CASCADE,

    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    actor_name VARCHAR(150) NOT NULL,

    action VARCHAR(80) NOT NULL,
    entity_type VARCHAR(40) NOT NULL,
    entity_id VARCHAR(80),

    previous_values JSONB,
    new_values JSONB,
    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX audit_logs_organization_created_idx ON audit_logs (organization_id, created_at DESC);
CREATE INDEX audit_logs_entity_idx ON audit_logs (organization_id, entity_type, entity_id);
CREATE INDEX audit_logs_action_idx ON audit_logs (organization_id, action);

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE TRIGGER cost_configurations_set_updated_at
    BEFORE UPDATE ON cost_configurations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER rides_set_updated_at
    BEFORE UPDATE ON rides
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER ride_requests_set_updated_at
    BEFORE UPDATE ON ride_requests
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trips_set_updated_at
    BEFORE UPDATE ON trips
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER payments_set_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
