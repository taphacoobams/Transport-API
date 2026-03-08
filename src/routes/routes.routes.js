const { Router } = require('express');
const { getRoutes, getRouteById, getRouteStations, getTravelTime } = require('../controllers/routes.controller');

const router = Router();

router.get('/routes', getRoutes);
router.get('/routes/:id', getRouteById);
router.get('/routes/:id/stations', getRouteStations);
router.get('/travel-time', getTravelTime);

module.exports = router;
