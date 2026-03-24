const { Router } = require('express');
const { getTransportTypes, getStats } = require('../controllers/transport.controller');

const router = Router();

router.get('/networks', getTransportTypes);
router.get('/stats', getStats);

module.exports = router;
