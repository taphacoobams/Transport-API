/**
 * Generate SQL seed file from JSON data files
 * Usage: node scripts/generate-seed-from-json.js > src/database/seed-production.sql
 */

const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../src/data');

// Load JSON files
const terData = JSON.parse(fs.readFileSync(path.join(dataDir, 'ter.json'), 'utf8'));
const brtData = JSON.parse(fs.readFileSync(path.join(dataDir, 'brt.json'), 'utf8'));
const dddData = JSON.parse(fs.readFileSync(path.join(dataDir, 'ddd.json'), 'utf8'));
const aftuData = JSON.parse(fs.readFileSync(path.join(dataDir, 'aftu.json'), 'utf8'));

// Parse coordinates from string like "14.7604342 / -17.439255 (lat/lon)"
function parseCoords(coordStr) {
  if (!coordStr) return { lat: null, lon: null };
  // Handle format: "14.7604342 / -17.439255 (lat/lon)" or "14.741909105844499, -17.472236475130835"
  const cleaned = coordStr.replace('(lat/lon)', '').replace(')', '').trim();
  const parts = cleaned.split(/[\/,]/).map(s => s.trim());
  if (parts.length >= 2) {
    return {
      lat: parseFloat(parts[0]),
      lon: parseFloat(parts[1])
    };
  }
  return { lat: null, lon: null };
}

// Escape single quotes for SQL
function esc(str) {
  if (!str) return '';
  return str.replace(/'/g, "''");
}

// Generate unique station code
function genStationCode(networkCode, stationName, index) {
  const cleanName = stationName
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-zA-Z0-9]/g, '')
    .substring(0, 10)
    .toUpperCase();
  return `${networkCode}-${cleanName}${index}`;
}

// Track all stations globally to avoid duplicates
const allStations = new Map(); // key: "networkId-stationName" -> station object
let stationIdCounter = 1;
let routeIdCounter = 1;

// Networks
const networks = [
  { id: 1, code: 'TER', name: 'Train Express Régional', operator: 'SENTER', type: 'TER' },
  { id: 2, code: 'BRT', name: 'Bus Rapid Transit Dakar', operator: 'CETUD/Dakar Mobilité', type: 'BRT' },
  { id: 3, code: 'DDD', name: 'Dakar Dem Dikk', operator: 'DDD SA', type: 'DDD' },
  { id: 4, code: 'AFTU', name: 'AFTU Minibus', operator: 'AFTU', type: 'AFTU' },
];

// Process stations from a route and add to global map
function processStations(route, networkId, networkCode) {
  const stationIds = [];
  for (const station of route.stations) {
    const key = `${networkId}-${station.station_name}`;
    if (!allStations.has(key)) {
      const coords = parseCoords(station.coordonnees?.aller);
      allStations.set(key, {
        id: stationIdCounter++,
        code: genStationCode(networkCode, station.station_name, stationIdCounter),
        name: station.station_name,
        lat: coords.lat,
        lon: coords.lon,
        networkId: networkId,
        district: null
      });
    }
    stationIds.push(allStations.get(key).id);
  }
  return stationIds;
}

// Process all data
const allRoutes = [];
const allTravelTimes = [];
const allRouteStations = [];

// Process TER
for (const route of terData.routes) {
  const stationIds = processStations(route, 1, 'TER');
  const routeId = routeIdCounter++;
  allRoutes.push({
    id: routeId,
    code: route.route_id,
    name: route.route_name,
    networkId: 1,
    type: route.route_type || 'express',
    origin: route.origin_terminal,
    destination: route.destination_terminal
  });
  
  // Route stations
  stationIds.forEach((stationId, idx) => {
    allRouteStations.push({ routeId, stationId, order: idx + 1 });
  });
  
  // Travel times
  if (route.travel_times) {
    for (const tt of route.travel_times) {
      const fromKey = `1-${tt.from}`;
      const toKey = `1-${tt.to}`;
      if (allStations.has(fromKey) && allStations.has(toKey)) {
        allTravelTimes.push({
          routeId,
          fromId: allStations.get(fromKey).id,
          toId: allStations.get(toKey).id,
          minutes: tt.duration_min
        });
      }
    }
  }
}

