const db = require('../config/database');
const { haversine } = require('../utils/haversine');
const { findNearestStations } = require('./stationService');
const { calculateItineraryPricing } = require('./pricingService');

const WALK_SPEED_M_PER_MIN = 83; // 5 km/h ≈ 83 m/min

// ---------------------------------------------------------------------------
// Min-Heap priority queue for Dijkstra
// ---------------------------------------------------------------------------
class MinHeap {
  constructor() { this.data = []; }
  push(item) {
    this.data.push(item);
    this._bubbleUp(this.data.length - 1);
  }
  pop() {
    if (this.data.length === 0) return null;
    const top = this.data[0];
    const last = this.data.pop();
    if (this.data.length > 0) { this.data[0] = last; this._sinkDown(0); }
    return top;
  }
  get size() { return this.data.length; }
  _bubbleUp(i) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.data[i].cost < this.data[parent].cost) {
        [this.data[i], this.data[parent]] = [this.data[parent], this.data[i]];
        i = parent;
      } else break;
    }
  }
  _sinkDown(i) {
    const n = this.data.length;
    while (true) {
      let smallest = i;
      const l = 2 * i + 1, r = 2 * i + 2;
      if (l < n && this.data[l].cost < this.data[smallest].cost) smallest = l;
      if (r < n && this.data[r].cost < this.data[smallest].cost) smallest = r;
      if (smallest !== i) {
        [this.data[i], this.data[smallest]] = [this.data[smallest], this.data[i]];
        i = smallest;
      } else break;
    }
  }
}

// ---------------------------------------------------------------------------
// Build the routing graph from database edges
// ---------------------------------------------------------------------------
async function buildGraph() {
  // adjacency list: stationId -> [ { to, cost, route_id, mode, transport_network, distance_meters } ]
  const adj = {};

  const addNode = (id) => { if (!adj[id]) adj[id] = []; };

  // Transport edges
  const { rows: tEdges } = await db.query(
    `SELECT te.from_station, te.to_station, te.route_id, te.travel_time_minutes,
            r.transport_network, r.route_name
     FROM transport_edges te
     JOIN routes r ON r.route_id = te.route_id`
  );
  for (const e of tEdges) {
    addNode(e.from_station);
    addNode(e.to_station);
    const cost = e.travel_time_minutes > 0 ? parseFloat(e.travel_time_minutes) : 2; // default 2 min if unknown
    adj[e.from_station].push({
      to: e.to_station,
      cost,
      route_id: e.route_id,
      route_name: e.route_name,
      mode: e.transport_network,
      type: 'transport',
    });
  }

  // Transfer edges (walking between networks)
  const { rows: xEdges } = await db.query(
    'SELECT from_station, to_station, distance_meters, walking_time_minutes FROM transfer_edges'
  );
  for (const e of xEdges) {
    addNode(e.from_station);
    addNode(e.to_station);
    adj[e.from_station].push({
      to: e.to_station,
      cost: parseFloat(e.walking_time_minutes),
      distance_meters: parseFloat(e.distance_meters),
      mode: 'walk',
      type: 'transfer',
    });
  }

  return adj;
}

// ---------------------------------------------------------------------------
// Dijkstra shortest path
// ---------------------------------------------------------------------------
function dijkstra(adj, source, target) {
  const dist = {};
  const prev = {};  // prev[node] = { from, edge }
  const visited = new Set();
  const heap = new MinHeap();

  dist[source] = 0;
  heap.push({ node: source, cost: 0 });

  while (heap.size > 0) {
    const { node, cost } = heap.pop();
    if (visited.has(node)) continue;
    visited.add(node);

    if (node === target) break;

    if (!adj[node]) continue;
    for (const edge of adj[node]) {
      if (visited.has(edge.to)) continue;
      const newCost = cost + edge.cost;
      if (dist[edge.to] === undefined || newCost < dist[edge.to]) {
        dist[edge.to] = newCost;
        prev[edge.to] = { from: node, edge };
        heap.push({ node: edge.to, cost: newCost });
      }
    }
  }

  if (dist[target] === undefined) return null;

  // Reconstruct path
  const path = [];
  let cur = target;
  while (prev[cur]) {
    path.unshift({ from: prev[cur].from, to: cur, ...prev[cur].edge });
    cur = prev[cur].from;
  }

  return { total_cost: dist[target], path };
}

