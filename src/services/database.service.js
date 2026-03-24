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
           s.district, s.network_id, n.name AS network_name, n.transport_type,
           COALESCE(lr.lignes, '[]'::json) AS lignes,
           COALESCE(tc.correspondances, '[]'::json) AS correspondances
    FROM stations s
    JOIN networks n ON n.id = s.network_id
    LEFT JOIN LATERAL (
      SELECT json_agg(json_build_object(
        'route_code', r.route_code,
        'route_name', r.route_name
      ) ORDER BY r.route_code) AS lignes
      FROM route_stations rs
      JOIN routes r ON r.id = rs.route_id
      WHERE rs.station_id = s.id
    ) lr ON true
    LEFT JOIN LATERAL (
      SELECT json_agg(json_build_object(
        'station_name', s2.station_name,
        'network_code', n2.network_code,
        'distance_meters', te.distance_meters,
        'walking_time_minutes', te.walking_time_minutes
      ) ORDER BY te.distance_meters) AS correspondances
      FROM transfer_edges te
      JOIN stations s2 ON s2.id = te.to_station_id
      JOIN networks n2 ON n2.id = s2.network_id
      WHERE te.from_station_id = s.id
    ) tc ON true
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
            s.district, s.network_id, n.name AS network_name, n.transport_type,
            (6371 * acos(
              cos(radians($1)) * cos(radians(s.latitude))
              * cos(radians(s.longitude) - radians($2))
              + sin(radians($1)) * sin(radians(s.latitude))
            )) AS distance_km
     FROM stations s
     JOIN networks n ON n.id = s.network_id
     WHERE s.latitude IS NOT NULL AND s.longitude IS NOT NULL
     ORDER BY distance_km
     LIMIT $3`,
    [lat, lon, limit]
  );
  return rows.filter(r => r.distance_km <= maxDistanceKm);
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

async function getStats() {
  // Totaux globaux
  const { rows: [totals] } = await db.query(`
    SELECT
      (SELECT COUNT(*)::int FROM stations) AS total_stations,
      (SELECT COUNT(*)::int FROM routes) AS total_routes,
      (SELECT COUNT(*)::int FROM networks) AS total_networks,
      (SELECT COUNT(*)::int FROM zones) AS total_zones,
      (SELECT COUNT(*)::int FROM fares) AS total_fares,
      (SELECT COUNT(*)::int FROM transport_edges) AS total_transport_edges,
      (SELECT COUNT(*)::int FROM transfer_edges) AS total_transfer_edges,
      (SELECT COUNT(*)::int FROM operating_hours) AS total_operating_hours,
      (SELECT COUNT(DISTINCT from_station_id)::int FROM transfer_edges) AS stations_with_correspondance
  `);

  // Détails par réseau
  const { rows: networks } = await db.query(`
    SELECT n.network_code, n.name, n.transport_type, n.operator,
           n.corridor_length_km,
           (SELECT COUNT(*)::int FROM stations s WHERE s.network_id = n.id) AS stations,
           (SELECT COUNT(*)::int FROM routes r WHERE r.network_id = n.id) AS routes,
           (SELECT COUNT(*)::int FROM zones z WHERE z.network_id = n.id) AS zones,
           (SELECT COUNT(*)::int FROM fares f WHERE f.network_id = n.id) AS fares,
           (SELECT COUNT(DISTINCT te.from_station_id)::int
            FROM transfer_edges te
            JOIN stations s ON s.id = te.from_station_id
            WHERE s.network_id = n.id) AS stations_with_correspondance
    FROM networks n ORDER BY n.id
  `);

  // Correspondances inter-réseau (paires uniques, ex: BRT↔DDD)
  const { rows: correspondances } = await db.query(`
    SELECT n1.network_code AS network_a, n2.network_code AS network_b,
           COUNT(DISTINCT LEAST(te.from_station_id, te.to_station_id) || '-' || GREATEST(te.from_station_id, te.to_station_id))::int AS pairs,
           ROUND(AVG(te.distance_meters)::numeric, 0)::int AS avg_distance_meters,
           ROUND(AVG(te.walking_time_minutes)::numeric, 1) AS avg_walking_minutes
    FROM transfer_edges te
    JOIN stations s1 ON s1.id = te.from_station_id
    JOIN stations s2 ON s2.id = te.to_station_id
    JOIN networks n1 ON n1.id = s1.network_id
    JOIN networks n2 ON n2.id = s2.network_id
    WHERE n1.network_code < n2.network_code
    GROUP BY n1.network_code, n2.network_code
    ORDER BY pairs DESC
  `);

  // Top correspondances (les plus proches)
  const { rows: top_correspondances } = await db.query(`
    SELECT s1.station_name AS station_a, n1.network_code AS network_a,
           s2.station_name AS station_b, n2.network_code AS network_b,
           te.distance_meters, te.walking_time_minutes
    FROM transfer_edges te
    JOIN stations s1 ON s1.id = te.from_station_id
    JOIN stations s2 ON s2.id = te.to_station_id
    JOIN networks n1 ON n1.id = s1.network_id
    JOIN networks n2 ON n2.id = s2.network_id
    WHERE n1.network_code < n2.network_code
    ORDER BY te.distance_meters
    LIMIT 10
  `);

  // Tarifs
  const { rows: fares } = await db.query(`
    SELECT n.network_code, f.zones_travelled, f.price_fcfa
    FROM fares f
    JOIN networks n ON n.id = f.network_id
    ORDER BY n.network_code, f.zones_travelled
  `);

  // Horaires résumés par réseau
  const { rows: horaires } = await db.query(`
    SELECT n.network_code, r.route_code, r.route_name, o.day_type,
           o.first_departure, o.last_departure,
           o.peak_frequency_minutes, o.offpeak_frequency_minutes
    FROM operating_hours o
    JOIN routes r ON r.id = o.route_id
    JOIN networks n ON n.id = r.network_id
    ORDER BY n.network_code, r.route_code, o.day_type
  `);

  return {
    totals,
    networks,
    correspondances,
    top_correspondances,
    fares,
    horaires,
  };
}

async function getStationCorrespondances(stationId) {
  // Lignes desservant cette station
  const { rows: lines } = await db.query(`
    SELECT r.id AS route_id, r.route_code, r.route_name, r.route_type,
           n.network_code, n.name AS network_name
    FROM route_stations rs
    JOIN routes r ON r.id = rs.route_id
    JOIN networks n ON n.id = r.network_id
    WHERE rs.station_id = $1
    ORDER BY n.network_code, r.route_code
  `, [stationId]);

  // Stations de correspondance proches (via transfer_edges)
  const { rows: transfers } = await db.query(`
    SELECT s2.id, s2.station_code, s2.station_name,
           n2.network_code, n2.name AS network_name,
           te.distance_meters, te.walking_time_minutes
    FROM transfer_edges te
    JOIN stations s2 ON s2.id = te.to_station_id
    JOIN networks n2 ON n2.id = s2.network_id
    WHERE te.from_station_id = $1
    ORDER BY te.distance_meters
  `, [stationId]);

  return { lines, transfers };
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
  getStats,
  getStationCorrespondances,
};