// Process BRT
for (const route of brtData.routes) {
  const stationIds = processStations(route, 2, 'BRT');
  const routeId = routeIdCounter++;
  allRoutes.push({
    id: routeId,
    code: route.route_id,
    name: route.route_name,
    networkId: 2,
    type: route.route_type || 'omnibus',
    origin: route.origin_terminal,
    destination: route.destination_terminal
  });
  
  stationIds.forEach((stationId, idx) => {
    allRouteStations.push({ routeId, stationId, order: idx + 1 });
  });
  
  if (route.travel_times) {
    for (const tt of route.travel_times) {
      const fromKey = `2-${tt.from}`;
      const toKey = `2-${tt.to}`;
      if (allStations.has(fromKey) && allStations.has(toKey)) {
        allTravelTimes.push({
          routeId,
          fromId: allStations.get(fromKey).id,
          toId: allStations.get(toKey).id,
          minutes: tt.duration_min
        });
      }
    }
  }
}

// Process DDD
for (const route of dddData.routes) {
  const stationIds = processStations(route, 3, 'DDD');
  const routeId = routeIdCounter++;
  allRoutes.push({
    id: routeId,
    code: route.route_id,
    name: route.route_name,
    networkId: 3,
    type: route.route_type || 'Principale',
    origin: route.origin_terminal || route.stations[0]?.station_name,
    destination: route.destination_terminal || route.stations[route.stations.length - 1]?.station_name
  });
  
  stationIds.forEach((stationId, idx) => {
    allRouteStations.push({ routeId, stationId, order: idx + 1 });
  });
  
  if (route.travel_times) {
    for (const tt of route.travel_times) {
      const fromKey = `3-${tt.from}`;
      const toKey = `3-${tt.to}`;
      if (allStations.has(fromKey) && allStations.has(toKey)) {
        allTravelTimes.push({
          routeId,
          fromId: allStations.get(fromKey).id,
          toId: allStations.get(toKey).id,
          minutes: tt.duration_min
        });
      }
    }
  }
}

// Process AFTU
for (const route of aftuData.routes) {
  const stationIds = processStations(route, 4, 'AFTU');
  const routeId = routeIdCounter++;
  allRoutes.push({
    id: routeId,
    code: route.route_id,
    name: route.route_name,
    networkId: 4,
    type: route.route_type || 'minibus',
    origin: route.origin_terminal || route.stations[0]?.station_name,
    destination: route.destination_terminal || route.stations[route.stations.length - 1]?.station_name
  });
  
  stationIds.forEach((stationId, idx) => {
    allRouteStations.push({ routeId, stationId, order: idx + 1 });
  });
  
  if (route.travel_times) {
    for (const tt of route.travel_times) {
      const fromKey = `4-${tt.from}`;
      const toKey = `4-${tt.to}`;
      if (allStations.has(fromKey) && allStations.has(toKey)) {
        allTravelTimes.push({
          routeId,
          fromId: allStations.get(fromKey).id,
          toId: allStations.get(toKey).id,
          minutes: tt.duration_min
        });
      }
    }
  }
}

// Generate SQL
console.log(`-- =============================================================
-- Seed data — Dakar Mobility Transport API
-- Generated from JSON data files: ${new Date().toISOString()}
-- =============================================================

-- Clear existing data
TRUNCATE TABLE connections, zone_stations, zones, fares, operating_hours, 
               transfer_edges, transport_edges, travel_times, route_stations, 
               routes, stations, networks RESTART IDENTITY CASCADE;

-- ─── Networks ────────────────────────────────────────────────`);

for (const n of networks) {
  console.log(`INSERT INTO networks (id, network_code, name, operator, transport_type) VALUES (${n.id}, '${n.code}', '${esc(n.name)}', '${esc(n.operator)}', '${n.type}');`);
}
console.log(`SELECT setval('networks_id_seq', (SELECT MAX(id) FROM networks));`);

console.log(`\n-- ─── Stations (${allStations.size} total) ────────────────────────────────────`);
const stationsArray = Array.from(allStations.values());

