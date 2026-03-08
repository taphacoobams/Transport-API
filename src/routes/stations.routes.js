const { Router } = require('express');
const { getStations, getStationById, getStationsGeoJSON } = require('../controllers/stations.controller');

const router = Router();

router.get('/stations', getStations);
router.get('/stations/:id', getStationById);
router.get('/map/stations', getStationsGeoJSON);

module.exports = router;
