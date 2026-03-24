const dbService = require('../services/database.service');

async function getTransportTypes(req, res) {
  try {
    const types = await dbService.getAllNetworks();
    res.json({
      success: true,
      count: types.length,
      data: types,
    });
  } catch (err) {
    console.error('Error fetching transport types:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

module.exports = { getTransportTypes };
