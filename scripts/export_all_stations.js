const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

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

function buildStationInfo() {
  const map = {};
  for (const { prefix, data } of datasets) {
    for (const route of data.routes) {
      const routeId = `${prefix}_${route.route_id}`;
      for (const s of route.stations) {
        const sid = `${prefix}_${s.station_id}`;
        if (!map[sid]) {
          map[sid] = { original_station_id: s.station_id, station_name: s.station_name, route_ids: [] };
        }
        if (!map[sid].route_ids.includes(routeId)) map[sid].route_ids.push(routeId);
      }
    }
  }
  return map;
}

(async () => {
  const infoMap = buildStationInfo();
  const { rows } = await pool.query(
    `SELECT station_id, station_name, transport_network, latitude, longitude
     FROM stations ORDER BY transport_network, station_name`
  );

  const out = {};
  for (const r of rows) {
    if (!out[r.transport_network]) out[r.transport_network] = [];
    const info = infoMap[r.station_id];
    out[r.transport_network].push({
      station_id: r.station_id,
      original_station_id: info ? info.original_station_id : r.station_id,
      station_name: info ? info.station_name : r.station_name,
      route_ids: info ? info.route_ids : [],
      latitude: parseFloat(r.latitude),
      longitude: parseFloat(r.longitude),
    });
  }

  const dest = path.resolve(__dirname, '..', 'src', 'data', 'all_stations.json');
  fs.writeFileSync(dest, JSON.stringify(out, null, 2), 'utf-8');
  console.log(`${rows.length} stations écrites dans ${dest}`);
  await pool.end();
})();
