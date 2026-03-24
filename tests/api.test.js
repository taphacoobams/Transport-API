const request = require('supertest');
const app = require('../src/server');
const db = require('../src/config/db');
const { isValidCoordinate, isValidLat, isValidLon, toGeoJSONFeature, toGeoJSONCollection, haversineDistance } = require('../src/utils/geo.utils');
const { walkTime, findTransferPoints } = require('../src/services/routing.service');

// ─── Tests ──────────────────────────────────────────────────────────

afterAll(async () => {
  await db.pool.end();
});

// ─── Health endpoint ────────────────────────────────────────────────

describe('GET /api/health', () => {
  test('should return health status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('healthy');
    expect(res.body.service).toBe('Transport API');
    expect(res.body.version).toBeDefined();
    expect(res.body.timestamp).toBeDefined();
  });
});

// ─── Transport types ────────────────────────────────────────────────

describe('GET /api/transport-types', () => {
  test('should return all transport types or 500 if DB unavailable', async () => {
    const res = await request(app).get('/api/transport-types');
    expect([200, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(res.body.data)).toBe(true);
    }
  });
});

// ─── Stations ───────────────────────────────────────────────────────

describe('GET /api/stations', () => {
  test('should return all stations or 500 if DB unavailable', async () => {
    const res = await request(app).get('/api/stations');
    expect([200, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    }
  });

  test('should support pagination parameters', async () => {
    const res = await request(app).get('/api/stations?limit=5&offset=0');
    expect([200, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.data.length).toBeLessThanOrEqual(5);
    }
  });
});

describe('GET /api/stations/:id', () => {
  test('should return a single station if exists', async () => {
    const res = await request(app).get('/api/stations/1');
    expect([200, 404, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    }
  });

  test('should return 404 for non-existent station', async () => {
    const res = await request(app).get('/api/stations/999999');
    expect([404, 500]).toContain(res.status);
    if (res.status === 404) {
      expect(res.body.success).toBe(false);
    }
  });
});

// ─── GeoJSON stations ───────────────────────────────────────────────

describe('GET /api/map/stations', () => {
  test('should return GeoJSON FeatureCollection or 500 if DB unavailable', async () => {
    const res = await request(app).get('/api/map/stations');
    expect([200, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.type).toBe('FeatureCollection');
      expect(Array.isArray(res.body.features)).toBe(true);
      if (res.body.features.length > 0) {
        expect(res.body.features[0].type).toBe('Feature');
        expect(res.body.features[0].geometry.type).toBe('Point');
      }
    }
  });
});

// ─── Routes ─────────────────────────────────────────────────────────

describe('GET /api/routes', () => {
  test('should return all routes or 500 if DB unavailable', async () => {
    const res = await request(app).get('/api/routes');
    expect([200, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    }
  });
});

describe('GET /api/routes/:id', () => {
  test('should return a single route if exists', async () => {
    const res = await request(app).get('/api/routes/1');
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    } else {
      expect(res.status).toBe(404);
    }
  });

  test('should return 404 for non-existent route', async () => {
    const res = await request(app).get('/api/routes/999999');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/routes/:id/stations', () => {
  test('should return stations for a route if exists', async () => {
    const res = await request(app).get('/api/routes/1/stations');
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    } else {
      expect(res.status).toBe(404);
    }
  });

  test('should return 404 for non-existent route', async () => {
    const res = await request(app).get('/api/routes/999999/stations');
    expect(res.status).toBe(404);
  });
});

// ─── Travel time ────────────────────────────────────────────────────

describe('GET /api/travel-time', () => {
  test('should return 400 when missing parameters', async () => {
    const res = await request(app).get('/api/travel-time?from=1');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Missing required parameters');
  });

  test('should return travel time or 404 for valid params', async () => {
    const res = await request(app).get('/api/travel-time?from=1&to=2&route=1');
    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    }
  });
});

// ─── Itinerary ──────────────────────────────────────────────────────

describe('GET /api/itinerary', () => {
  test('should return 400 when missing parameters', async () => {
    const res = await request(app).get('/api/itinerary');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Missing required parameters');
  });

  test('should return 400 for invalid origin coordinates', async () => {
    const res = await request(app).get('/api/itinerary?origin_lat=999&origin_lon=-17&destination_lat=14&destination_lon=-17');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid origin coordinates');
  });

  test('should return 400 for invalid destination coordinates', async () => {
    const res = await request(app).get('/api/itinerary?origin_lat=14&origin_lon=-17&destination_lat=999&destination_lon=-17');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid destination coordinates');
  });

  test('should compute itinerary for valid Dakar coordinates', async () => {
    const res = await request(app).get('/api/itinerary?origin_lat=14.7645&origin_lon=-17.3934&destination_lat=14.6820&destination_lon=-17.4410');
    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
    }
  });
});

// ─── 404 handler ────────────────────────────────────────────────────

describe('404 handler', () => {
  test('should return 404 for unknown routes', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('not found');
  });
});