// ---------------------------------------------------------------------------
// Build itinerary steps from Dijkstra path
// ---------------------------------------------------------------------------
async function buildItinerary(path, originCoords, destCoords, originLabel, destLabel) {
  // Load station names
  const stationIds = new Set();
  for (const seg of path) {
    stationIds.add(seg.from);
    stationIds.add(seg.to);
  }
  const ids = Array.from(stationIds);
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
  const { rows: stationRows } = await db.query(
    `SELECT station_id, station_name, transport_network, latitude, longitude FROM stations WHERE station_id IN (${placeholders})`,
    ids
  );
  const stationMap = {};
  for (const s of stationRows) stationMap[s.station_id] = s;

  const steps = [];

  // Group consecutive edges with the same route_id into ride segments
  let i = 0;
  while (i < path.length) {
    const seg = path[i];

    if (seg.type === 'transfer') {
      // Walking transfer
      steps.push({
        mode: 'walk',
        from: stationMap[seg.from]?.station_name || seg.from,
        from_station_id: seg.from,
        to: stationMap[seg.to]?.station_name || seg.to,
        to_station_id: seg.to,
        duration_minutes: Math.round(seg.cost * 100) / 100,
        distance_meters: Math.round((seg.distance_meters || 0) * 100) / 100,
      });
      i++;
    } else {
      // Ride segment — group consecutive edges on the same route
      const routeId = seg.route_id;
      const mode = seg.mode;
      const routeName = seg.route_name;
      const rideFrom = seg.from;
      let rideTo = seg.to;
      let rideDuration = seg.cost;

      while (i + 1 < path.length && path[i + 1].route_id === routeId && path[i + 1].type === 'transport') {
        i++;
        rideTo = path[i].to;
        rideDuration += path[i].cost;
      }

      // Calculate distance for this ride segment
      const fromStation = stationMap[rideFrom];
      const toStation = stationMap[rideTo];
      let rideDistanceMeters = 0;
      if (fromStation && toStation) {
        rideDistanceMeters = haversine(
          fromStation.latitude, fromStation.longitude,
          toStation.latitude, toStation.longitude
        );
      }

      steps.push({
        mode,
        route: routeName || routeId,
        route_id: routeId,
        from: stationMap[rideFrom]?.station_name || rideFrom,
        from_station_id: rideFrom,
        to: stationMap[rideTo]?.station_name || rideTo,
        to_station_id: rideTo,
        duration_minutes: Math.round(rideDuration * 100) / 100,
        distance_meters: Math.round(rideDistanceMeters),
      });
      i++;
    }
  }

  // Add initial walk from origin to first station
  const firstStation = stationMap[path[0].from];
  if (firstStation) {
    const walkDist = haversine(originCoords.latitude, originCoords.longitude, firstStation.latitude, firstStation.longitude);
    const walkTime = walkDist / WALK_SPEED_M_PER_MIN;
    steps.unshift({
      mode: 'walk',
      from: originLabel,
      to: firstStation.station_name,
      to_station_id: firstStation.station_id,
      duration_minutes: Math.round(walkTime * 100) / 100,
      distance_meters: Math.round(walkDist),
    });
  }

  // Add final walk from last station to destination
  const lastStation = stationMap[path[path.length - 1].to];
  if (lastStation) {
    const walkDist = haversine(lastStation.latitude, lastStation.longitude, destCoords.latitude, destCoords.longitude);
    const walkTime = walkDist / WALK_SPEED_M_PER_MIN;
    steps.push({
      mode: 'walk',
      from: lastStation.station_name,
      from_station_id: lastStation.station_id,
      to: destLabel,
      duration_minutes: Math.round(walkTime * 100) / 100,
      distance_meters: Math.round(walkDist),
    });
  }

  // Total duration
  const total_duration_minutes = Math.round(steps.reduce((sum, s) => sum + s.duration_minutes, 0) * 100) / 100;

  return {
    origin: originLabel,
    destination: destLabel,
    total_duration_minutes,
    steps,
  };
}

// ---------------------------------------------------------------------------
// Main routing function
// ---------------------------------------------------------------------------

// Cache the graph in memory (rebuilt on first call)
let graphCache = null;

async function getGraph() {
  if (!graphCache) {
    graphCache = await buildGraph();
  }
  return graphCache;
}

/**
 * Compute a multimodal route between origin and destination coordinates.
 * @param {object} origin  - { latitude, longitude, station_id?, label }
 * @param {object} dest    - { latitude, longitude, station_id?, label }
 * @returns {Promise<object>} itinerary or error
 */
async function computeRoute(origin, dest) {
  const adj = await getGraph();

  // Find nearest stations to origin and destination
  let originStationId = origin.station_id || null;
  let destStationId = dest.station_id || null;

  if (!originStationId) {
    const nearest = await findNearestStations(origin.latitude, origin.longitude, 3);
    if (nearest.length === 0) return { error: 'No stations found near origin.' };
    originStationId = nearest[0].station_id;
  }

  if (!destStationId) {
    const nearest = await findNearestStations(dest.latitude, dest.longitude, 3);
    if (nearest.length === 0) return { error: 'No stations found near destination.' };
    destStationId = nearest[0].station_id;
  }

  if (originStationId === destStationId) {
    return { error: 'Origin and destination resolve to the same station.' };
  }

  // Try Dijkstra from multiple nearby origin stations to multiple nearby dest stations
  const originCandidates = origin.station_id
    ? [{ station_id: origin.station_id, distance_meters: 0 }]
    : await findNearestStations(origin.latitude, origin.longitude, 5);

  const destCandidates = dest.station_id
    ? [{ station_id: dest.station_id, distance_meters: 0 }]
    : await findNearestStations(dest.latitude, dest.longitude, 5);

  let bestResult = null;
  let bestTotalCost = Infinity;

  for (const oCandidate of originCandidates) {
    for (const dCandidate of destCandidates) {
      if (oCandidate.station_id === dCandidate.station_id) continue;
      if (!adj[oCandidate.station_id] || !adj[dCandidate.station_id]) continue;

      const result = dijkstra(adj, oCandidate.station_id, dCandidate.station_id);
      if (result) {
        // Include walking cost to/from station
        const walkToCost = (oCandidate.distance_meters || 0) / WALK_SPEED_M_PER_MIN;
        const walkFromCost = (dCandidate.distance_meters || 0) / WALK_SPEED_M_PER_MIN;
        const totalCost = walkToCost + result.total_cost + walkFromCost;

        if (totalCost < bestTotalCost) {
          bestTotalCost = totalCost;
          bestResult = result;
        }
      }
    }
  }

  if (!bestResult) {
    return { error: 'No route found between the given locations.' };
  }

  const itinerary = await buildItinerary(
    bestResult.path,
    origin,
    dest,
    origin.label,
    dest.label
  );

  // Apply pricing to the itinerary
  const pricedItinerary = calculateItineraryPricing(itinerary);

  return pricedItinerary;
}

/**
 * Invalidate the graph cache (call after re-import).
 */
function invalidateCache() {
  graphCache = null;
}

module.exports = { computeRoute, buildGraph, dijkstra, invalidateCache };
