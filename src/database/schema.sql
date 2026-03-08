-- Transport API Database Schema
-- Requires PostGIS extension

CREATE EXTENSION IF NOT EXISTS postgis;

-- Drop tables in dependency order before recreating
DROP TABLE IF EXISTS travel_times CASCADE;
DROP TABLE IF EXISTS route_stations CASCADE;
DROP TABLE IF EXISTS stations CASCADE;
DROP TABLE IF EXISTS routes CASCADE;
DROP TABLE IF EXISTS transport_types CASCADE;

-- Transport types
CREATE TABLE IF NOT EXISTS transport_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

-- Stations with PostGIS geometry
CREATE TABLE IF NOT EXISTS stations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    transport_type_id INTEGER NOT NULL REFERENCES transport_types(id) ON DELETE CASCADE,
    lat DOUBLE PRECISION NOT NULL,
    lon DOUBLE PRECISION NOT NULL,
    quartier VARCHAR(255),
    geom GEOMETRY(Point, 4326),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Routes
CREATE TABLE IF NOT EXISTS routes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    transport_type_id INTEGER NOT NULL REFERENCES transport_types(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Route stations (ordered stops along a route)
CREATE TABLE IF NOT EXISTS route_stations (
    id SERIAL PRIMARY KEY,
    route_id INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    station_order INTEGER NOT NULL,
    UNIQUE(route_id, station_id),
    UNIQUE(route_id, station_order)
);

-- Travel times between consecutive stations on a route
CREATE TABLE IF NOT EXISTS travel_times (
    id SERIAL PRIMARY KEY,
    route_id INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    from_station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    to_station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    minutes NUMERIC(6, 2) NOT NULL CHECK (minutes > 0),
    UNIQUE(route_id, from_station_id, to_station_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stations_geom ON stations USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_route_stations_route_id ON route_stations (route_id);
CREATE INDEX IF NOT EXISTS idx_route_stations_station_id ON route_stations (station_id);
CREATE INDEX IF NOT EXISTS idx_travel_times_route_id ON travel_times (route_id);
CREATE INDEX IF NOT EXISTS idx_travel_times_from_station ON travel_times (from_station_id);
CREATE INDEX IF NOT EXISTS idx_travel_times_to_station ON travel_times (to_station_id);
CREATE INDEX IF NOT EXISTS idx_stations_transport_type ON stations (transport_type_id);
CREATE INDEX IF NOT EXISTS idx_routes_transport_type ON routes (transport_type_id);

-- Trigger to auto-populate geom from lat/lon
CREATE OR REPLACE FUNCTION update_station_geom()
RETURNS TRIGGER AS $$
BEGIN
    NEW.geom := ST_SetSRID(ST_MakePoint(NEW.lon, NEW.lat), 4326);
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_station_geom ON stations;
CREATE TRIGGER trg_update_station_geom
    BEFORE INSERT OR UPDATE ON stations
    FOR EACH ROW
    EXECUTE FUNCTION update_station_geom();
