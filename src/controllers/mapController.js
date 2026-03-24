const mapService = require('../services/mapService');

async function getAllRoutesGeoJSON(req, res) {
  try {
    const geojson = await mapService.getRoutesGeoJSON();

    res.json(geojson);
  } catch (err) {
    console.error('Error fetching routes GeoJSON:', err.message);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}

module.exports = { getAllRoutesGeoJSON };
