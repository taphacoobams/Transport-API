/**
 * match_osm.js
 *
 * Matches missing stations against OSM GeoJSON bus stops,
 * then falls back to route interpolation and placeholders.
 * Updates PostgreSQL and produces final JSON files + stats.
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// ─── Data loading ────────────────────────────────────────────────

const missing = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '..', 'src', 'data', 'missing_stations.json'), 'utf-8')
);
const geojson = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '..', 'src', 'data', 'export.geojson'), 'utf-8')
);
const brt  = require('../src/data/brt.json');
const ter  = require('../src/data/ter.json');
const ddd  = require('../src/data/ddd.json');
const aftu = require('../src/data/aftu.json');

const datasets = [
  { prefix: 'brt',  data: brt  },
  { prefix: 'ter',  data: ter  },
  { prefix: 'ddd',  data: ddd  },
  { prefix: 'aftu', data: aftu },
];

// ─── OSM stops (only features with a name) ───────────────────────

const osmStops = geojson.features
  .filter(f => f.properties.name && f.geometry && f.geometry.type === 'Point')
  .map(f => ({
    name: f.properties.name,
    longitude: f.geometry.coordinates[0],
    latitude: f.geometry.coordinates[1],
    id: f.id || f.properties['@id'],
  }));

console.log(`OSM stops with name: ${osmStops.length}`);

// ─── Normalize name ──────────────────────────────────────────────

const STOP_WORDS = new Set([
  'terminus', 'station', 'arret', 'arrêt', 'poste', 'route',
  'bd', 'avenue', 'ave', 'rond', 'point', 'gare', 'de', 'du',
  'des', 'la', 'le', 'les', 'l', 'el', 'et', 'en', 'au', 'aux',
  'sur', 'ex', 'vers', 'dit', 'a',
]);

function removeAccents(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function splitCamelWords(str) {
  // "FassMbao" → "Fass Mbao", "KeurMassar" → "Keur Massar"
  return str.replace(/([a-z])([A-Z])/g, '$1 $2');
}

function normalizeName(name) {
  if (!name) return '';
  let s = name;
  s = splitCamelWords(s);
  s = removeAccents(s);
  s = s.toLowerCase();
  // remove punctuation / special chars
  s = s.replace(/[''`\-–—\/\\()\[\]{},;:.!?«»"°_#&+*=<>@~|]/g, ' ');
  // collapse whitespace
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function normalizeNoStopWords(name) {
  const words = normalizeName(name).split(' ');
  return words.filter(w => w.length > 0 && !STOP_WORDS.has(w)).join(' ');
}

// ─── Similarity functions ────────────────────────────────────────

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function similarity(a, b) {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

function keywordOverlap(a, b) {
  const wa = new Set(a.split(' ').filter(w => w.length > 1));
  const wb = new Set(b.split(' ').filter(w => w.length > 1));
  if (wa.size === 0 || wb.size === 0) return 0;
  let common = 0;
  for (const w of wa) if (wb.has(w)) common++;
  return common / Math.min(wa.size, wb.size);
}

// ─── Pre-compute normalized OSM names ────────────────────────────

const osmNormalized = osmStops.map(s => ({
  ...s,
  norm: normalizeName(s.name),
  normNoStop: normalizeNoStopWords(s.name),
}));

// ─── Build route station ordering map ────────────────────────────
// routeId → [ { station_id (prefixed), station_name, station_order } ]

function buildRouteStationMap() {
  const map = {};
  for (const { prefix, data } of datasets) {
    for (const route of data.routes) {
      const routeId = `${prefix}_${route.route_id}`;
      map[routeId] = route.stations.map(s => ({
        station_id: `${prefix}_${s.station_id}`,
        station_name: s.station_name,
        station_order: s.station_order,
      }));
    }
  }
  return map;
}

const routeStationMap = buildRouteStationMap();

// ─── Matching engine ─────────────────────────────────────────────

const FUZZY_THRESHOLD = 0.85;
const KEYWORD_THRESHOLD = 0.75;

function findOsmMatch(stationName) {
  const norm = normalizeName(stationName);
  const normNoStop = normalizeNoStopWords(stationName);

  // 1. Exact match (normalized)
  for (const osm of osmNormalized) {
    if (norm === osm.norm && norm.length > 1) {
      return { osm, method: 'exact' };
    }
  }

  // 1b. Exact match without stop words
  if (normNoStop.length > 2) {
    for (const osm of osmNormalized) {
      if (normNoStop === osm.normNoStop && normNoStop.length > 1) {
        return { osm, method: 'exact_no_stop' };
      }
    }
  }

  // 2. Fuzzy similarity
  let bestFuzzy = null;
  let bestFuzzySim = 0;
  for (const osm of osmNormalized) {
    if (osm.normNoStop.length < 2) continue;
    const sim = similarity(normNoStop, osm.normNoStop);
    if (sim > bestFuzzySim) {
      bestFuzzySim = sim;
      bestFuzzy = osm;
    }
  }
  if (bestFuzzySim >= FUZZY_THRESHOLD && bestFuzzy) {
    return { osm: bestFuzzy, method: 'fuzzy', sim: bestFuzzySim };
  }

  // 3. Keyword overlap
  if (normNoStop.split(' ').length >= 2) {
    let bestKw = null;
    let bestKwScore = 0;
    for (const osm of osmNormalized) {
      if (osm.normNoStop.length < 2) continue;
      const score = keywordOverlap(normNoStop, osm.normNoStop);
      if (score > bestKwScore) {
        bestKwScore = score;
        bestKw = osm;
      }
    }
    if (bestKwScore >= KEYWORD_THRESHOLD && bestKw) {
      return { osm: bestKw, method: 'keyword', score: bestKwScore };
    }
  }

  return null;
}

// ─── Route interpolation ─────────────────────────────────────────

async function getStationCoords(stationId) {
  const { rows } = await pool.query(
    'SELECT latitude, longitude FROM stations WHERE station_id = $1 AND latitude != 0 AND longitude != 0',
    [stationId]
  );
  return rows.length > 0 ? rows[0] : null;
}

async function interpolateFromRoute(station) {
  for (const routeId of station.route_ids) {
    const routeStations = routeStationMap[routeId];
    if (!routeStations) continue;

    const idx = routeStations.findIndex(s => s.station_id === station.station_id);
    if (idx < 0) continue;

    // Find previous and next station with coordinates
    let prevCoords = null, nextCoords = null;

    for (let i = idx - 1; i >= 0; i--) {
      const c = await getStationCoords(routeStations[i].station_id);
      if (c) { prevCoords = c; break; }
    }
    for (let i = idx + 1; i < routeStations.length; i++) {
      const c = await getStationCoords(routeStations[i].station_id);
      if (c) { nextCoords = c; break; }
    }

    if (prevCoords && nextCoords) {
      return {
        latitude: (parseFloat(prevCoords.latitude) + parseFloat(nextCoords.latitude)) / 2,
        longitude: (parseFloat(prevCoords.longitude) + parseFloat(nextCoords.longitude)) / 2,
      };
    }
    // If only one neighbor has coords, use it with a small offset
    if (prevCoords) {
      return {
        latitude: parseFloat(prevCoords.latitude) + 0.001,
        longitude: parseFloat(prevCoords.longitude) + 0.001,
      };
    }
    if (nextCoords) {
      return {
        latitude: parseFloat(nextCoords.latitude) - 0.001,
        longitude: parseFloat(nextCoords.longitude) - 0.001,
      };
    }
  }
  return null;
}

// ─── Main ────────────────────────────────────────────────────────

(async () => {
  const stats = {
    stations_total: 0,
    matched_exact: 0,
    matched_exact_no_stop: 0,
    matched_fuzzy: 0,
    matched_keyword: 0,
    interpolated_route: 0,
    placeholders_created: 0,
    still_missing: 0,
  };

  const resolved = [];      // stations that got coords
  const stillMissing = [];   // stations with no coords

  // Flatten missing stations
  const allMissing = [];
  for (const [network, stations] of Object.entries(missing)) {
    for (const s of stations) {
      allMissing.push({ ...s, transport_network: network });
    }
  }
  stats.stations_total = allMissing.length;
  console.log(`\nProcessing ${allMissing.length} missing stations...\n`);

  // Phase 1: OSM matching
  for (const station of allMissing) {
    const match = findOsmMatch(station.station_name);
    if (match) {
      station.latitude = match.osm.latitude;
      station.longitude = match.osm.longitude;
      station.source = 'osm';
      station.osm_name = match.osm.name;
      station.match_method = match.method;
      resolved.push(station);

      if (match.method === 'exact') stats.matched_exact++;
      else if (match.method === 'exact_no_stop') stats.matched_exact_no_stop++;
      else if (match.method === 'fuzzy') stats.matched_fuzzy++;
      else if (match.method === 'keyword') stats.matched_keyword++;
    }
  }

  const afterOsm = allMissing.filter(s => !s.latitude);
  console.log(`After OSM matching: ${resolved.length} matched, ${afterOsm.length} remaining`);

  // Phase 2: Route interpolation
  console.log('Running route interpolation...');
  const afterInterp = [];
  for (const station of afterOsm) {
    const coords = await interpolateFromRoute(station);
    if (coords) {
      station.latitude = coords.latitude;
      station.longitude = coords.longitude;
      station.source = 'route_interpolation';
      resolved.push(station);
      stats.interpolated_route++;
    } else {
      afterInterp.push(station);
    }
  }
  console.log(`After interpolation: ${stats.interpolated_route} interpolated, ${afterInterp.length} remaining`);

  // Phase 3: Placeholders (use route context for approximate positioning)
  for (const station of afterInterp) {
    // Try to get any station in the same route with coords
    let foundAny = false;
    for (const routeId of station.route_ids) {
      const routeStations = routeStationMap[routeId];
      if (!routeStations) continue;
      for (const rs of routeStations) {
        const c = await getStationCoords(rs.station_id);
        if (c) {
          // Place near this station with offset based on station_order difference
          const idx = routeStations.findIndex(s => s.station_id === station.station_id);
          const refIdx = routeStations.findIndex(s => s.station_id === rs.station_id);
          const offset = (idx - refIdx) * 0.002;
          station.latitude = parseFloat(c.latitude) + offset;
          station.longitude = parseFloat(c.longitude) + offset;
          station.source = 'route_placeholder';
          resolved.push(station);
          stats.placeholders_created++;
          foundAny = true;
          break;
        }
      }
      if (foundAny) break;
    }
    if (!foundAny) {
      station.reason = 'not_found_osm';
      stillMissing.push(station);
      stats.still_missing++;
    }
  }

  console.log(`After placeholders: ${stats.placeholders_created} placeholders, ${stats.still_missing} still missing\n`);

  // ─── Generate output files ──────────────────────────────────────

  // 1. geocoded_stations_final.json (merge existing geocoded + newly resolved)
  const { rows: existingGeocoded } = await pool.query(
    `SELECT station_id, station_name, transport_network, latitude, longitude
     FROM stations WHERE latitude != 0 AND longitude != 0`
  );

  const finalByNetwork = {};
  for (const r of existingGeocoded) {
    if (!finalByNetwork[r.transport_network]) finalByNetwork[r.transport_network] = [];
    finalByNetwork[r.transport_network].push({
      station_id: r.station_id,
      station_name: r.station_name,
      latitude: parseFloat(r.latitude),
      longitude: parseFloat(r.longitude),
      source: 'nominatim',
    });
  }
  for (const s of resolved) {
    if (!finalByNetwork[s.transport_network]) finalByNetwork[s.transport_network] = [];
    finalByNetwork[s.transport_network].push({
      station_id: s.station_id,
      station_name: s.station_name,
      latitude: s.latitude,
      longitude: s.longitude,
      source: s.source,
      osm_name: s.osm_name || undefined,
    });
  }

  const finalDest = path.resolve(__dirname, '..', 'src', 'data', 'geocoded_stations_final.json');
  fs.writeFileSync(finalDest, JSON.stringify(finalByNetwork, null, 2), 'utf-8');

  // 2. missing_after_osm.json
  const missingDest = path.resolve(__dirname, '..', 'src', 'data', 'missing_after_osm.json');
  fs.writeFileSync(missingDest, JSON.stringify(stillMissing, null, 2), 'utf-8');

  // 3. Update PostgreSQL
  console.log('Updating PostgreSQL...');
  let dbUpdated = 0;
  for (const s of resolved) {
    await pool.query(
      'UPDATE stations SET latitude = $1, longitude = $2 WHERE station_id = $3',
      [s.latitude, s.longitude, s.station_id]
    );
    dbUpdated++;
  }
  console.log(`  ${dbUpdated} stations updated in DB\n`);

  // ─── Stats ──────────────────────────────────────────────────────

  const totalGeocoded = existingGeocoded.length + resolved.length;
  console.log('═══════════════════════════════════════════');
  console.log('  RÉSULTATS');
  console.log('═══════════════════════════════════════════');
  console.log(`  Stations manquantes traitées : ${stats.stations_total}`);
  console.log(`  ─────────────────────────────`);
  console.log(`  OSM exact            : ${stats.matched_exact}`);
  console.log(`  OSM exact (no stop)  : ${stats.matched_exact_no_stop}`);
  console.log(`  OSM fuzzy (>0.85)    : ${stats.matched_fuzzy}`);
  console.log(`  OSM keyword          : ${stats.matched_keyword}`);
  console.log(`  Route interpolation  : ${stats.interpolated_route}`);
  console.log(`  Route placeholder    : ${stats.placeholders_created}`);
  console.log(`  Toujours manquantes  : ${stats.still_missing}`);
  console.log(`  ─────────────────────────────`);
  console.log(`  TOTAL géocodées      : ${totalGeocoded} / ${existingGeocoded.length + stats.stations_total}`);
  console.log('═══════════════════════════════════════════');
  console.log(`\nFichiers générés :`);
  console.log(`  ${finalDest}`);
  console.log(`  ${missingDest}`);

  await pool.end();
})();
