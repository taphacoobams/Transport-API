const { query } = require('../config/database');
const { getNetworkStyle } = require('../config/networkStyles');

async function getAllRoutesWithStations() {
  const sql = `
    SELECT 
      r.route_code AS route_id,
      r.route_name,
      n.network_code AS network,
      s.longitude,
      s.latitude,
      rs.station_order
    FROM routes r
    JOIN networks n ON r.network_id = n.id
    JOIN route_stations rs ON rs.route_id = r.id
    JOIN stations s ON rs.station_id = s.id
    WHERE s.latitude IS NOT NULL 
      AND s.longitude IS NOT NULL
    ORDER BY r.id, rs.station_order
  `;

  const { rows } = await query(sql);
  return rows;
}

function buildRoutesGeoJSON(rows) {
  const routesMap = new Map();

  for (const row of rows) {
    const { route_id, route_name, network, longitude, latitude } = row;

    if (!routesMap.has(route_id)) {
      const style = getNetworkStyle(network);
      routesMap.set(route_id, {
        route_id,
        route_name,
        network,
        color: style.color,
        weight: style.weight,
        coordinates: [],
      });
    }

    routesMap.get(route_id).coordinates.push([longitude, latitude]);
  }

  const features = [];

  for (const route of routesMap.values()) {
    if (route.coordinates.length < 2) {
      continue;
    }

    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: route.coordinates,
      },
      properties: {
        route_id: route.route_id,
        route_name: route.route_name,
        network: route.network,
        color: route.color,
        weight: route.weight,
      },
    });
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}

async function getRoutesGeoJSON() {
  const rows = await getAllRoutesWithStations();
  return buildRoutesGeoJSON(rows);
}

module.exports = { getRoutesGeoJSON, getAllRoutesWithStations, buildRoutesGeoJSON };
