const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle database client:', err);
  process.exit(-1);
});

async function createSchema() {
  const schema = `
    -- Drop tables in dependency order
    DROP TABLE IF EXISTS connections CASCADE;
    DROP TABLE IF EXISTS zone_stations CASCADE;
    DROP TABLE IF EXISTS zones CASCADE;
    DROP TABLE IF EXISTS fares CASCADE;
    DROP TABLE IF EXISTS operating_hours CASCADE;
    DROP TABLE IF EXISTS transfer_edges CASCADE;
    DROP TABLE IF EXISTS transport_edges CASCADE;
    DROP TABLE IF EXISTS travel_times CASCADE;
    DROP TABLE IF EXISTS route_stations CASCADE;
    DROP TABLE IF EXISTS routes CASCADE;
    DROP TABLE IF EXISTS stations CASCADE;
    DROP TABLE IF EXISTS networks CASCADE;

    -- Networks
    CREATE TABLE networks (
      id SERIAL PRIMARY KEY,
      network_code VARCHAR(50) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      operator VARCHAR(255),
      transport_type VARCHAR(100),
      corridor_length_km DOUBLE PRECISION,
      total_stations INTEGER
    );

    -- Stations
    CREATE TABLE stations (
      id SERIAL PRIMARY KEY,
      station_code VARCHAR(255) NOT NULL UNIQUE,
      station_name VARCHAR(255) NOT NULL,
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      network_id INTEGER NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
      district VARCHAR(255)
    );

    -- Routes
    CREATE TABLE routes (
      id SERIAL PRIMARY KEY,
      route_code VARCHAR(255) NOT NULL UNIQUE,
      route_name VARCHAR(255) NOT NULL,
      network_id INTEGER NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
      route_type VARCHAR(100),
      description TEXT,
      origin_terminal VARCHAR(255),
      destination_terminal VARCHAR(255)
    );

    -- Route stations (ordered stops)
    CREATE TABLE route_stations (
      id SERIAL PRIMARY KEY,
      route_id INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
      station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
      station_order INTEGER NOT NULL
    );

    -- Travel times between consecutive stations on a route
    CREATE TABLE travel_times (
      id SERIAL PRIMARY KEY,
      route_id INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
      from_station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
      to_station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
      travel_time_minutes DOUBLE PRECISION NOT NULL
    );

    -- Transport edges (consecutive stations on a route)
    CREATE TABLE transport_edges (
      id SERIAL PRIMARY KEY,
      from_station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
      to_station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
      route_id INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
      travel_time_minutes DOUBLE PRECISION DEFAULT 0
    );

    -- Transfer edges (walking connections between networks)
    CREATE TABLE transfer_edges (
      id SERIAL PRIMARY KEY,
      from_station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
      to_station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
      distance_meters DOUBLE PRECISION NOT NULL,
      walking_time_minutes DOUBLE PRECISION NOT NULL
    );

    -- Zones (fare zones)
    CREATE TABLE zones (
      id SERIAL PRIMARY KEY,
      zone_code VARCHAR(100) NOT NULL,
      zone_name VARCHAR(255) NOT NULL,
      network_id INTEGER NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
      UNIQUE(zone_code, network_id)
    );

    -- Zone ↔ Station mapping
    CREATE TABLE zone_stations (
      id SERIAL PRIMARY KEY,
      zone_id INTEGER NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
      station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
      UNIQUE(zone_id, station_id)
    );

    -- Fares
    CREATE TABLE fares (
      id SERIAL PRIMARY KEY,
      network_id INTEGER NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
      zones_travelled VARCHAR(50) NOT NULL,
      price_fcfa INTEGER NOT NULL
    );

    -- Operating hours
    CREATE TABLE operating_hours (
      id SERIAL PRIMARY KEY,
      route_id INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
      day_type VARCHAR(100) NOT NULL,
      days TEXT[],
      first_departure VARCHAR(10),
      last_departure VARCHAR(10),
      peak_time_range VARCHAR(50),
      peak_frequency_minutes INTEGER,
      offpeak_time_range VARCHAR(50),
      offpeak_frequency_minutes INTEGER
    );

    -- Intermodal connections
    CREATE TABLE connections (
      id SERIAL PRIMARY KEY,
      station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
      network_id INTEGER NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
      connected_modes TEXT[] NOT NULL,
      UNIQUE(station_id, network_id)
    );

    -- Indexes
    CREATE INDEX idx_route_stations_route ON route_stations(route_id);
    CREATE INDEX idx_route_stations_station ON route_stations(station_id);
    CREATE INDEX idx_travel_times_route ON travel_times(route_id);
    CREATE INDEX idx_travel_times_from ON travel_times(from_station_id);
    CREATE INDEX idx_travel_times_to ON travel_times(to_station_id);
    CREATE INDEX idx_transport_edges_from ON transport_edges(from_station_id);
    CREATE INDEX idx_transport_edges_to ON transport_edges(to_station_id);
    CREATE INDEX idx_transport_edges_route ON transport_edges(route_id);
    CREATE INDEX idx_transfer_edges_from ON transfer_edges(from_station_id);
    CREATE INDEX idx_transfer_edges_to ON transfer_edges(to_station_id);
    CREATE INDEX idx_stations_network ON stations(network_id);
    CREATE INDEX idx_stations_coords ON stations(latitude, longitude);
    CREATE INDEX idx_zones_network ON zones(network_id);
    CREATE INDEX idx_fares_network ON fares(network_id);
    CREATE INDEX idx_operating_hours_route ON operating_hours(route_id);
    CREATE INDEX idx_connections_station ON connections(station_id);
  `;

  await pool.query(schema);
  console.log('Schema created successfully.');
}

async function query(text, params) {
  return pool.query(text, params);
}

async function end() {
  await pool.end();
}

module.exports = { pool, query, createSchema, end };
