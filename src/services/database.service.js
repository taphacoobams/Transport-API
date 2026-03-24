const db = require('../config/db');

/**
 * Database service — centralised query helpers.
 * Schema: networks / stations / routes / route_stations / travel_times
 */

async function getAllNetworks() {
  const { rows } = await db.query(
    'SELECT id, network_code, name, operator, transport_type FROM networks ORDER BY id'
  );
  return rows;
}

async function getAllStations({ network_id, limit = 100, offset = 0 } = {}) {
  let text = `
    SELECT s.id, s.station_code, s.station_name, s.latitude, s.longitude,
           s.district, s.network_id, n.name AS network_name, n.transport_type
    FROM stations s
    JOIN networks n ON n.id = s.network_id
  `;
  const params = [];
  if (network_id) {
    params.push(network_id);
    text += ` WHERE s.network_id = $${params.length}`;
  }
  text += ' ORDER BY s.id';
  params.push(limit);
  text += ` LIMIT $${params.length}`;
  params.push(offset);
  text += ` OFFSET $${params.length}`;

  const { rows } = await db.query(text, params);
  return rows;
}

async function getStationById(id) {
  const { rows } = await db.query(
    `SELECT s.id, s.station_code, s.station_name, s.latitude, s.longitude,
            s.district, s.network_id, n.name AS network_name, n.transport_type
     FROM stations s
     JOIN networks n ON n.id = s.network_id
     WHERE s.id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function getStationsGeoJSON({ network_id } = {}) {
  let text = `
    SELECT s.id, s.station_code, s.station_name, s.latitude, s.longitude,
           s.district, s.network_id, n.name AS network_name, n.transport_type
    FROM stations s
    JOIN networks n ON n.id = s.network_id
  `;
  const params = [];
  if (network_id) {
    params.push(network_id);
    text += ` WHERE s.network_id = $${params.length}`;
  }
  text += ' ORDER BY s.id';

  const { rows } = await db.query(text, params);
  return rows;
}

async function getAllRoutes({ network_id } = {}) {
  let text = `
    SELECT r.id, r.route_code, r.route_name, r.route_type,
           r.origin_terminal, r.destination_terminal, r.network_id,
           n.name AS network_name, n.transport_type
    FROM routes r
    JOIN networks n ON n.id = r.network_id
  `;
  const params = [];
  if (network_id) {
    params.push(network_id);
    text += ` WHERE r.network_id = $${params.length}`;
  }
  text += ' ORDER BY r.id';

  const { rows } = await db.query(text, params);
  return rows;
}

async function getRouteById(id) {
  const { rows } = await db.query(
    `SELECT r.id, r.route_code, r.route_name, r.route_type,
            r.origin_terminal, r.destination_terminal, r.network_id,
            n.name AS network_name, n.transport_type
     FROM routes r
     JOIN networks n ON n.id = r.network_id
     WHERE r.id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function getRouteStations(routeId) {
  const { rows } = await db.query(
    `SELECT rs.station_order, s.id, s.station_code, s.station_name,
            s.latitude, s.longitude, s.district, s.network_id,
            n.name AS network_name
     FROM route_stations rs
     JOIN stations s ON s.id = rs.station_id
     JOIN networks n ON n.id = s.network_id
     WHERE rs.route_id = $1
     ORDER BY rs.station_order`,
    [routeId]
  );
  return rows;
}

async function getTravelTime(routeId, fromStationId, toStationId) {
  const { rows } = await db.query(
    `SELECT id, route_id, from_station_id, to_station_id, travel_time_minutes
     FROM travel_times
     WHERE route_id = $1 AND from_station_id = $2 AND to_station_id = $3`,
    [routeId, fromStationId, toStationId]
  );
  return rows[0] || null;
}

async function findNearestStations(lat, lon, limit = 5, maxDistanceKm = 10) {
  const { rows } = await db.query(
    `SELECT s.id, s.station_code, s.station_name, s.latitude, s.longitude,
            s.district, s.network_id, n.name AS network_name,
            ST_Distance(s.geom::geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) / 1000.0 AS distance_km
     FROM stations s
     JOIN networks n ON n.id = s.network_id
     WHERE ST_DWithin(s.geom::geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, $4 * 1000)
     ORDER BY s.geom <-> ST_SetSRID(ST_MakePoint($2, $1), 4326)
     LIMIT $3`,
    [lat, lon, limit, maxDistanceKm]
  );
  return rows;
}

async function getRoutesByStation(stationId) {
  const { rows } = await db.query(
    `SELECT DISTINCT r.id, r.route_code, r.route_name, r.route_type,
            r.network_id, n.name AS network_name
     FROM route_stations rs
     JOIN routes r ON r.id = rs.route_id
     JOIN networks n ON n.id = r.network_id
     WHERE rs.station_id = $1
     ORDER BY r.id`,
    [stationId]
  );
  return rows;
}

async function getTravelTimesForRoute(routeId) {
  const { rows } = await db.query(
    `SELECT tt.id, tt.route_id, tt.from_station_id, tt.to_station_id,
            tt.travel_time_minutes,
            fs.station_name AS from_station_name,
            ts.station_name AS to_station_name
     FROM travel_times tt
     JOIN stations fs ON fs.id = tt.from_station_id
     JOIN stations ts ON ts.id = tt.to_station_id
     WHERE tt.route_id = $1
     ORDER BY tt.id`,
    [routeId]
  );
  return rows;
}

module.exports = {
  getAllNetworks,
  getAllStations,
  getStationById,
  getStationsGeoJSON,
  getAllRoutes,
  getRouteById,
  getRouteStations,
  getTravelTime,
  findNearestStations,
  getRoutesByStation,
  getTravelTimesForRoute,
};
