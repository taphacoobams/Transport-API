const { Router } = require('express');
const { getTransportTypes } = require('../controllers/transport.controller');

const router = Router();

router.get('/transport-types', getTransportTypes);

module.exports = router;
