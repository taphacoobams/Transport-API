const { Router } = require('express');
const { getStations, getStation } = require('../controllers/stationController');
const { getRoutes, computeRoute } = require('../controllers/routeController');
const { getAllRoutesGeoJSON } = require('../controllers/mapController');
const { getItinerary } = require('../controllers/itinerary.controller');
const { invalidateCache } = require('../services/routingService');

const router = Router();

// Stations
router.get('/stations', getStations);
router.get('/stations/:id', getStation);

// Routes
router.get('/routes', getRoutes);

// Map (GeoJSON)
router.get('/map/routes', getAllRoutesGeoJSON);

// Routing (single best route — backward-compatible)
router.get('/route', computeRoute);

// Itinerary (up to 3 Dijkstra-based routes with full metadata)
router.get('/itinerary', getItinerary);

// Cache management
router.post('/cache/invalidate', (req, res) => {
  invalidateCache();
  res.json({ success: true, message: 'Routing graph cache invalidated.' });
});

module.exports = router;
