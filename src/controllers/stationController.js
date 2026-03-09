const stationService = require('../services/stationService');

async function getStations(req, res) {
  try {
    const { network, limit, offset } = req.query;
    const stations = await stationService.getAllStations({
      transport_network: network || undefined,
      limit: limit ? parseInt(limit) : 500,
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

async function getStation(req, res) {
  try {
    const { id } = req.params;
    const station = await stationService.getStationById(id);
    if (!station) {
      return res.status(404).json({ success: false, error: 'Station not found' });
    }
    res.json({ success: true, data: station });
  } catch (err) {
    console.error('Error fetching station:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

module.exports = { getStations, getStation };
