const db = require('../config/db');

/**
 * Database service — centralised query helpers.
 */

async function getAllTransportTypes() {
  const { rows } = await db.query('SELECT id, name FROM transport_types ORDER BY id');
  return rows;
}

async function getAllStations({ transport_type_id, limit = 100, offset = 0 } = {}) {
  let text = `
    SELECT s.id, s.name, s.lat, s.lon, s.quartier, s.transport_type_id,
           t.name AS transport_type_name
    FROM stations s
    JOIN transport_types t ON t.id = s.transport_type_id
  `;
  const params = [];
  if (transport_type_id) {
    params.push(transport_type_id);
    text += ` WHERE s.transport_type_id = $${params.length}`;
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
    `SELECT s.id, s.name, s.lat, s.lon, s.quartier, s.transport_type_id,
            t.name AS transport_type_name
     FROM stations s
     JOIN transport_types t ON t.id = s.transport_type_id
     WHERE s.id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function getStationsGeoJSON({ transport_type_id } = {}) {
  let text = `
    SELECT s.id, s.name, s.lat, s.lon, s.quartier, s.transport_type_id,
           t.name AS transport_type_name
    FROM stations s
    JOIN transport_types t ON t.id = s.transport_type_id
  `;
  const params = [];
  if (transport_type_id) {
    params.push(transport_type_id);
    text += ` WHERE s.transport_type_id = $${params.length}`;
  }
  text += ' ORDER BY s.id';

  const { rows } = await db.query(text, params);
  return rows;
}

async function getAllRoutes({ transport_type_id } = {}) {
  let text = `
    SELECT r.id, r.name, r.transport_type_id,
           t.name AS transport_type_name
    FROM routes r
    JOIN transport_types t ON t.id = r.transport_type_id
  `;
  const params = [];
  if (transport_type_id) {
    params.push(transport_type_id);
    text += ` WHERE r.transport_type_id = $${params.length}`;
  }
  text += ' ORDER BY r.id';

  const { rows } = await db.query(text, params);
  return rows;
}

async function getRouteById(id) {
  const { rows } = await db.query(
    `SELECT r.id, r.name, r.transport_type_id,
            t.name AS transport_type_name
     FROM routes r
     JOIN transport_types t ON t.id = r.transport_type_id
     WHERE r.id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function getRouteStations(routeId) {
  const { rows } = await db.query(
    `SELECT rs.station_order, s.id, s.name, s.lat, s.lon, s.quartier,
            s.transport_type_id, t.name AS transport_type_name
     FROM route_stations rs
     JOIN stations s ON s.id = rs.station_id
     JOIN transport_types t ON t.id = s.transport_type_id
     WHERE rs.route_id = $1
     ORDER BY rs.station_order`,
    [routeId]
  );
  return rows;
}

async function getTravelTime(routeId, fromStationId, toStationId) {
  const { rows } = await db.query(
    `SELECT id, route_id, from_station_id, to_station_id, minutes
     FROM travel_times
     WHERE route_id = $1 AND from_station_id = $2 AND to_station_id = $3`,
    [routeId, fromStationId, toStationId]
  );
  return rows[0] || null;
}

async function findNearestStations(lat, lon, limit = 5, maxDistanceKm = 10) {
  const { rows } = await db.query(
    `SELECT s.id, s.name, s.lat, s.lon, s.quartier, s.transport_type_id,
            t.name AS transport_type_name,
            ST_Distance(s.geom::geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) / 1000.0 AS distance_km
     FROM stations s
     JOIN transport_types t ON t.id = s.transport_type_id
     WHERE ST_DWithin(s.geom::geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, $4 * 1000)
     ORDER BY s.geom <-> ST_SetSRID(ST_MakePoint($2, $1), 4326)
     LIMIT $3`,
    [lat, lon, limit, maxDistanceKm]
  );
  return rows;
}

async function getRoutesByStation(stationId) {
  const { rows } = await db.query(
    `SELECT DISTINCT r.id, r.name, r.transport_type_id,
            t.name AS transport_type_name
     FROM route_stations rs
     JOIN routes r ON r.id = rs.route_id
     JOIN transport_types t ON t.id = r.transport_type_id
     WHERE rs.station_id = $1
     ORDER BY r.id`,
    [stationId]
  );
  return rows;
}

async function getTravelTimesForRoute(routeId) {
  const { rows } = await db.query(
    `SELECT tt.id, tt.route_id, tt.from_station_id, tt.to_station_id, tt.minutes,
            fs.name AS from_station_name, ts.name AS to_station_name
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
  getAllTransportTypes,
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
