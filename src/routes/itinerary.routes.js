const { Router } = require('express');
const { getItinerary } = require('../controllers/itinerary.controller');

const router = Router();

router.get('/itinerary', getItinerary);

module.exports = router;
