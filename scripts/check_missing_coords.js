require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  const { rows } = await pool.query(
    `SELECT station_id, station_name, transport_network
     FROM stations
     WHERE latitude = 0 AND longitude = 0
     ORDER BY transport_network, station_name`
  );

  console.log(`\n=== Stations sans coordonnées (${rows.length} au total) ===\n`);

  const byNetwork = {};
  for (const r of rows) {
    if (!byNetwork[r.transport_network]) byNetwork[r.transport_network] = [];
    byNetwork[r.transport_network].push(r);
  }

  for (const [network, stations] of Object.entries(byNetwork)) {
    console.log(`--- ${network} (${stations.length}) ---`);
    for (const s of stations) {
      console.log(`  ${s.station_id}  →  ${s.station_name}`);
    }
    console.log();
  }

  const { rows: total } = await pool.query('SELECT count(*)::int as cnt FROM stations');
  const { rows: valid } = await pool.query('SELECT count(*)::int as cnt FROM stations WHERE latitude != 0 AND longitude != 0');
  console.log(`Résumé: ${valid[0].cnt} stations géocodées / ${total[0].cnt} au total (${rows.length} manquantes)`);
  await pool.end();
})();
