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

async function getStats(req, res) {
  try {
    const stats = await dbService.getStats();
    res.json({
      success: true,
      data: stats,
    });
  } catch (err) {
    console.error('Error fetching stats:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

module.exports = { getTransportTypes, getStats };
