const { Router } = require('express');
const { getTransportTypes } = require('../controllers/transport.controller');

const router = Router();

router.get('/networks', getTransportTypes);

module.exports = router;
