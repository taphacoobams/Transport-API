const { Router } = require('express');
const { getStations, getStation } = require('../controllers/stationController');
const { getRoutes, computeRoute } = require('../controllers/routeController');
const { getAllRoutesGeoJSON } = require('../controllers/mapController');

const router = Router();

// Stations
router.get('/stations', getStations);
router.get('/stations/:id', getStation);

// Routes
router.get('/routes', getRoutes);

// Map (GeoJSON)
router.get('/map/routes', getAllRoutesGeoJSON);

// Routing (multimodal itinerary)
router.get('/route', computeRoute);

module.exports = router;
