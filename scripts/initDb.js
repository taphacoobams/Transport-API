/**
 * Initialise la base de données en exécutant le schéma SQL
 * Usage: node scripts/initDb.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function main() {
  console.log('🗄️  Initialisation de la base de données...\n');

  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');

  const client = await pool.connect();

  try {
    await client.query(schema);
    console.log('✅ Schéma créé avec succès!');
    console.log('\nTables créées:');
    const tables = [
      'networks', 'stations', 'routes', 'route_stations',
      'travel_times', 'transport_edges', 'transfer_edges',
      'zones', 'zone_stations', 'fares', 'operating_hours',
    ];
    tables.forEach(t => console.log(`  - ${t}`));
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
