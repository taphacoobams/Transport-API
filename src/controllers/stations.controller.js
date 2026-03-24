const dbService = require('../services/database.service');
const { toGeoJSONCollection } = require('../utils/geo.utils');

async function getStations(req, res) {
  try {
    const { network_id, limit, offset } = req.query;
    const stations = await dbService.getAllStations({
      network_id: network_id ? parseInt(network_id) : undefined,
      limit: limit ? parseInt(limit) : 100,
      offset: offset ? parseInt(offset) : 0,
    });
    res.json({
      success: true,
      count: stations.length,
      data: stations,
    });
  } catch (err) {
    console.error('Error fetching stations:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

async function getStationById(req, res) {
  try {
    const { id } = req.params;
    const station = await dbService.getStationById(parseInt(id));
    if (!station) {
      return res.status(404).json({ success: false, error: 'Station not found' });
    }
    res.json({ success: true, data: station });
  } catch (err) {
    console.error('Error fetching station:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

async function getStationsGeoJSON(req, res) {
  try {
    const { network_id } = req.query;
    const stations = await dbService.getStationsGeoJSON({
      network_id: network_id ? parseInt(network_id) : undefined,
    });
    const geojson = toGeoJSONCollection(stations);
    res.json(geojson);
  } catch (err) {
    console.error('Error fetching stations GeoJSON:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

module.exports = { getStations, getStationById, getStationsGeoJSON };
