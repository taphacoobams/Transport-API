const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { pool, query, createSchema, end } = require('../src/database');

// ---------------------------------------------------------------------------
// Load datasets
// ---------------------------------------------------------------------------
const brt  = require('../src/data/brt.json');
const ter  = require('../src/data/ter.json');
const ddd  = require('../src/data/ddd.json');
const aftu = require('../src/data/aftu.json');

const TRANSPORT_TYPES = [
  { name: 'BRT',  description: 'Bus Rapid Transit' },
  { name: 'Rail', description: 'Train Express Régional' },
  { name: 'Bus',  description: 'Bus urbain' },
];

const datasets = [
  { prefix: 'brt',  network: 'BRT',  typeName: 'BRT',  data: brt  },
  { prefix: 'ter',  network: 'TER',  typeName: 'Rail', data: ter  },
  { prefix: 'ddd',  network: 'DDD',  typeName: 'Bus',  data: ddd  },
  { prefix: 'aftu', network: 'AFTU', typeName: 'Bus',  data: aftu },
];

let transportTypeMap = {}; // name -> transport_type_id

// ---------------------------------------------------------------------------
// Haversine distance (meters)
// ---------------------------------------------------------------------------
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ---------------------------------------------------------------------------
// Nominatim geocoding helper (1 req/s rate-limited)
// ---------------------------------------------------------------------------
async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function geocodeStation(stationName, city = 'Dakar') {
  const q = encodeURIComponent(`${stationName}, ${city}, Senegal`);
  const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'transport_api_dakar/1.0' },
    });
    const data = await res.json();
    if (data && data.length > 0) {
      return { latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon) };
    }
  } catch (err) {
    console.warn(`  Nominatim error for "${stationName}":`, err.message);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Collect unique stations per dataset (deduplicate within same network)
// ---------------------------------------------------------------------------
function collectStations(prefix, network, data) {
  const stationMap = new Map();
  for (const route of data.routes) {
    for (const s of route.stations) {
      const sid = `${prefix}_${s.station_id}`;
      if (!stationMap.has(sid)) {
        stationMap.set(sid, {
          station_id: sid,
          station_name: s.station_name,
          transport_network: network,
          latitude: s.latitude || s.lat || null,
          longitude: s.longitude || s.lon || null,
        });
      }
    }
  }
  return Array.from(stationMap.values());
}

// ---------------------------------------------------------------------------
// Insert stations (with optional Nominatim fallback)
// ---------------------------------------------------------------------------
async function insertStations(stations, typeId) {
  let geocodeCount = 0;
  for (const s of stations) {
    if (s.latitude == null || s.longitude == null) {
      if (geocodeCount > 0) await sleep(1100); // respect Nominatim rate limit
      const coords = await geocodeStation(s.station_name);
      if (coords) {
        s.latitude = coords.latitude;
        s.longitude = coords.longitude;
        console.log(`  Geocoded "${s.station_name}" → ${s.latitude}, ${s.longitude}`);
      } else {
        console.warn(`  Could not geocode "${s.station_name}" — setting coords to 0,0`);
        s.latitude = 0;
        s.longitude = 0;
      }
      geocodeCount++;
    }
    await query(
      `INSERT INTO stations (station_id, station_name, transport_network, latitude, longitude, transport_type_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (station_id) DO NOTHING`,
      [s.station_id, s.station_name, s.transport_network, s.latitude, s.longitude, typeId]
    );
  }
  return stations.length;
}

// ---------------------------------------------------------------------------
// Insert routes
// ---------------------------------------------------------------------------
async function insertRoutes(prefix, network, data, typeId) {
  let count = 0;
  for (const route of data.routes) {
    const routeId = `${prefix}_${route.route_id}`;
    await query(
      `INSERT INTO routes (route_id, route_name, transport_network, transport_type_id, origin_terminal, destination_terminal)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (route_id) DO NOTHING`,
      [routeId, route.route_name, network, typeId, route.origin_terminal || null, route.destination_terminal || null]
    );
    count++;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Insert route_stations
// ---------------------------------------------------------------------------
async function insertRouteStations(prefix, data) {
  let count = 0;
  for (const route of data.routes) {
    const routeId = `${prefix}_${route.route_id}`;
    for (const s of route.stations) {
      const sid = `${prefix}_${s.station_id}`;
      await query(
        `INSERT INTO route_stations (route_id, station_id, station_order)
         VALUES ($1, $2, $3)`,
        [routeId, sid, s.station_order]
      );
      count++;
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// Create transport edges (consecutive stations on each route)
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Insert travel_times from dataset
// ---------------------------------------------------------------------------
async function insertTravelTimes(prefix, data) {
  let count = 0;
  for (const route of data.routes) {
    const routeId = `${prefix}_${route.route_id}`;
    if (!route.travel_times || route.travel_times.length === 0) continue;
    const sortedStations = [...route.stations].sort((a, b) => a.station_order - b.station_order);
    const nameToId = new Map();
    for (const s of sortedStations) {
      nameToId.set(s.station_name, `${prefix}_${s.station_id}`);
    }
    for (const tt of route.travel_times) {
      const fromSid = nameToId.get(tt.from_station);
      const toSid = nameToId.get(tt.to_station);
      if (fromSid && toSid) {
        const minutes = tt.duration_minutes || tt.travel_time_minutes || 0;
        await query(
          `INSERT INTO travel_times (route_id, from_station, to_station, travel_time_minutes)
           VALUES ($1, $2, $3, $4)`,
          [routeId, fromSid, toSid, minutes]
        );
        count++;
      }
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// Create transport edges (consecutive stations on each route)
// ---------------------------------------------------------------------------
async function createTransportEdges(prefix, data) {
  let count = 0;
  for (const route of data.routes) {
    const routeId = `${prefix}_${route.route_id}`;
    const sortedStations = [...route.stations].sort((a, b) => a.station_order - b.station_order);

    // Build a lookup for travel times by from_name → to_name
    const ttLookup = new Map();
    if (route.travel_times) {
      for (const tt of route.travel_times) {
        ttLookup.set(`${tt.from_station}|${tt.to_station}`, tt.duration_minutes || tt.travel_time_minutes || 0);
      }
    }

    for (let i = 0; i < sortedStations.length - 1; i++) {
      const fromSid = `${prefix}_${sortedStations[i].station_id}`;
      const toSid   = `${prefix}_${sortedStations[i + 1].station_id}`;
      const key = `${sortedStations[i].station_name}|${sortedStations[i + 1].station_name}`;
      const travelMin = ttLookup.get(key) || 0;
      await query(
        `INSERT INTO transport_edges (from_station, to_station, route_id, travel_time_minutes)
         VALUES ($1, $2, $3, $4)`,
        [fromSid, toSid, routeId, travelMin]
      );
      count++;
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// Generate walking transfer edges between nearby stations of different networks
// ---------------------------------------------------------------------------
async function generateTransferEdges() {
  const { rows: allStations } = await query('SELECT station_id, transport_network, latitude, longitude FROM stations');

  const THRESHOLD_METERS = 300;
  let count = 0;

  for (let i = 0; i < allStations.length; i++) {
    for (let j = i + 1; j < allStations.length; j++) {
      const a = allStations[i];
      const b = allStations[j];

      // Only connect stations from DIFFERENT networks
      if (a.transport_network === b.transport_network) continue;

      // Skip stations without valid coordinates
      if (!a.latitude || !a.longitude || !b.latitude || !b.longitude) continue;
      if (a.latitude === 0 && a.longitude === 0) continue;
      if (b.latitude === 0 && b.longitude === 0) continue;

      const dist = haversine(a.latitude, a.longitude, b.latitude, b.longitude);

      if (dist <= THRESHOLD_METERS) {
        const walkingTime = dist / 83; // 5 km/h ≈ 83 m/min

        // Insert bidirectional transfer
        await query(
          `INSERT INTO transfer_edges (from_station, to_station, distance_meters, walking_time_minutes)
           VALUES ($1, $2, $3, $4)`,
          [a.station_id, b.station_id, Math.round(dist * 100) / 100, Math.round(walkingTime * 100) / 100]
        );
        await query(
          `INSERT INTO transfer_edges (from_station, to_station, distance_meters, walking_time_minutes)
           VALUES ($1, $2, $3, $4)`,
          [b.station_id, a.station_id, Math.round(dist * 100) / 100, Math.round(walkingTime * 100) / 100]
        );
        count += 2;
      }
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  try {
    console.log('=== Transport Graph Import ===\n');

    // Step 1: Create schema
    console.log('1. Creating database schema...');
    await createSchema();

    // Step 1b: Seed transport_types
    console.log('\n2. Seeding transport types...');
    for (const tt of TRANSPORT_TYPES) {
      const { rows } = await query(
        `INSERT INTO transport_types (name, description) VALUES ($1, $2)
         ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
         RETURNING transport_type_id`,
        [tt.name, tt.description]
      );
      transportTypeMap[tt.name] = rows[0].transport_type_id;
    }
    console.log('  Transport types:', Object.keys(transportTypeMap).join(', '));

    // Step 2: Process each network
    let totalStations = 0;
    let totalRoutes = 0;
    let totalRouteStations = 0;
    let totalTravelTimes = 0;
    let totalTransportEdges = 0;

    for (const { prefix, network, typeName, data } of datasets) {
      console.log(`\n--- Processing ${network} ---`);
      const typeId = transportTypeMap[typeName];

      // Collect and insert stations
      const stations = collectStations(prefix, network, data);
      const stationCount = await insertStations(stations, typeId);
      totalStations += stationCount;
      console.log(`  Stations inserted: ${stationCount}`);

      // Insert routes
      const routeCount = await insertRoutes(prefix, network, data, typeId);
      totalRoutes += routeCount;
      console.log(`  Routes inserted: ${routeCount}`);

      // Insert route_stations
      const rsCount = await insertRouteStations(prefix, data);
      totalRouteStations += rsCount;
      console.log(`  Route-station links: ${rsCount}`);

      // Insert travel_times
      const ttCount = await insertTravelTimes(prefix, data);
      totalTravelTimes += ttCount;
      console.log(`  Travel times: ${ttCount}`);

      // Create transport edges
      const edgeCount = await createTransportEdges(prefix, data);
      totalTransportEdges += edgeCount;
      console.log(`  Transport edges: ${edgeCount}`);
    }

    // Step 3: Generate walking transfers
    console.log('\n4. Generating walking transfer edges...');
    const transferCount = await generateTransferEdges();
    console.log(`  Transfer edges created: ${transferCount}`);

    // Summary
    console.log('\n=== Import Complete ===');
    console.log(`  Total stations:        ${totalStations}`);
    console.log(`  Total routes:          ${totalRoutes}`);
    console.log(`  Total route-stations:  ${totalRouteStations}`);
    console.log(`  Total travel times:    ${totalTravelTimes}`);
    console.log(`  Total transport edges: ${totalTransportEdges}`);
    console.log(`  Total transfer edges:  ${transferCount}`);
    console.log('\nTransport graph is ready for routing algorithms.');

  } catch (err) {
    console.error('Import failed:', err);
    process.exit(1);
  } finally {
    await end();
  }
}

main();
