const pool = require('../src/config/db');

async function main() {
  // Find a DDD station that has correspondances in JSON (e.g. SGBS Yoff)
  const { rows: stations } = await pool.query(`
    SELECT s.id, s.station_code, s.station_name, n.network_code
    FROM stations s
    JOIN networks n ON n.id = s.network_id
    WHERE s.station_name ILIKE '%SGBS Yoff%'
  `);
  console.log('Station found:', stations);

  if (stations.length > 0) {
    const sid = stations[0].id;

    // Check route_stations for this station
    const { rows: rs } = await pool.query(`
      SELECT r.route_code, r.route_name, n.network_code
      FROM route_stations rs
      JOIN routes r ON r.id = rs.route_id
      JOIN networks n ON n.id = r.network_id
      WHERE rs.station_id = $1
    `, [sid]);
    console.log('Routes at this station:', rs);

    // Check transfer_edges
    const { rows: te } = await pool.query(`
      SELECT s2.station_name, n2.network_code, te.distance_meters
      FROM transfer_edges te
      JOIN stations s2 ON s2.id = te.to_station_id
      JOIN networks n2 ON n2.id = s2.network_id
      WHERE te.from_station_id = $1
    `, [sid]);
    console.log('Transfer edges:', te);
  }

  process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
