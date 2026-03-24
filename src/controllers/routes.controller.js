const dbService = require('../services/database.service');

async function getRoutes(req, res) {
  try {
    const { network_id } = req.query;
    const routes = await dbService.getAllRoutes({
      network_id: network_id ? parseInt(network_id) : undefined,
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

async function getRouteById(req, res) {
  try {
    const { id } = req.params;
    const route = await dbService.getRouteById(parseInt(id));
    if (!route) {
      return res.status(404).json({ success: false, error: 'Route not found' });
    }
    res.json({ success: true, data: route });
  } catch (err) {
    console.error('Error fetching route:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

async function getRouteStations(req, res) {
  try {
    const { id } = req.params;
    const route = await dbService.getRouteById(parseInt(id));
    if (!route) {
      return res.status(404).json({ success: false, error: 'Route not found' });
    }
    const stations = await dbService.getRouteStations(parseInt(id));
    res.json({
      success: true,
      route: route,
      count: stations.length,
      data: stations,
    });
  } catch (err) {
    console.error('Error fetching route stations:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

async function getTravelTime(req, res) {
  try {
    const { from, to, route } = req.query;
    if (!from || !to || !route) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: from, to, route',
      });
    }
    const travelTime = await dbService.getTravelTime(
      parseInt(route),
      parseInt(from),
      parseInt(to)
    );
    if (!travelTime) {
      return res.status(404).json({
        success: false,
        error: 'Travel time not found for the given parameters',
      });
    }
    res.json({ success: true, data: travelTime });
  } catch (err) {
    console.error('Error fetching travel time:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

module.exports = { getRoutes, getRouteById, getRouteStations, getTravelTime };
