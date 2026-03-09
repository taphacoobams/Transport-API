const db = require('../config/database');
const { haversine } = require('../utils/haversine');

/**
 * Find the nearest station to given coordinates.
 * Computes haversine distance to every station in the database.
 * @param {number} lat
 * @param {number} lon
 * @param {number} limit - max results
 * @returns {Promise<Array>}
 */
async function findNearestStations(lat, lon, limit = 5) {
  const { rows } = await db.query(
    `SELECT station_id, station_name, transport_network, latitude, longitude
     FROM stations
     WHERE latitude != 0 AND longitude != 0`
  );

  const results = rows.map((s) => {
    const dist = haversine(lat, lon, s.latitude, s.longitude);
    return { ...s, distance_meters: Math.round(dist * 100) / 100 };
  });

  results.sort((a, b) => a.distance_meters - b.distance_meters);
  return results.slice(0, limit);
}

/**
 * Get all stations, optionally filtered by network.
 * @param {object} opts
 * @returns {Promise<Array>}
 */
async function getAllStations({ transport_network, limit = 500, offset = 0 } = {}) {
  let text = `
    SELECT s.station_id, s.station_name, s.transport_network, s.latitude, s.longitude,
           s.transport_type_id, t.name AS transport_type_name
    FROM stations s
    LEFT JOIN transport_types t ON t.transport_type_id = s.transport_type_id
  `;
  const params = [];
  if (transport_network) {
    params.push(transport_network.toUpperCase());
    text += ` WHERE UPPER(s.transport_network) = $${params.length}`;
  }
  text += ' ORDER BY s.station_id';
  params.push(limit);
  text += ` LIMIT $${params.length}`;
  params.push(offset);
  text += ` OFFSET $${params.length}`;

  const { rows } = await db.query(text, params);
  return rows;
}

/**
 * Get a single station by station_id.
 */
async function getStationById(stationId) {
  const { rows } = await db.query(
    `SELECT s.station_id, s.station_name, s.transport_network, s.latitude, s.longitude,
            s.transport_type_id, t.name AS transport_type_name
     FROM stations s
     LEFT JOIN transport_types t ON t.transport_type_id = s.transport_type_id
     WHERE s.station_id = $1`,
    [stationId]
  );
  return rows[0] || null;
}

/**
 * Get all routes, optionally filtered by network.
 */
async function getAllRoutes({ transport_network } = {}) {
  let text = `
    SELECT r.route_id, r.route_name, r.transport_network, r.origin_terminal, r.destination_terminal,
           r.transport_type_id, t.name AS transport_type_name
    FROM routes r
    LEFT JOIN transport_types t ON t.transport_type_id = r.transport_type_id
  `;
  const params = [];
  if (transport_network) {
    params.push(transport_network.toUpperCase());
    text += ` WHERE UPPER(r.transport_network) = $${params.length}`;
  }
  text += ' ORDER BY r.route_id';

  const { rows } = await db.query(text, params);
  return rows;
}

/**
 * Get route details including its stations in order.
 */
async function getRouteWithStations(routeId) {
  const { rows: route } = await db.query(
    `SELECT r.route_id, r.route_name, r.transport_network, r.origin_terminal, r.destination_terminal,
            t.name AS transport_type_name
     FROM routes r
     LEFT JOIN transport_types t ON t.transport_type_id = r.transport_type_id
     WHERE r.route_id = $1`,
    [routeId]
  );
  if (route.length === 0) return null;

  const { rows: stations } = await db.query(
    `SELECT rs.station_order, s.station_id, s.station_name, s.latitude, s.longitude
     FROM route_stations rs
     JOIN stations s ON s.station_id = rs.station_id
     WHERE rs.route_id = $1
     ORDER BY rs.station_order`,
    [routeId]
  );

  return { ...route[0], stations };
}

module.exports = {
  findNearestStations,
  getAllStations,
  getStationById,
  getAllRoutes,
  getRouteWithStations,
};
