require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  const { rows } = await pool.query(`
    SELECT 'stations' as tbl, count(*)::int as cnt FROM stations UNION ALL
    SELECT 'routes', count(*)::int FROM routes UNION ALL
    SELECT 'route_stations', count(*)::int FROM route_stations UNION ALL
    SELECT 'travel_times', count(*)::int FROM travel_times UNION ALL
    SELECT 'transport_edges', count(*)::int FROM transport_edges UNION ALL
    SELECT 'transfer_edges', count(*)::int FROM transfer_edges UNION ALL
    SELECT 'transport_types', count(*)::int FROM transport_types
  `);
  console.table(rows);
  await pool.end();
})();
