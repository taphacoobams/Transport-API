const pool = require('../src/config/db');

async function audit() {
  const q = async (sql) => (await pool.query(sql)).rows;

  console.log('=== NETWORKS ===');
  console.table(await q('SELECT id, network_code, name, transport_type, total_stations, corridor_length_km FROM networks ORDER BY id'));

  console.log('\n=== ROUTES BRT + TER ===');
  console.table(await q(`
    SELECT n.network_code, r.route_code, r.route_name, r.route_type,
           r.origin_terminal, r.destination_terminal,
           r.station_count, r.estimated_duration_min, r.total_distance_km
    FROM routes r JOIN networks n ON n.id = r.network_id
    WHERE n.network_code IN ('BRT','TER')
    ORDER BY n.network_code, r.route_code
  `));

  console.log('\n=== 23 STATIONS BRT ===');
  console.table(await q(`
    SELECT s.station_name, s.district, s.latitude, s.longitude
    FROM stations s JOIN networks n ON n.id=s.network_id
    WHERE n.network_code='BRT' ORDER BY s.id
  `));

  console.log('\n=== 14 STATIONS TER ===');
  console.table(await q(`
    SELECT s.station_name, s.district, s.latitude, s.longitude
    FROM stations s JOIN networks n ON n.id=s.network_id
    WHERE n.network_code='TER' ORDER BY s.id
  `));

  console.log('\n=== ZONES (6 attendues) ===');
  console.table(await q(`
    SELECT z.zone_code, z.zone_name, n.network_code, COUNT(zs.id) as nb_stations
    FROM zones z
    JOIN networks n ON n.id=z.network_id
    LEFT JOIN zone_stations zs ON zs.zone_id=z.id
    GROUP BY z.id, z.zone_code, z.zone_name, n.network_code
    ORDER BY z.zone_code
  `));

  console.log('\n=== FARES ===');
  console.table(await q(`
    SELECT n.network_code, f.zones_travelled, f.price_fcfa
    FROM fares f JOIN networks n ON n.id=f.network_id
    ORDER BY n.network_code, f.zones_travelled
  `));

  console.log('\n=== OPERATING HOURS BRT + TER ===');
  console.table(await q(`
    SELECT r.route_code, o.day_type, o.first_departure, o.last_departure,
           o.peak_frequency_minutes, o.offpeak_frequency_minutes
    FROM operating_hours o
    JOIN routes r ON r.id=o.route_id
    JOIN networks n ON n.id=r.network_id
    WHERE n.network_code IN ('BRT','TER')
    ORDER BY r.route_code, o.day_type
  `));

  console.log('\n=== TRAVEL TIMES BRT (vérification segments) ===');
  console.table(await q(`
    SELECT r.route_code, s1.station_name as de, s2.station_name as vers, tt.travel_time_minutes
    FROM travel_times tt
    JOIN routes r ON r.id=tt.route_id
    JOIN stations s1 ON s1.id=tt.from_station_id
    JOIN stations s2 ON s2.id=tt.to_station_id
    JOIN networks n ON n.id=r.network_id
    WHERE n.network_code='BRT'
    ORDER BY r.route_code, tt.id
  `));

  console.log('\n=== TRANSFER EDGES inter-réseau (top 20) ===');
  console.table(await q(`
    SELECT s1.station_name as from_station, n1.network_code as from_net,
           s2.station_name as to_station, n2.network_code as to_net,
           t.distance_meters, t.walking_time_minutes
    FROM transfer_edges t
    JOIN stations s1 ON s1.id=t.from_station_id
    JOIN stations s2 ON s2.id=t.to_station_id
    JOIN networks n1 ON n1.id=s1.network_id
    JOIN networks n2 ON n2.id=s2.network_id
    WHERE n1.network_code != n2.network_code
    ORDER BY t.distance_meters LIMIT 20
  `));

  console.log('\n=== RÉSUMÉ GLOBAL ===');
  const tables = ['networks','stations','routes','route_stations','travel_times',
    'transport_edges','transfer_edges','zones','zone_stations','fares','operating_hours'];
  for (const t of tables) {
    const r = await q(`SELECT COUNT(*) as cnt FROM ${t}`);
    console.log(`  ${t.padEnd(20)} ${r[0].cnt}`);
  }

  process.exit(0);
}

audit().catch(e => { console.error(e.message); process.exit(1); });
