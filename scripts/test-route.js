/**
 * Quick test of the /api/route endpoint with geometry
 */
process.env.NODE_ENV = 'test';
const http = require('http');
const app = require('../src/server');

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch { resolve({ raw: d }); }
      });
    }).on('error', reject);
  });
}

async function main() {
  const server = app.listen(3002, async () => {
    try {
      // Test 1: /api/route with GPS coords (BRT corridor)
      console.log('=== TEST 1: /api/route GPS coords ===');
      const r1 = await get('http://localhost:3002/api/route?from_lat=14.7257&from_lon=-17.4597&to_lat=14.7724&to_lon=-17.3876');
      if (r1.success && r1.data) {
        console.log('  origin:', r1.data.origin);
        console.log('  destination:', r1.data.destination);
        console.log('  duration:', r1.data.total_duration_minutes, 'min');
        console.log('  steps:', r1.data.steps?.length);
        r1.data.steps?.forEach((s, i) => {
          const hasGeo = s.geometry && s.geometry.coordinates?.length >= 2;
          console.log(`  step ${i}: ${s.mode} ${s.route || ''} | ${s.from} → ${s.to} | ${s.duration_minutes}min | geometry: ${hasGeo ? s.geometry.coordinates.length + ' pts' : 'NONE'}`);
        });
        const hasTopGeo = r1.data.geometry?.features?.length > 0;
        console.log('  top-level geometry:', hasTopGeo ? r1.data.geometry.features.length + ' features' : 'NONE');
      } else {
        console.log('  ERROR:', r1.error || JSON.stringify(r1).slice(0, 200));
      }

      // Test 2: /api/itinerary with GPS coords
      console.log('\n=== TEST 2: /api/itinerary GPS coords ===');
      const r2 = await get('http://localhost:3002/api/itinerary?origin_lat=14.7257&origin_lon=-17.4597&destination_lat=14.7724&destination_lon=-17.3876');
      if (r2.success && r2.data) {
        console.log('  itineraries:', r2.data.itineraries?.length);
        r2.data.itineraries?.forEach((it, i) => {
          console.log(`  itinerary ${i}: ${it.type} | ${it.total_minutes}min | ${it.steps?.length} steps`);
          const hasGeo = it.geometry?.features?.length > 0;
          console.log(`    geometry: ${hasGeo ? it.geometry.features.length + ' features' : 'NONE'}`);
          it.steps?.forEach((s, j) => {
            const geo = s.geometry?.coordinates?.length || 0;
            console.log(`    step ${j}: ${s.action} ${s.route || ''} | ${s.from} → ${s.to} | ${s.duration_minutes}min | geometry: ${geo} pts${s.color ? ' | color: ' + s.color : ''}`);
          });
        });
      } else {
        console.log('  result:', JSON.stringify(r2).slice(0, 500));
      }

      // Test 3: /api/stats
      console.log('\n=== TEST 3: /api/stats ===');
      const r3 = await get('http://localhost:3002/api/stats');
      if (r3.success) {
        const d = r3.data;
        console.log('  TOTAUX:', JSON.stringify(d.totals, null, 0));
        console.log('  RÉSEAUX:');
        d.networks?.forEach(n => console.log(`    ${n.network_code}: ${n.stations} stations, ${n.routes} routes, ${n.zones} zones, ${n.fares} tarifs, ${n.stations_with_correspondance} correspondances`));
        console.log('  CORRESPONDANCES:');
        d.correspondances?.forEach(c => console.log(`    ${c.network_a}↔${c.network_b}: ${c.pairs} paires, ~${c.avg_distance_meters}m, ~${c.avg_walking_minutes}min`));
        console.log('  TOP CORRESPONDANCES:');
        d.top_correspondances?.slice(0, 5).forEach(t => console.log(`    ${t.station_a}(${t.network_a}) ↔ ${t.station_b}(${t.network_b}): ${t.distance_meters}m`));
        console.log('  TARIFS:', d.fares?.length);
        console.log('  HORAIRES:', d.horaires?.length);
      } else {
        console.log('  ERROR:', r3.error || JSON.stringify(r3).slice(0, 300));
      }

      // Test 4: /api/stations/:id with correspondances
      console.log('\n=== TEST 4: /api/stations/:id (avec correspondances) ===');
      const r4 = await get('http://localhost:3002/api/stations/500');
      if (r4.success) {
        const s = r4.data;
        console.log(`  Station: ${s.station_name} (${s.network_name})`);
        console.log(`  Lines: ${s.lines?.length}`);
        s.lines?.forEach(l => console.log(`    ${l.network_code} ${l.route_name}`));
        console.log(`  Correspondances: ${s.correspondances?.length}`);
        s.correspondances?.forEach(c => console.log(`    → ${c.station_name} (${c.network_code}) ${c.distance_meters}m, ${c.walking_time_minutes}min`));
      } else {
        console.log('  ERROR:', r4.error || JSON.stringify(r4).slice(0, 300));
      }

    } catch (e) {
      console.error('ERROR:', e.message);
      console.error(e.stack);
    } finally {
      server.close();
      process.exit(0);
    }
  });
}

main();
