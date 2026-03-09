const db = require('../config/database');

const FRONTIERES_API_URL = process.env.FRONTIERES_API_URL || 'https://frontieres-api.vercel.app';

/**
 * Resolve a locality name to coordinates using the Frontieres API.
 * @param {string} name - Locality name (e.g. "liberte 6")
 * @returns {Promise<{latitude: number, longitude: number}|null>}
 */
async function resolveLocality(name) {
  const url = `${FRONTIERES_API_URL}/api/localites?name=${encodeURIComponent(name)}`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'dakar-move/1.0' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.latitude && data.longitude) {
      return { latitude: parseFloat(data.latitude), longitude: parseFloat(data.longitude) };
    }
    // Handle array response
    if (Array.isArray(data) && data.length > 0) {
      const loc = data[0];
      if (loc.latitude && loc.longitude) {
        return { latitude: parseFloat(loc.latitude), longitude: parseFloat(loc.longitude) };
      }
    }
  } catch (err) {
    console.warn(`Frontieres API error for "${name}":`, err.message);
  }
  return null;
}

/**
 * Resolve a station_id to its coordinates from the database.
 * @param {string} stationId - e.g. "brt_liberte_6"
 * @returns {Promise<{latitude: number, longitude: number, station_id: string, station_name: string}|null>}
 */
async function resolveStation(stationId) {
  const { rows } = await db.query(
    'SELECT station_id, station_name, latitude, longitude FROM stations WHERE station_id = $1',
    [stationId]
  );
  if (rows.length > 0 && rows[0].latitude && rows[0].longitude) {
    return rows[0];
  }
  return null;
}

/**
 * Try to find a station by partial name match.
 * @param {string} name
 * @returns {Promise<{latitude: number, longitude: number, station_id: string, station_name: string}|null>}
 */
async function resolveStationByName(name) {
  // Accent-insensitive helper: translate common French accented chars
  const unaccent = (col) =>
    `TRANSLATE(LOWER(${col}), 'àâäéèêëïîôùûüç', 'aaaeeeeiioouuc')`;

  const { rows } = await db.query(
    `SELECT station_id, station_name, latitude, longitude
     FROM stations
     WHERE ${unaccent('station_name')} = ${unaccent('$1')}
       AND latitude != 0 AND longitude != 0
     LIMIT 1`,
    [name]
  );
  if (rows.length > 0) return rows[0];

  // Fuzzy: try LIKE (accent-insensitive)
  const { rows: fuzzy } = await db.query(
    `SELECT station_id, station_name, latitude, longitude
     FROM stations
     WHERE ${unaccent('station_name')} LIKE ${unaccent('$1')}
       AND latitude != 0 AND longitude != 0
     ORDER BY LENGTH(station_name)
     LIMIT 1`,
    [`%${name}%`]
  );
  if (fuzzy.length > 0) return fuzzy[0];

  return null;
}

/**
 * Normalize an input (from/to) into GPS coordinates.
 *
 * Cases:
 *   1. GPS coordinates provided (lat/lon params)
 *   2. Input matches a station_id (e.g. "brt_liberte_6")
 *   3. Input matches a station name
 *   4. Input is a locality name → query Frontieres API
 *
 * @param {object} params - { text, lat, lon }
 * @returns {Promise<{ latitude: number, longitude: number, station_id?: string, label: string }>}
 */
async function normalizeInput({ text, lat, lon }) {
  // Case 1: GPS coordinates provided
  if (lat != null && lon != null) {
    const la = parseFloat(lat);
    const lo = parseFloat(lon);
    if (!isNaN(la) && !isNaN(lo)) {
      return { latitude: la, longitude: lo, label: `${la},${lo}` };
    }
  }

  if (!text) return null;

  // Case 2: station_id (contains network prefix pattern like "brt_", "ter_", "ddd_", "aftu_")
  const station = await resolveStation(text);
  if (station) {
    return {
      latitude: station.latitude,
      longitude: station.longitude,
      station_id: station.station_id,
      label: station.station_name,
    };
  }

  // Case 3: station name match
  const stationByName = await resolveStationByName(text);
  if (stationByName) {
    return {
      latitude: stationByName.latitude,
      longitude: stationByName.longitude,
      station_id: stationByName.station_id,
      label: stationByName.station_name,
    };
  }

  // Case 4: locality name → Frontieres API
  const locality = await resolveLocality(text);
  if (locality) {
    return {
      latitude: locality.latitude,
      longitude: locality.longitude,
      label: text,
    };
  }

  return null;
}

module.exports = { resolveLocality, resolveStation, resolveStationByName, normalizeInput };
