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
    DROP TABLE IF EXISTS transfer_edges CASCADE;
    DROP TABLE IF EXISTS transport_edges CASCADE;
    DROP TABLE IF EXISTS travel_times CASCADE;
    DROP TABLE IF EXISTS route_stations CASCADE;
    DROP TABLE IF EXISTS routes CASCADE;
    DROP TABLE IF EXISTS stations CASCADE;
    DROP TABLE IF EXISTS transport_types CASCADE;

    -- Transport types
    CREATE TABLE transport_types (
      transport_type_id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      description TEXT
    );

    -- Stations
    CREATE TABLE stations (
      station_id VARCHAR(255) PRIMARY KEY,
      station_name VARCHAR(255) NOT NULL,
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      transport_network VARCHAR(100) NOT NULL,
      transport_type_id INTEGER REFERENCES transport_types(transport_type_id) ON DELETE SET NULL
    );

    -- Routes
    CREATE TABLE routes (
      route_id VARCHAR(255) PRIMARY KEY,
      route_name VARCHAR(255) NOT NULL,
      transport_network VARCHAR(100) NOT NULL,
      transport_type_id INTEGER REFERENCES transport_types(transport_type_id) ON DELETE SET NULL,
      origin_terminal VARCHAR(255),
      destination_terminal VARCHAR(255)
    );

    -- Route stations (ordered stops)
    CREATE TABLE route_stations (
      id SERIAL PRIMARY KEY,
      route_id VARCHAR(255) NOT NULL REFERENCES routes(route_id) ON DELETE CASCADE,
      station_id VARCHAR(255) NOT NULL REFERENCES stations(station_id) ON DELETE CASCADE,
      station_order INTEGER NOT NULL
    );

    -- Travel times between consecutive stations on a route
    CREATE TABLE travel_times (
      id SERIAL PRIMARY KEY,
      route_id VARCHAR(255) NOT NULL REFERENCES routes(route_id) ON DELETE CASCADE,
      from_station VARCHAR(255) NOT NULL REFERENCES stations(station_id) ON DELETE CASCADE,
      to_station VARCHAR(255) NOT NULL REFERENCES stations(station_id) ON DELETE CASCADE,
      travel_time_minutes DOUBLE PRECISION NOT NULL
    );

    -- Transport edges (consecutive stations on a route)
    CREATE TABLE transport_edges (
      id SERIAL PRIMARY KEY,
      from_station VARCHAR(255) NOT NULL REFERENCES stations(station_id) ON DELETE CASCADE,
      to_station VARCHAR(255) NOT NULL REFERENCES stations(station_id) ON DELETE CASCADE,
      route_id VARCHAR(255) NOT NULL REFERENCES routes(route_id) ON DELETE CASCADE,
      travel_time_minutes DOUBLE PRECISION DEFAULT 0
    );

    -- Transfer edges (walking connections between networks)
    CREATE TABLE transfer_edges (
      id SERIAL PRIMARY KEY,
      from_station VARCHAR(255) NOT NULL REFERENCES stations(station_id) ON DELETE CASCADE,
      to_station VARCHAR(255) NOT NULL REFERENCES stations(station_id) ON DELETE CASCADE,
      distance_meters DOUBLE PRECISION NOT NULL,
      walking_time_minutes DOUBLE PRECISION NOT NULL
    );

    -- Indexes
    CREATE INDEX idx_route_stations_route ON route_stations(route_id);
    CREATE INDEX idx_route_stations_station ON route_stations(station_id);
    CREATE INDEX idx_travel_times_route ON travel_times(route_id);
    CREATE INDEX idx_travel_times_from ON travel_times(from_station);
    CREATE INDEX idx_travel_times_to ON travel_times(to_station);
    CREATE INDEX idx_transport_edges_from ON transport_edges(from_station);
    CREATE INDEX idx_transport_edges_to ON transport_edges(to_station);
    CREATE INDEX idx_transport_edges_route ON transport_edges(route_id);
    CREATE INDEX idx_transfer_edges_from ON transfer_edges(from_station);
    CREATE INDEX idx_transfer_edges_to ON transfer_edges(to_station);
    CREATE INDEX idx_stations_network ON stations(transport_network);
    CREATE INDEX idx_stations_coords ON stations(latitude, longitude);
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