// Batch insert stations
const BATCH_SIZE = 50;
for (let i = 0; i < stationsArray.length; i += BATCH_SIZE) {
  const batch = stationsArray.slice(i, i + BATCH_SIZE);
  console.log(`INSERT INTO stations (id, station_code, station_name, latitude, longitude, network_id, district) VALUES`);
  const values = batch.map(s => {
    const lat = s.lat !== null && !isNaN(s.lat) ? s.lat : 'NULL';
    const lon = s.lon !== null && !isNaN(s.lon) ? s.lon : 'NULL';
    return `  (${s.id}, '${esc(s.code)}', '${esc(s.name)}', ${lat}, ${lon}, ${s.networkId}, NULL)`;
  });
  console.log(values.join(',\n') + ';');
}
console.log(`SELECT setval('stations_id_seq', (SELECT MAX(id) FROM stations));`);

console.log(`\n-- ─── Routes (${allRoutes.length} total) ─────────────────────────────────────`);
for (let i = 0; i < allRoutes.length; i += BATCH_SIZE) {
  const batch = allRoutes.slice(i, i + BATCH_SIZE);
  console.log(`INSERT INTO routes (id, route_code, route_name, network_id, route_type, origin_terminal, destination_terminal) VALUES`);
  const values = batch.map(r => {
    const origin = r.origin ? `'${esc(r.origin)}'` : 'NULL';
    const dest = r.destination ? `'${esc(r.destination)}'` : 'NULL';
    return `  (${r.id}, '${esc(r.code)}', '${esc(r.name)}', ${r.networkId}, '${esc(r.type)}', ${origin}, ${dest})`;
  });
  console.log(values.join(',\n') + ';');
}
console.log(`SELECT setval('routes_id_seq', (SELECT MAX(id) FROM routes));`);

console.log(`\n-- ─── Route Stations (${allRouteStations.length} total) ─────────────────────────`);
for (let i = 0; i < allRouteStations.length; i += BATCH_SIZE) {
  const batch = allRouteStations.slice(i, i + BATCH_SIZE);
  console.log(`INSERT INTO route_stations (route_id, station_id, station_order) VALUES`);
  const values = batch.map(rs => `  (${rs.routeId}, ${rs.stationId}, ${rs.order})`);
  console.log(values.join(',\n') + ';');
}

console.log(`\n-- ─── Travel Times (${allTravelTimes.length} total) ─────────────────────────────`);
for (let i = 0; i < allTravelTimes.length; i += BATCH_SIZE) {
  const batch = allTravelTimes.slice(i, i + BATCH_SIZE);
  console.log(`INSERT INTO travel_times (route_id, from_station_id, to_station_id, travel_time_minutes) VALUES`);
  const values = batch.map(tt => `  (${tt.routeId}, ${tt.fromId}, ${tt.toId}, ${tt.minutes})`);
  console.log(values.join(',\n') + ';');
}

console.log(`
-- ─── Transport Edges (bidirectional for routing) ────────────
INSERT INTO transport_edges (from_station_id, to_station_id, route_id, travel_time_minutes)
SELECT from_station_id, to_station_id, route_id, travel_time_minutes FROM travel_times;

INSERT INTO transport_edges (from_station_id, to_station_id, route_id, travel_time_minutes)
SELECT to_station_id, from_station_id, route_id, travel_time_minutes FROM travel_times;

-- ─── Update station geometry (PostGIS) ───────────────────────
UPDATE stations SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- ─── Summary ─────────────────────────────────────────────────
SELECT 'Networks:' AS table_name, COUNT(*) AS count FROM networks
UNION ALL SELECT 'Stations:', COUNT(*) FROM stations
UNION ALL SELECT 'Routes:', COUNT(*) FROM routes
UNION ALL SELECT 'Route Stations:', COUNT(*) FROM route_stations
UNION ALL SELECT 'Travel Times:', COUNT(*) FROM travel_times
UNION ALL SELECT 'Transport Edges:', COUNT(*) FROM transport_edges;
`);

// Summary to stderr
console.error(`\n✅ Generated SQL with:`);
console.error(`   - ${networks.length} networks`);
console.error(`   - ${allStations.size} stations`);
console.error(`   - ${allRoutes.length} routes`);
console.error(`   - ${allRouteStations.length} route_stations`);
console.error(`   - ${allTravelTimes.length} travel_times`);
