-- ============================================================================
-- TRANSPORT API - SCHÉMA COMPLET PostgreSQL
-- Système de transport multimodal (DDD, BRT, TER)
-- ============================================================================

-- Suppression des tables existantes (ordre inverse des dépendances)
DROP TABLE IF EXISTS operating_hours CASCADE;
DROP TABLE IF EXISTS fares CASCADE;
DROP TABLE IF EXISTS zone_stations CASCADE;
DROP TABLE IF EXISTS zones CASCADE;
DROP TABLE IF EXISTS transfer_edges CASCADE;
DROP TABLE IF EXISTS transport_edges CASCADE;
DROP TABLE IF EXISTS travel_times CASCADE;
DROP TABLE IF EXISTS route_stations CASCADE;
DROP TABLE IF EXISTS routes CASCADE;
DROP TABLE IF EXISTS stations CASCADE;
DROP TABLE IF EXISTS networks CASCADE;

-- ============================================================================
-- 1. NETWORKS
-- ============================================================================
CREATE TABLE networks (
    id SERIAL PRIMARY KEY,
    network_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    operator VARCHAR(255),
    transport_type VARCHAR(100),
    corridor_length_km DECIMAL(10, 2),
    total_stations INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 2. STATIONS
-- ============================================================================
CREATE TABLE stations (
    id SERIAL PRIMARY KEY,
    station_code VARCHAR(255) UNIQUE NOT NULL,
    station_name VARCHAR(255) NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    network_id INTEGER NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
    district VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_stations_network_id ON stations(network_id);
CREATE INDEX idx_stations_coords ON stations(latitude, longitude);

-- ============================================================================
-- 3. ROUTES
-- ============================================================================
CREATE TABLE routes (
    id SERIAL PRIMARY KEY,
    route_code VARCHAR(255) UNIQUE NOT NULL,
    route_name VARCHAR(255) NOT NULL,
    network_id INTEGER NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
    route_type VARCHAR(100),
    description TEXT,
    origin_terminal VARCHAR(255),
    destination_terminal VARCHAR(255),
    station_count INTEGER DEFAULT 0,
    total_distance_km DECIMAL(10, 2),
    estimated_duration_min INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_routes_network_id ON routes(network_id);

-- ============================================================================
-- 4. ROUTE_STATIONS
-- ============================================================================
CREATE TABLE route_stations (
    id SERIAL PRIMARY KEY,
    route_id INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    station_order INTEGER NOT NULL,
    UNIQUE(route_id, station_id),
    UNIQUE(route_id, station_order)
);

CREATE INDEX idx_route_stations_route_id ON route_stations(route_id);
CREATE INDEX idx_route_stations_station_id ON route_stations(station_id);

-- ============================================================================
-- 5. TRAVEL_TIMES
-- ============================================================================
CREATE TABLE travel_times (
    id SERIAL PRIMARY KEY,
    route_id INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    from_station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    to_station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    travel_time_minutes DECIMAL(6, 2) NOT NULL,
    UNIQUE(route_id, from_station_id, to_station_id)
);

CREATE INDEX idx_travel_times_route_id ON travel_times(route_id);
CREATE INDEX idx_travel_times_from ON travel_times(from_station_id);
CREATE INDEX idx_travel_times_to ON travel_times(to_station_id);

-- ============================================================================
-- 6. TRANSPORT_EDGES
-- ============================================================================
CREATE TABLE transport_edges (
    id SERIAL PRIMARY KEY,
    from_station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    to_station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    route_id INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    travel_time_minutes DECIMAL(6, 2) DEFAULT 0,
    UNIQUE(from_station_id, to_station_id, route_id)
);

CREATE INDEX idx_transport_edges_from ON transport_edges(from_station_id);
CREATE INDEX idx_transport_edges_to ON transport_edges(to_station_id);
CREATE INDEX idx_transport_edges_route ON transport_edges(route_id);

-- ============================================================================
-- 7. TRANSFER_EDGES
-- ============================================================================
CREATE TABLE transfer_edges (
    id SERIAL PRIMARY KEY,
    from_station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    to_station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    distance_meters DECIMAL(10, 2) NOT NULL,
    walking_time_minutes DECIMAL(6, 2) NOT NULL,
    connection_type VARCHAR(50) DEFAULT 'walking',
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(from_station_id, to_station_id)
);

CREATE INDEX idx_transfer_edges_from ON transfer_edges(from_station_id);
CREATE INDEX idx_transfer_edges_to ON transfer_edges(to_station_id);

-- ============================================================================
-- 8. ZONES
-- ============================================================================
CREATE TABLE zones (
    id SERIAL PRIMARY KEY,
    zone_code VARCHAR(100) NOT NULL,
    zone_name VARCHAR(255) NOT NULL,
    network_id INTEGER NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
    UNIQUE(zone_code, network_id)
);

CREATE INDEX idx_zones_network_id ON zones(network_id);

-- ============================================================================
-- 9. ZONE_STATIONS
-- ============================================================================
CREATE TABLE zone_stations (
    id SERIAL PRIMARY KEY,
    zone_id INTEGER NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
    station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    UNIQUE(zone_id, station_id)
);

CREATE INDEX idx_zone_stations_zone_id ON zone_stations(zone_id);
CREATE INDEX idx_zone_stations_station_id ON zone_stations(station_id);

-- ============================================================================
-- 10. FARES
-- ============================================================================
CREATE TABLE fares (
    id SERIAL PRIMARY KEY,
    network_id INTEGER NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
    zones_travelled VARCHAR(50) NOT NULL,
    price_fcfa INTEGER NOT NULL,
    UNIQUE(network_id, zones_travelled)
);

CREATE INDEX idx_fares_network_id ON fares(network_id);

-- ============================================================================
-- 11. OPERATING_HOURS
-- ============================================================================
CREATE TABLE operating_hours (
    id SERIAL PRIMARY KEY,
    route_id INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    day_type VARCHAR(100) NOT NULL,
    days TEXT[],
    first_departure VARCHAR(10),
    last_departure VARCHAR(10),
    peak_frequency_minutes INTEGER,
    offpeak_frequency_minutes INTEGER
);

CREATE INDEX idx_operating_hours_route_id ON operating_hours(route_id);

-- ============================================================================
-- TRIGGER: updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_networks_updated_at BEFORE UPDATE ON networks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_stations_updated_at BEFORE UPDATE ON stations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_routes_updated_at BEFORE UPDATE ON routes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
