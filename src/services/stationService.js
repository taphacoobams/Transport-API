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
    `SELECT s.id AS station_id, s.station_name, n.transport_type AS transport_network, 
            s.latitude, s.longitude
     FROM stations s
     JOIN networks n ON n.id = s.network_id
     WHERE s.latitude IS NOT NULL AND s.longitude IS NOT NULL`
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
    SELECT s.id AS station_id, s.station_name, n.transport_type AS transport_network, 
           s.latitude, s.longitude, s.network_id, n.name AS network_name
    FROM stations s
    LEFT JOIN networks n ON n.id = s.network_id
  `;
  const params = [];
  if (transport_network) {
    params.push(transport_network.toUpperCase());
    text += ` WHERE UPPER(n.transport_type) = $${params.length}`;
  }
  text += ' ORDER BY s.id';
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
    `SELECT s.id AS station_id, s.station_name, n.transport_type AS transport_network, 
            s.latitude, s.longitude, s.network_id, n.name AS network_name
     FROM stations s
     LEFT JOIN networks n ON n.id = s.network_id
     WHERE s.id = $1`,
    [stationId]
  );
  return rows[0] || null;
}

/**
 * Get all routes, optionally filtered by network.
 */
async function getAllRoutes({ transport_network } = {}) {
  let text = `
    SELECT r.id AS route_id, r.route_name, n.transport_type AS transport_network, 
           r.origin_terminal, r.destination_terminal,
           r.network_id, n.name AS network_name
    FROM routes r
    LEFT JOIN networks n ON n.id = r.network_id
  `;
  const params = [];
  if (transport_network) {
    params.push(transport_network.toUpperCase());
    text += ` WHERE UPPER(n.transport_type) = $${params.length}`;
  }
  text += ' ORDER BY r.id';

  const { rows } = await db.query(text, params);
  return rows;
}

/**
 * Get route details including its stations in order.
 */
async function getRouteWithStations(routeId) {
  const { rows: route } = await db.query(
    `SELECT r.id AS route_id, r.route_name, n.transport_type AS transport_network, 
            r.origin_terminal, r.destination_terminal,
            n.name AS network_name
     FROM routes r
     LEFT JOIN networks n ON n.id = r.network_id
     WHERE r.id = $1`,
    [routeId]
  );
  if (route.length === 0) return null;

  const { rows: stations } = await db.query(
    `SELECT rs.station_order, s.id AS station_id, s.station_name, s.latitude, s.longitude
     FROM route_stations rs
     JOIN stations s ON s.id = rs.station_id
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
