const stationService = require('../services/stationService');
const routingService = require('../services/routingService');
const localityService = require('../services/localityService');

async function getRoutes(req, res) {
  try {
    const { network } = req.query;
    const routes = await stationService.getAllRoutes({
      transport_network: network || undefined,
    });
    res.json({
      success: true,
      count: routes.length,
      data: routes,
    });
  } catch (err) {
    console.error('Error fetching routes:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

async function computeRoute(req, res) {
  try {
    const { from, to, from_lat, from_lon, to_lat, to_lon } = req.query;

    // Normalize origin
    const origin = await localityService.normalizeInput({
      text: from || null,
      lat: from_lat || null,
      lon: from_lon || null,
    });

    if (!origin) {
      return res.status(400).json({
        success: false,
        error: 'Could not resolve origin. Provide valid coordinates, a station name, or a locality name.',
      });
    }

    // Normalize destination
    const dest = await localityService.normalizeInput({
      text: to || null,
      lat: to_lat || null,
      lon: to_lon || null,
    });

    if (!dest) {
      return res.status(400).json({
        success: false,
        error: 'Could not resolve destination. Provide valid coordinates, a station name, or a locality name.',
      });
    }

    const result = await routingService.computeRoute(origin, dest);

    if (result.error) {
      return res.status(404).json({ success: false, error: result.error });
    }

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Error computing route:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

module.exports = { getRoutes, computeRoute };
