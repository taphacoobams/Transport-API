const pool = require('../src/config/db');

async function main() {
  const { rows } = await pool.query(`
    SELECT n.network_code, o.day_type, o.first_departure, o.last_departure,
           o.peak_frequency_minutes, o.offpeak_frequency_minutes, COUNT(*)::int as routes
    FROM operating_hours o
    JOIN routes r ON r.id = o.route_id
    JOIN networks n ON n.id = r.network_id
    GROUP BY n.network_code, o.day_type, o.first_departure, o.last_departure,
             o.peak_frequency_minutes, o.offpeak_frequency_minutes
    ORDER BY n.network_code, o.day_type
  `);
  console.table(rows);
  process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
