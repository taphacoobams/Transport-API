const routingService = require('../services/routing.service');
const { isValidCoordinate } = require('../utils/geo.utils');

async function getItinerary(req, res) {
  try {
    const { origin_lat, origin_lon, destination_lat, destination_lon } = req.query;

    if (!origin_lat || !origin_lon || !destination_lat || !destination_lon) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: origin_lat, origin_lon, destination_lat, destination_lon',
      });
    }

    if (!isValidCoordinate(origin_lat, origin_lon)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid origin coordinates',
      });
    }

    if (!isValidCoordinate(destination_lat, destination_lon)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid destination coordinates',
      });
    }

    const result = await routingService.computeItinerary(
      parseFloat(origin_lat),
      parseFloat(origin_lon),
      parseFloat(destination_lat),
      parseFloat(destination_lon)
    );

    if (result.error) {
      return res.status(404).json({ success: false, ...result });
    }

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Error computing itinerary:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

module.exports = { getItinerary };
