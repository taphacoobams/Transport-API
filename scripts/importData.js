/**
 * TRANSPORT API - Script d'import des données
 * Importe les données depuis les fichiers JSON (DDD, BRT, TER)
 *
 * Gère deux formats de coordonnées :
 *   - Ancien (DDD) : "14.76 / -17.43 (lat/lon)"
 *   - Nouveau (BRT/TER) : { latitude: 14.76, longitude: -17.43 }
 *
 * Usage: node scripts/importData.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// ============================================================================
// CONFIGURATION
// ============================================================================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const DATA_DIR = path.join(__dirname, '..', 'src', 'data');

const NETWORKS_CONFIG = [
  { code: 'DDD', file: 'ddd.json', name: 'Dakar Dem Dikk', operator: 'Dakar Dem Dikk', transport_type: 'bus' },
  { code: 'BRT', file: 'brt.json', name: 'Bus Rapid Transit Dakar', operator: 'Sunu BRT', transport_type: 'brt' },
  { code: 'TER', file: 'ter.json', name: 'Train Express Régional', operator: 'SETER', transport_type: 'train' },
];

// ============================================================================
// UTILITAIRES
// ============================================================================

function parseCoordinates(station) {
  const c = station.coordonnees;
  if (!c) return { lat: null, lon: null };

  // New format: { latitude, longitude }
  if (typeof c.latitude === 'number' && typeof c.longitude === 'number') {
    return { lat: c.latitude, lon: c.longitude };
  }

  // Old format: "14.76 / -17.43 (lat/lon)"
  const raw = c.aller || c.retour || null;
  if (!raw) return { lat: null, lon: null };

  const clean = raw.replace(/\(lat\/lon\)/gi, '').replace(/\)/g, '').trim();
  let lat = null, lon = null;

  if (clean.includes('/')) {
    const parts = clean.split('/').map(s => s.trim());
    lat = parseFloat(parts[0]);
    lon = parseFloat(parts[1]);
  } else if (clean.includes(',')) {
    const parts = clean.split(',').map(s => s.trim());
    lat = parseFloat(parts[0]);
    lon = parseFloat(parts[1]);
  }

  if (isNaN(lat) || isNaN(lon)) return { lat: null, lon: null };
  return { lat, lon };
}

function generateStationCode(networkCode, stationName) {
  const slug = stationName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return `${networkCode}_${slug}`;
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function walkingTimeMinutes(distanceMeters) {
  return Math.round((distanceMeters / (5000 / 60)) * 10) / 10;
}

// ============================================================================
// DB HELPERS
// ============================================================================

async function insertNetwork(client, config, data) {
  const net = data.network || {};
  const { rows } = await client.query(
    `INSERT INTO networks (network_code, name, operator, transport_type, corridor_length_km)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (network_code) DO UPDATE SET
       name = EXCLUDED.name, operator = EXCLUDED.operator,
       transport_type = EXCLUDED.transport_type, corridor_length_km = EXCLUDED.corridor_length_km
     RETURNING id`,
    [config.code, net.name || config.name, net.operator || config.operator,
     net.transport_type || config.transport_type, net.corridor_length_km || null]
  );
  return rows[0].id;
}

async function insertStation(client, networkId, networkCode, station) {
  const code = generateStationCode(networkCode, station.station_name);
  const { lat, lon } = parseCoordinates(station);
  const district = station.district || null;

  const { rows } = await client.query(
    `INSERT INTO stations (station_code, station_name, latitude, longitude, network_id, district)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (station_code) DO UPDATE SET
       station_name = EXCLUDED.station_name,
       latitude  = COALESCE(EXCLUDED.latitude, stations.latitude),
       longitude = COALESCE(EXCLUDED.longitude, stations.longitude),
       district  = COALESCE(EXCLUDED.district, stations.district)
     RETURNING id`,
    [code, station.station_name, lat, lon, networkId, district]
  );
  return rows[0].id;
}

async function insertRoute(client, networkId, route) {
  const { rows } = await client.query(
    `INSERT INTO routes (route_code, route_name, network_id, route_type, origin_terminal, destination_terminal)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (route_code) DO UPDATE SET
       route_name = EXCLUDED.route_name, route_type = EXCLUDED.route_type,
       origin_terminal = EXCLUDED.origin_terminal, destination_terminal = EXCLUDED.destination_terminal
     RETURNING id`,
    [route.route_id, route.route_name, networkId, route.route_type || null,
     route.origin_terminal || null, route.destination_terminal || null]
  );
  return rows[0].id;
}

async function insertRouteStation(client, routeId, stationId, order) {
  await client.query(
    `INSERT INTO route_stations (route_id, station_id, station_order)
     VALUES ($1, $2, $3)
     ON CONFLICT (route_id, station_id) DO NOTHING`,
    [routeId, stationId, order]
  );
}

async function insertTravelTime(client, routeId, fromId, toId, minutes) {
  await client.query(
    `INSERT INTO travel_times (route_id, from_station_id, to_station_id, travel_time_minutes)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (route_id, from_station_id, to_station_id) DO NOTHING`,
    [routeId, fromId, toId, minutes]
  );
}

async function insertTransportEdge(client, fromId, toId, routeId, minutes) {
  await client.query(
    `INSERT INTO transport_edges (from_station_id, to_station_id, route_id, travel_time_minutes)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (from_station_id, to_station_id, route_id) DO NOTHING`,
    [fromId, toId, routeId, minutes]
  );
}

async function insertOperatingHours(client, routeId, opArray, legacyOp, legacyFreq) {
  // New format: operating_hours is an array of schedule objects
  if (Array.isArray(opArray)) {
    for (const oh of opArray) {
      await client.query(
        `INSERT INTO operating_hours
           (route_id, day_type, days, first_departure, last_departure, peak_frequency_minutes, offpeak_frequency_minutes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [routeId, oh.day_type, oh.days || [],
         oh.first_departure || null, oh.last_departure || null,
         oh.peak_frequency_minutes || null, oh.offpeak_frequency_minutes || null]
      );
    }
    return;
  }

  // Old format: { aller: { first_departure, last_departure } } + frequency: { peak, off_peak }
  if (legacyOp) {
    const first = legacyOp.aller?.first_departure || null;
    const last  = legacyOp.aller?.last_departure  || null;
    const peak  = legacyFreq?.peak || null;
    const off   = legacyFreq?.off_peak || null;
    await client.query(
      `INSERT INTO operating_hours
         (route_id, day_type, days, first_departure, last_departure, peak_frequency_minutes, offpeak_frequency_minutes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [routeId, 'weekday', ['lundi','mardi','mercredi','jeudi','vendredi'], first, last, peak, off]
    );
  }
}

async function insertFares(client, networkId, faresArray) {
  if (!faresArray) return;

  // New format: array of { zones_travelled, price_fcfa }
  if (Array.isArray(faresArray)) {
    for (const f of faresArray) {
      await client.query(
        `INSERT INTO fares (network_id, zones_travelled, price_fcfa)
         VALUES ($1, $2, $3)
         ON CONFLICT (network_id, zones_travelled) DO NOTHING`,
        [networkId, f.zones_travelled, f.price_fcfa]
      );
    }
    return;
  }

  // Old format: { "same_zone": 400, "multi_zone": 500 }
  for (const [key, price] of Object.entries(faresArray)) {
    await client.query(
      `INSERT INTO fares (network_id, zones_travelled, price_fcfa)
       VALUES ($1, $2, $3)
       ON CONFLICT (network_id, zones_travelled) DO NOTHING`,
      [networkId, key, price]
    );
  }
}

async function insertZones(client, networkId, networkCode, zonesArray, stationIdMap) {
  if (!Array.isArray(zonesArray) || zonesArray.length === 0) return;

  for (const zone of zonesArray) {
    const { rows } = await client.query(
      `INSERT INTO zones (zone_code, zone_name, network_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (zone_code, network_id) DO NOTHING
       RETURNING id`,
      [zone.zone_code, zone.zone_name, networkId]
    );

    // If inserted (not a conflict), link stations
    const zoneId = rows[0]?.id;
    if (!zoneId) continue;

    for (const stationName of (zone.stations || [])) {
      const key = `${networkCode}_${stationName}`;
      const stationId = stationIdMap.get(key);
      if (stationId) {
        await client.query(
          `INSERT INTO zone_stations (zone_id, station_id)
           VALUES ($1, $2)
           ON CONFLICT (zone_id, station_id) DO NOTHING`,
          [zoneId, stationId]
        );
      }
    }
  }
}

async function updateRouteMetrics(client, routeId) {
  const { rows: countRows } = await client.query(
    'SELECT COUNT(*) as cnt FROM route_stations WHERE route_id = $1', [routeId]);
  const stationCount = parseInt(countRows[0].cnt, 10);

  const { rows: durRows } = await client.query(
    'SELECT COALESCE(SUM(travel_time_minutes), 0) as total FROM travel_times WHERE route_id = $1', [routeId]);
  const estimatedDuration = Math.round(parseFloat(durRows[0].total));

  const { rows: stRows } = await client.query(
    `SELECT s.latitude, s.longitude
     FROM route_stations rs JOIN stations s ON s.id = rs.station_id
     WHERE rs.route_id = $1 ORDER BY rs.station_order`, [routeId]);

  let totalKm = 0;
  for (let i = 1; i < stRows.length; i++) {
    const p = stRows[i - 1], c = stRows[i];
    if (p.latitude && p.longitude && c.latitude && c.longitude) {
      totalKm += haversineDistance(p.latitude, p.longitude, c.latitude, c.longitude) / 1000;
    }
  }
  totalKm = Math.round(totalKm * 100) / 100;

  await client.query(
    'UPDATE routes SET station_count=$1, estimated_duration_min=$2, total_distance_km=$3 WHERE id=$4',
    [stationCount, estimatedDuration, totalKm, routeId]);
}

async function updateNetworkStationCount(client, networkId) {
  await client.query(
    'UPDATE networks SET total_stations = (SELECT COUNT(*) FROM stations WHERE network_id=$1) WHERE id=$1',
    [networkId]);
}

// ============================================================================
// TRANSFER EDGES
// ============================================================================

async function createTransferEdges(client) {
  console.log('🔗 Création des transfer_edges (correspondances < 300m)...');

  const { rows: stations } = await client.query(
    'SELECT id, station_name, latitude, longitude, network_id FROM stations WHERE latitude IS NOT NULL AND longitude IS NOT NULL'
  );

  let count = 0;
  for (let i = 0; i < stations.length; i++) {
    for (let j = i + 1; j < stations.length; j++) {
      const s1 = stations[i], s2 = stations[j];
      if (s1.network_id === s2.network_id) continue;

      const dist = haversineDistance(s1.latitude, s1.longitude, s2.latitude, s2.longitude);
      if (dist > 300) continue;

      const wt = walkingTimeMinutes(dist);
      const dm = Math.round(dist);

      // Bidirectional
      await client.query(
        `INSERT INTO transfer_edges (from_station_id, to_station_id, distance_meters, walking_time_minutes, connection_type, is_active)
         VALUES ($1,$2,$3,$4,'walking',true) ON CONFLICT (from_station_id, to_station_id) DO NOTHING`,
        [s1.id, s2.id, dm, wt]);
      await client.query(
        `INSERT INTO transfer_edges (from_station_id, to_station_id, distance_meters, walking_time_minutes, connection_type, is_active)
         VALUES ($1,$2,$3,$4,'walking',true) ON CONFLICT (from_station_id, to_station_id) DO NOTHING`,
        [s2.id, s1.id, dm, wt]);
      count++;
    }
  }
  console.log(`   ✅ ${count} correspondances créées (bidirectionnelles)`);
}

// ============================================================================
// IMPORT D'UN RÉSEAU
// ============================================================================

async function importNetwork(client, config) {
  console.log(`\n📦 Import du réseau ${config.code}...`);

  const filePath = path.join(DATA_DIR, config.file);
  if (!fs.existsSync(filePath)) { console.warn(`   ⚠️  Fichier non trouvé: ${filePath}`); return; }
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  // 1. Network
  const networkId = await insertNetwork(client, config, data);
  console.log(`   ✅ Réseau créé (id: ${networkId})`);

  const routes = data.routes || [];
  let totalStations = 0, totalRoutes = 0;
  const stationIdMap = new Map();

  for (const route of routes) {
    // 2. Route
    const routeId = await insertRoute(client, networkId, route);
    totalRoutes++;

    // 3. Stations + route_stations
    for (let i = 0; i < (route.stations || []).length; i++) {
      const station = route.stations[i];
      const key = `${config.code}_${station.station_name}`;
      let stationId;

      if (stationIdMap.has(key)) {
        stationId = stationIdMap.get(key);
      } else {
        stationId = await insertStation(client, networkId, config.code, station);
        stationIdMap.set(key, stationId);
        totalStations++;
      }
      await insertRouteStation(client, routeId, stationId, i + 1);
    }

    // 4. Travel times + transport edges
    for (const tt of (route.travel_times || [])) {
      const fromId = stationIdMap.get(`${config.code}_${tt.from}`);
      const toId   = stationIdMap.get(`${config.code}_${tt.to}`);
      if (fromId && toId) {
        const dur = tt.duration_min || tt.minutes || 0;
        await insertTravelTime(client, routeId, fromId, toId, dur);
        await insertTransportEdge(client, fromId, toId, routeId, dur);
      }
    }

    // 5. Operating hours (new array format or old object format)
    if (Array.isArray(route.operating_hours)) {
      await insertOperatingHours(client, routeId, route.operating_hours);
    } else {
      await insertOperatingHours(client, routeId, null, route.operating_hours, route.frequency);
    }

    // 6. Per-route fares (old DDD format)
    if (route.fares) {
      await insertFares(client, networkId, route.fares);
    }

    // 7. Route metrics
    await updateRouteMetrics(client, routeId);
  }

  // Network-level fares (new BRT/TER format)
  if (data.fares) {
    await insertFares(client, networkId, data.fares);
  }

  // Zones + zone_stations
  if (data.zones) {
    await insertZones(client, networkId, config.code, data.zones, stationIdMap);
  }

  // Update total_stations on network
  await updateNetworkStationCount(client, networkId);

  console.log(`   ✅ ${totalRoutes} routes importées`);
  console.log(`   ✅ ${totalStations} stations uniques`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('🚀 TRANSPORT API - Import des données');
  console.log('=====================================\n');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const config of NETWORKS_CONFIG) {
      await importNetwork(client, config);
    }

    await createTransferEdges(client);

    await client.query('COMMIT');

    // Stats
    console.log('\n=====================================');
    console.log('📊 STATISTIQUES FINALES');
    console.log('=====================================\n');

    const tables = [
      'networks', 'stations', 'routes', 'route_stations',
      'travel_times', 'transport_edges', 'transfer_edges',
      'zones', 'zone_stations', 'fares', 'operating_hours',
    ];
    for (const t of tables) {
      const { rows } = await client.query(`SELECT COUNT(*) as cnt FROM ${t}`);
      console.log(`   ${t.padEnd(18)} ${rows[0].cnt}`);
    }

    console.log('\n✅ Import terminé avec succès!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Erreur lors de l\'import:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
