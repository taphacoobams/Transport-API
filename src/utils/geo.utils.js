/**
 * Geo utilities for coordinate validation and GeoJSON formatting.
 */

/**
 * Validate latitude value.
 * @param {number} lat
 * @returns {boolean}
 */
function isValidLat(lat) {
  const n = parseFloat(lat);
  return !isNaN(n) && n >= -90 && n <= 90;
}

/**
 * Validate longitude value.
 * @param {number} lon
 * @returns {boolean}
 */
function isValidLon(lon) {
  const n = parseFloat(lon);
  return !isNaN(n) && n >= -180 && n <= 180;
}

/**
 * Validate a coordinate pair.
 * @param {number} lat
 * @param {number} lon
 * @returns {boolean}
 */
function isValidCoordinate(lat, lon) {
  return isValidLat(lat) && isValidLon(lon);
}

/**
 * Convert a row with lat/lon into a GeoJSON Feature.
 * @param {object} row - Database row with lat, lon, and other properties.
 * @returns {object} GeoJSON Feature
 */
function toGeoJSONFeature(row) {
  const { latitude, longitude, geom, ...properties } = row;
  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [parseFloat(longitude), parseFloat(latitude)],
    },
    properties,
  };
}

/**
 * Convert an array of rows into a GeoJSON FeatureCollection.
 * @param {Array} rows - Array of database rows.
 * @returns {object} GeoJSON FeatureCollection
 */
function toGeoJSONCollection(rows) {
  return {
    type: 'FeatureCollection',
    features: rows.map(toGeoJSONFeature),
  };
}

/**
 * Haversine distance between two points in kilometers.
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} distance in km
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

module.exports = {
  isValidLat,
  isValidLon,
  isValidCoordinate,
  toGeoJSONFeature,
  toGeoJSONCollection,
  haversineDistance,
};
