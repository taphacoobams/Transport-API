const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

(async () => {
  console.log('Generating walking transfer edges...');
  const { rows } = await pool.query(
    'SELECT station_id, transport_network, latitude, longitude FROM stations WHERE latitude != 0 AND longitude != 0'
  );
  console.log(`  Stations with valid coords: ${rows.length}`);

  const THRESHOLD = 300;
  let count = 0;

  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i], b = rows[j];
      if (a.transport_network === b.transport_network) continue;
      const dist = haversine(a.latitude, a.longitude, b.latitude, b.longitude);
      if (dist <= THRESHOLD) {
        const wt = Math.round((dist / 83) * 100) / 100;
        const dm = Math.round(dist * 100) / 100;
        await pool.query(
          'INSERT INTO transfer_edges (from_station, to_station, distance_meters, walking_time_minutes) VALUES ($1,$2,$3,$4)',
          [a.station_id, b.station_id, dm, wt]
        );
        await pool.query(
          'INSERT INTO transfer_edges (from_station, to_station, distance_meters, walking_time_minutes) VALUES ($1,$2,$3,$4)',
          [b.station_id, a.station_id, dm, wt]
        );
        count += 2;
      }
    }
  }
  console.log(`  Transfer edges created: ${count}`);
  await pool.end();
})();
