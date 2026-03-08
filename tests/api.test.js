const request = require('supertest');
const app = require('../src/server');
const db = require('../src/config/db');
const { isValidCoordinate, isValidLat, isValidLon, toGeoJSONFeature, toGeoJSONCollection, haversineDistance } = require('../src/utils/geo.utils');
const { walkTime, findTransferPoints } = require('../src/services/routing.service');

// Mock the database module
jest.mock('../src/config/db', () => ({
  query: jest.fn(),
  pool: { end: jest.fn() },
}));

// ─── Helper data ────────────────────────────────────────────────────

const mockTransportTypes = [
  { id: 1, name: 'Dakar Bus Rapid Transit', description: 'BRT system' },
  { id: 2, name: 'Dakar Regional Express Train', description: 'TER system' },
];

const mockStations = [
  { id: 1, name: 'Gare de Guédiawaye', lat: 14.7645, lon: -17.3934, transport_type_id: 1, transport_type_name: 'Dakar Bus Rapid Transit' },
  { id: 2, name: 'Parcelles Assainies', lat: 14.7630, lon: -17.4120, transport_type_id: 1, transport_type_name: 'Dakar Bus Rapid Transit' },
];

const mockRoutes = [
  { id: 1, name: 'BRT Ligne 1', transport_type_id: 1, transport_type_name: 'Dakar Bus Rapid Transit' },
];

const mockRouteStations = [
  { station_order: 1, id: 1, name: 'Gare de Guédiawaye', lat: 14.7645, lon: -17.3934, transport_type_id: 1, transport_type_name: 'BRT' },
  { station_order: 2, id: 2, name: 'Parcelles Assainies', lat: 14.7630, lon: -17.4120, transport_type_id: 1, transport_type_name: 'BRT' },
];

const mockTravelTime = { id: 1, route_id: 1, from_station_id: 1, to_station_id: 2, minutes: 8 };

// ─── Tests ──────────────────────────────────────────────────────────

beforeEach(() => {
  db.query.mockReset();
});

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
  test('should return all transport types', async () => {
    db.query.mockResolvedValueOnce({ rows: mockTransportTypes });
    const res = await request(app).get('/api/transport-types');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(2);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].name).toBe('Dakar Bus Rapid Transit');
  });

  test('should return empty array when no transport types', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/transport-types');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
    expect(res.body.data).toHaveLength(0);
  });

  test('should return 500 on database error', async () => {
    db.query.mockRejectedValueOnce(new Error('DB connection failed'));
    const res = await request(app).get('/api/transport-types');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ─── Stations ───────────────────────────────────────────────────────

describe('GET /api/stations', () => {
  test('should return all stations', async () => {
    db.query.mockResolvedValueOnce({ rows: mockStations });
    const res = await request(app).get('/api/stations');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
  });

  test('should filter stations by transport_type_id', async () => {
    db.query.mockResolvedValueOnce({ rows: [mockStations[0]] });
    const res = await request(app).get('/api/stations?transport_type_id=1');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  test('should support pagination parameters', async () => {
    db.query.mockResolvedValueOnce({ rows: [mockStations[1]] });
    const res = await request(app).get('/api/stations?limit=1&offset=1');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  test('should return 500 on database error', async () => {
    db.query.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).get('/api/stations');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

describe('GET /api/stations/:id', () => {
  test('should return a single station', async () => {
    db.query.mockResolvedValueOnce({ rows: [mockStations[0]] });
    const res = await request(app).get('/api/stations/1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Gare de Guédiawaye');
  });

  test('should return 404 for non-existent station', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/stations/999');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Station not found');
  });
});

// ─── GeoJSON stations ───────────────────────────────────────────────

describe('GET /api/map/stations', () => {
  test('should return GeoJSON FeatureCollection', async () => {
    db.query.mockResolvedValueOnce({ rows: mockStations });
    const res = await request(app).get('/api/map/stations');
    expect(res.status).toBe(200);
    expect(res.body.type).toBe('FeatureCollection');
    expect(res.body.features).toHaveLength(2);
    expect(res.body.features[0].type).toBe('Feature');
    expect(res.body.features[0].geometry.type).toBe('Point');
    expect(res.body.features[0].geometry.coordinates).toEqual([-17.3934, 14.7645]);
  });

  test('should filter GeoJSON by transport_type_id', async () => {
    db.query.mockResolvedValueOnce({ rows: [mockStations[0]] });
    const res = await request(app).get('/api/map/stations?transport_type_id=1');
    expect(res.status).toBe(200);
    expect(res.body.features).toHaveLength(1);
  });
});

// ─── Routes ─────────────────────────────────────────────────────────

describe('GET /api/routes', () => {
  test('should return all routes', async () => {
    db.query.mockResolvedValueOnce({ rows: mockRoutes });
    const res = await request(app).get('/api/routes');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('BRT Ligne 1');
  });
});

describe('GET /api/routes/:id', () => {
  test('should return a single route', async () => {
    db.query.mockResolvedValueOnce({ rows: [mockRoutes[0]] });
    const res = await request(app).get('/api/routes/1');
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('BRT Ligne 1');
  });

  test('should return 404 for non-existent route', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/routes/999');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Route not found');
  });
});

describe('GET /api/routes/:id/stations', () => {
  test('should return stations for a route in order', async () => {
    db.query.mockResolvedValueOnce({ rows: [mockRoutes[0]] });
    db.query.mockResolvedValueOnce({ rows: mockRouteStations });
    const res = await request(app).get('/api/routes/1/stations');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.route.name).toBe('BRT Ligne 1');
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].station_order).toBe(1);
  });

  test('should return 404 for non-existent route', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/routes/999/stations');
    expect(res.status).toBe(404);
  });
});

// ─── Travel time ────────────────────────────────────────────────────

describe('GET /api/travel-time', () => {
  test('should return travel time between two stations', async () => {
    db.query.mockResolvedValueOnce({ rows: [mockTravelTime] });
    const res = await request(app).get('/api/travel-time?from=1&to=2&route=1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.minutes).toBe(8);
  });

  test('should return 400 when missing parameters', async () => {
    const res = await request(app).get('/api/travel-time?from=1');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Missing required parameters');
  });

  test('should return 404 when travel time not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/travel-time?from=1&to=99&route=1');
    expect(res.status).toBe(404);
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

  test('should return 404 when no nearby origin stations', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/itinerary?origin_lat=14.7645&origin_lon=-17.3934&destination_lat=14.6820&destination_lon=-17.4410');
    expect(res.status).toBe(404);
    expect(res.body.error).toContain('No stations found near origin');
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
    const feature = toGeoJSONFeature({ id: 1, name: 'Test', lat: 14.7, lon: -17.4, geom: 'ignored' });
    expect(feature.type).toBe('Feature');
    expect(feature.geometry.type).toBe('Point');
    expect(feature.geometry.coordinates).toEqual([-17.4, 14.7]);
    expect(feature.properties.id).toBe(1);
    expect(feature.properties.geom).toBeUndefined();
  });

  test('toGeoJSONCollection should create FeatureCollection', () => {
    const collection = toGeoJSONCollection([
      { id: 1, name: 'A', lat: 14.7, lon: -17.4 },
      { id: 2, name: 'B', lat: 14.8, lon: -17.5 },
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
