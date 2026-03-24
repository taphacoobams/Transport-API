const routingService = require('../services/routingService');
const localityService = require('../services/localityService');
const { isValidCoordinate } = require('../utils/geo.utils');

async function getItinerary(req, res) {
  try {
    const {
      origin_lat, origin_lon, destination_lat, destination_lon,
      from, to, departure_time,
    } = req.query;

    // Resolve origin: coordinates OR text-based (station name / locality)
    let origin = null;
    if (origin_lat && origin_lon) {
      if (!isValidCoordinate(origin_lat, origin_lon)) {
        return res.status(400).json({ success: false, error: 'Invalid origin coordinates' });
      }
      const oLat = parseFloat(origin_lat);
      const oLon = parseFloat(origin_lon);
      origin = { latitude: oLat, longitude: oLon, label: `${oLat},${oLon}` };
    } else if (from) {
      origin = await localityService.normalizeInput({ text: from });
    }

    if (!origin) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid origin. Provide origin_lat/origin_lon or from=<station/locality>.',
      });
    }

    // Resolve destination: coordinates OR text-based
    let dest = null;
    if (destination_lat && destination_lon) {
      if (!isValidCoordinate(destination_lat, destination_lon)) {
        return res.status(400).json({ success: false, error: 'Invalid destination coordinates' });
      }
      const dLat = parseFloat(destination_lat);
      const dLon = parseFloat(destination_lon);
      dest = { latitude: dLat, longitude: dLon, label: `${dLat},${dLon}` };
    } else if (to) {
      dest = await localityService.normalizeInput({ text: to });
    }

    if (!dest) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid destination. Provide destination_lat/destination_lon or to=<station/locality>.',
      });
    }

    // Build routing options
    const options = {};
    if (departure_time) {
      options.departure_time = departure_time;
    }

    const result = await routingService.computeRoutes(origin, dest, 3, options);

    if (result.error) {
      return res.status(404).json({ success: false, error: result.error });
    }

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Error computing itinerary:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

module.exports = { getItinerary };
