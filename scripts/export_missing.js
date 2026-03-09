const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// Load JSON datasets to map station_id → route_ids
const brt  = require('../src/data/brt.json');
const ter  = require('../src/data/ter.json');
const ddd  = require('../src/data/ddd.json');
const aftu = require('../src/data/aftu.json');

const datasets = [
  { prefix: 'brt',  network: 'BRT',  data: brt  },
  { prefix: 'ter',  network: 'TER',  data: ter  },
  { prefix: 'ddd',  network: 'DDD',  data: ddd  },
  { prefix: 'aftu', network: 'AFTU', data: aftu },
];

// Build a map: prefixed_station_id → [ route_id, ... ]
function buildStationRouteMap() {
  const map = {};
  for (const { prefix, data } of datasets) {
    for (const route of data.routes) {
      const routeId = `${prefix}_${route.route_id}`;
      for (const s of route.stations) {
        const sid = `${prefix}_${s.station_id}`;
        if (!map[sid]) map[sid] = [];
        if (!map[sid].includes(routeId)) map[sid].push(routeId);
      }
    }
  }
  return map;
}

(async () => {
  const stationRouteMap = buildStationRouteMap();

  const { rows } = await pool.query(
    `SELECT station_id, station_name, transport_network
     FROM stations
     WHERE latitude = 0 AND longitude = 0
     ORDER BY transport_network, station_name`
  );

  const out = {};
  for (const r of rows) {
    if (!out[r.transport_network]) out[r.transport_network] = [];
    out[r.transport_network].push({
      station_id: r.station_id,
      station_name: r.station_name,
      route_ids: stationRouteMap[r.station_id] || [],
      latitude: null,
      longitude: null,
    });
  }

  const dest = path.resolve(__dirname, '..', 'src', 'data', 'missing_stations.json');
  fs.writeFileSync(dest, JSON.stringify(out, null, 2), 'utf-8');
  console.log(`${rows.length} stations écrites dans ${dest}`);
  await pool.end();
})();