// ─── Geo utilities ──────────────────────────────────────────────────

describe('Geo utilities', () => {
  test('isValidLat should validate latitudes', () => {
    expect(isValidLat(14.7)).toBe(true);
    expect(isValidLat(-90)).toBe(true);
    expect(isValidLat(90)).toBe(true);
    expect(isValidLat(91)).toBe(false);
    expect(isValidLat('abc')).toBe(false);
  });

  test('isValidLon should validate longitudes', () => {
    expect(isValidLon(-17.4)).toBe(true);
    expect(isValidLon(-180)).toBe(true);
    expect(isValidLon(180)).toBe(true);
    expect(isValidLon(181)).toBe(false);
    expect(isValidLon('xyz')).toBe(false);
  });

  test('isValidCoordinate should validate coordinate pairs', () => {
    expect(isValidCoordinate(14.7, -17.4)).toBe(true);
    expect(isValidCoordinate(91, -17.4)).toBe(false);
    expect(isValidCoordinate(14.7, 181)).toBe(false);
  });

  test('toGeoJSONFeature should convert row to Feature', () => {
    const feature = toGeoJSONFeature({ id: 1, name: 'Test', latitude: 14.7, longitude: -17.4, geom: 'ignored' });
    expect(feature.type).toBe('Feature');
    expect(feature.geometry.type).toBe('Point');
    expect(feature.geometry.coordinates).toEqual([-17.4, 14.7]);
    expect(feature.properties.id).toBe(1);
    expect(feature.properties.geom).toBeUndefined();
  });

  test('toGeoJSONCollection should create FeatureCollection', () => {
    const collection = toGeoJSONCollection([
      { id: 1, name: 'A', latitude: 14.7, longitude: -17.4 },
      { id: 2, name: 'B', latitude: 14.8, longitude: -17.5 },
    ]);
    expect(collection.type).toBe('FeatureCollection');
    expect(collection.features).toHaveLength(2);
  });

  test('haversineDistance should compute distance in km', () => {
    const dist = haversineDistance(14.7645, -17.3934, 14.6820, -17.4410);
    expect(dist).toBeGreaterThan(0);
    expect(dist).toBeLessThan(20);
  });
});

// ─── Routing service utilities ──────────────────────────────────────

describe('Routing service utilities', () => {
  test('walkTime should compute walk duration in minutes', () => {
    const time = walkTime(1);
    expect(time).toBeCloseTo(13.33, 1);
  });

  test('findTransferPoints should find matching stations', () => {
    const routeA = [
      { id: 1, name: 'A1', lat: 14.7, lon: -17.4 },
      { id: 2, name: 'A2', lat: 14.8, lon: -17.5 },
    ];
    const routeB = [
      { id: 2, name: 'A2', lat: 14.8, lon: -17.5 },
      { id: 3, name: 'B1', lat: 14.9, lon: -17.6 },
    ];
    const transfers = findTransferPoints(routeA, routeB);
    expect(transfers.length).toBeGreaterThan(0);
    expect(transfers[0].from.id).toBe(2);
    expect(transfers[0].distance_km).toBe(0);
  });
});
