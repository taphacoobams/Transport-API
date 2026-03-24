const db = require('../config/database');
const { haversine } = require('../utils/haversine');
const { findNearestStations } = require('./stationService');
const { calculateItineraryPricing } = require('./pricingService');
const { getNetworkStyle } = require('../config/networkStyles');

const WALK_SPEED_M_PER_MIN = 83; // 5 km/h ≈ 83 m/min
const WALK_COLOR = '#888888';
const WALK_DASH = [6, 8];

// ---------------------------------------------------------------------------
// Cost penalties (in minutes)
// ---------------------------------------------------------------------------
const TRANSFER_PENALTY = 5;
const WALK_PENALTY = 2;
const WALK_PENALTY_THRESHOLD_MIN = 5;

// ---------------------------------------------------------------------------
// Mode colors
// ---------------------------------------------------------------------------
const MODE_COLORS = {
  BRT: '#008F4C',
  TER: '#6B4F2A',
  DDD: '#005F73',
  AFTU: '#E07A5F',
  walk: '#888888',
};

function getModeColor(mode) {
  return MODE_COLORS[(mode || '').toUpperCase()] || MODE_COLORS.walk;
}

// ---------------------------------------------------------------------------
// Peak hours definition (Dakar typical)
// ---------------------------------------------------------------------------
const PEAK_HOURS = [
  { start: 7, end: 10 },  // morning rush
  { start: 17, end: 20 }, // evening rush
];

function isPeakHour(hour) {
  return PEAK_HOURS.some(p => hour >= p.start && hour < p.end);
}

// Graph cache with TTL
const GRAPH_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
let graphCache = null;
let graphCacheTimestamp = 0;

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
  // adjacency list: stationId -> [ { to, cost, raw_time, route_id, mode, transport_network, distance_meters } ]
  const adj = {};

  const addNode = (id) => { if (!adj[id]) adj[id] = []; };

  // Load operating_hours to compute waiting times per route (peak + offpeak)
  const waitingTimeByRoute = {};
  try {
    const { rows: opHours } = await db.query(
      `SELECT route_id, day_type, peak_frequency_minutes, offpeak_frequency_minutes
       FROM operating_hours`
    );
    for (const oh of opHours) {
      const peakFreq = parseFloat(oh.peak_frequency_minutes) || 0;
      const offpeakFreq = parseFloat(oh.offpeak_frequency_minutes) || 0;
      const peakWait = peakFreq > 0 ? peakFreq / 2 : 0;
      const offpeakWait = offpeakFreq > 0 ? offpeakFreq / 2 : 0;
      // Fallback: average of both if one is missing
      const avgWait = peakFreq > 0 && offpeakFreq > 0
        ? (peakFreq + offpeakFreq) / 4
        : (peakWait || offpeakWait);

      const entry = { peak: peakWait, offpeak: offpeakWait, avg: avgWait };
      // Keep the minimum waiting time across day_types for the route
      if (!waitingTimeByRoute[oh.route_id] || avgWait < waitingTimeByRoute[oh.route_id].avg) {
        waitingTimeByRoute[oh.route_id] = entry;
      }
    }
  } catch (err) {
    console.warn('Could not load operating_hours for waiting times:', err.message);
  }

  // Transport edges
  const { rows: tEdges } = await db.query(
    `SELECT te.from_station_id, te.to_station_id, te.route_id, te.travel_time_minutes,
            n.network_code AS transport_network, r.route_name
     FROM transport_edges te
     JOIN routes r ON r.id = te.route_id
     JOIN networks n ON n.id = r.network_id`
  );

  // Track which route_ids we've already added waiting time for (per source node path)
  // Waiting time is added only to the FIRST edge of each ride segment per route boarding
  // We approximate by adding it to every transport edge and dividing by typical segment length
  // Better approach: add waiting time once per route boarding in the itinerary builder
  // For Dijkstra cost: we add a fraction — the waiting time is amortized across edges of same route
  // Simplest correct approach: add full waiting time to each transport edge;
  // the itinerary builder will group consecutive same-route edges, so effective wait = 1x per boarding
  for (const e of tEdges) {
    addNode(e.from_station_id);
    addNode(e.to_station_id);
    const rawTime = e.travel_time_minutes > 0 ? parseFloat(e.travel_time_minutes) : 2;
    const waitEntry = waitingTimeByRoute[e.route_id] || { peak: 0, offpeak: 0, avg: 0 };
    adj[e.from_station_id].push({
      to: e.to_station_id,
      cost: rawTime,
      raw_time: rawTime,
      waiting_time: waitEntry,
      route_id: e.route_id,
      route_name: e.route_name,
      mode: e.transport_network,
      type: 'transport',
    });
  }

  // Transfer edges (walking between networks)
  const { rows: xEdges } = await db.query(
    'SELECT from_station_id, to_station_id, distance_meters, walking_time_minutes FROM transfer_edges'
  );
  for (const e of xEdges) {
    addNode(e.from_station_id);
    addNode(e.to_station_id);
    const walkTimeMin = parseFloat(e.walking_time_minutes);
    // Transfer penalty + extra walk penalty if walk > threshold
    const walkPenalty = walkTimeMin > WALK_PENALTY_THRESHOLD_MIN ? WALK_PENALTY : 0;
    adj[e.from_station_id].push({
      to: e.to_station_id,
      cost: walkTimeMin + TRANSFER_PENALTY + walkPenalty,
      raw_time: walkTimeMin,
      distance_meters: parseFloat(e.distance_meters),
      mode: 'walk',
      type: 'transfer',
    });
  }

  return { adj, waitingTimeByRoute };
}

// ---------------------------------------------------------------------------
// Dijkstra shortest path — weighted cost includes waiting + penalties
// ---------------------------------------------------------------------------
function dijkstra(adj, source, target, opts = {}) {
  const dist = {};
  const prev = {};  // prev[node] = { from, edge, lastRouteId }
  const visited = new Set();
  const heap = new MinHeap();

  dist[source] = 0;
  heap.push({ node: source, cost: 0, lastRouteId: null });

  while (heap.size > 0) {
    const { node, cost, lastRouteId } = heap.pop();
    if (visited.has(node)) continue;
    visited.add(node);

    if (node === target) break;

    if (!adj[node]) continue;
    for (const edge of adj[node]) {
      if (visited.has(edge.to)) continue;

      let edgeCost = edge.cost;

      // Add waiting time only when boarding a new route (not continuing same route)
      if (edge.type === 'transport' && edge.route_id !== lastRouteId) {
        const wt = edge.waiting_time || { peak: 0, offpeak: 0, avg: 0 };
        if (opts.peak === true) {
          edgeCost += wt.peak;
        } else if (opts.peak === false) {
          edgeCost += wt.offpeak;
        } else {
          edgeCost += wt.avg;
        }
      }

      const newCost = cost + edgeCost;
      if (dist[edge.to] === undefined || newCost < dist[edge.to]) {
        dist[edge.to] = newCost;
        prev[edge.to] = { from: node, edge, lastRouteId: edge.route_id || null };
        heap.push({ node: edge.to, cost: newCost, lastRouteId: edge.route_id || lastRouteId });
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
async function buildItinerary(path, originCoords, destCoords, originLabel, destLabel, waitingTimeByRoute) {
  // Load station names
  const stationIds = new Set();
  for (const seg of path) {
    stationIds.add(seg.from);
    stationIds.add(seg.to);
  }
  const ids = Array.from(stationIds);
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
  const { rows: stationRows } = await db.query(
    `SELECT s.id, s.station_code, s.station_name, s.latitude, s.longitude,
            n.network_code AS transport_network
     FROM stations s
     JOIN networks n ON n.id = s.network_id
     WHERE s.id IN (${placeholders})`,
    ids
  );
  const stationMap = {};
  for (const s of stationRows) stationMap[s.id] = s;

  const steps = [];
  let transferCount = 0;
  let totalWalkingMeters = 0;

  // Group consecutive edges with the same route_id into ride segments
  let i = 0;
  while (i < path.length) {
    const seg = path[i];

    if (seg.type === 'transfer') {
      // Walking transfer
      const fSt = stationMap[seg.from];
      const tSt = stationMap[seg.to];
      const distMeters = Math.round((seg.distance_meters || 0) * 100) / 100;
      totalWalkingMeters += distMeters;
      transferCount++;
      steps.push({
        mode: 'walk',
        color: getModeColor('walk'),
        from: fSt?.station_name || seg.from,
        from_station_id: seg.from,
        to: tSt?.station_name || seg.to,
        to_station_id: seg.to,
        duration: Math.round((seg.raw_time || seg.cost) * 100) / 100,
        distance: distMeters,
        geometry: {
          type: 'LineString',
          coordinates: [
            fSt ? [parseFloat(fSt.longitude), parseFloat(fSt.latitude)] : null,
            tSt ? [parseFloat(tSt.longitude), parseFloat(tSt.latitude)] : null,
          ].filter(Boolean),
        },
      });
      i++;
    } else {
      // Ride segment — group consecutive edges on the same route
      const routeId = seg.route_id;
      const mode = seg.mode;
      const routeName = seg.route_name;
      const rideFrom = seg.from;
      let rideTo = seg.to;
      let rideDuration = seg.raw_time || seg.cost;

      // Collect coordinates for every intermediate station
      const rideCoords = [];
      const fromSt = stationMap[rideFrom];
      if (fromSt) rideCoords.push([parseFloat(fromSt.longitude), parseFloat(fromSt.latitude)]);
      const toSt0 = stationMap[seg.to];
      if (toSt0) rideCoords.push([parseFloat(toSt0.longitude), parseFloat(toSt0.latitude)]);

      while (i + 1 < path.length && path[i + 1].route_id === routeId && path[i + 1].type === 'transport') {
        i++;
        rideTo = path[i].to;
        rideDuration += path[i].raw_time || path[i].cost;
        const midSt = stationMap[path[i].to];
        if (midSt) rideCoords.push([parseFloat(midSt.longitude), parseFloat(midSt.latitude)]);
      }

      // Calculate distance for this ride segment
      let rideDistanceMeters = 0;
      for (let k = 1; k < rideCoords.length; k++) {
        rideDistanceMeters += haversine(
          rideCoords[k - 1][1], rideCoords[k - 1][0],
          rideCoords[k][1], rideCoords[k][0]
        );
      }

      // Add waiting time for this boarding
      const wtEntry = (waitingTimeByRoute && waitingTimeByRoute[routeId]) || { avg: 0 };
      const waitTime = typeof wtEntry === 'number' ? wtEntry : (wtEntry.avg || 0);

      steps.push({
        mode,
        route: routeName || routeId,
        route_id: routeId,
        color: getModeColor(mode),
        from: stationMap[rideFrom]?.station_name || rideFrom,
        from_station_id: rideFrom,
        to: stationMap[rideTo]?.station_name || rideTo,
        to_station_id: rideTo,
        duration: Math.round(rideDuration * 100) / 100,
        waiting_time: Math.round(waitTime * 100) / 100,
        distance: Math.round(rideDistanceMeters),
        geometry: {
          type: 'LineString',
          coordinates: rideCoords,
        },
      });
      i++;
    }
  }

  // Add initial walk from origin to first station
  const firstStation = stationMap[path[0].from];
  if (firstStation) {
    const walkDist = haversine(originCoords.latitude, originCoords.longitude, firstStation.latitude, firstStation.longitude);
    const walkTimeMin = walkDist / WALK_SPEED_M_PER_MIN;
    totalWalkingMeters += Math.round(walkDist);
    steps.unshift({
      mode: 'walk',
      color: getModeColor('walk'),
      from: originLabel,
      to: firstStation.station_name,
      to_station_id: firstStation.id,
      duration: Math.round(walkTimeMin * 100) / 100,
      distance: Math.round(walkDist),
      geometry: {
        type: 'LineString',
        coordinates: [
          [parseFloat(originCoords.longitude), parseFloat(originCoords.latitude)],
          [parseFloat(firstStation.longitude), parseFloat(firstStation.latitude)],
        ],
      },
    });
  }

  // Add final walk from last station to destination
  const lastStation = stationMap[path[path.length - 1].to];
  if (lastStation) {
    const walkDist = haversine(lastStation.latitude, lastStation.longitude, destCoords.latitude, destCoords.longitude);
    const walkTimeMin = walkDist / WALK_SPEED_M_PER_MIN;
    totalWalkingMeters += Math.round(walkDist);
    steps.push({
      mode: 'walk',
      color: getModeColor('walk'),
      from: lastStation.station_name,
      from_station_id: lastStation.id,
      to: destLabel,
      duration: Math.round(walkTimeMin * 100) / 100,
      distance: Math.round(walkDist),
      geometry: {
        type: 'LineString',
        coordinates: [
          [parseFloat(lastStation.longitude), parseFloat(lastStation.latitude)],
          [parseFloat(destCoords.longitude), parseFloat(destCoords.latitude)],
        ],
      },
    });
  }

  // Total duration (real time, including waiting)
  const total_duration = Math.round(
    steps.reduce((sum, s) => sum + s.duration + (s.waiting_time || 0), 0) * 100
  ) / 100;

  // Build combined LineString geometry (concatenated coordinates)
  const allCoords = [];
  for (const s of steps) {
    if (s.geometry && s.geometry.coordinates && s.geometry.coordinates.length >= 2) {
      for (const coord of s.geometry.coordinates) {
        // Avoid duplicate consecutive coordinates
        const last = allCoords[allCoords.length - 1];
        if (!last || last[0] !== coord[0] || last[1] !== coord[1]) {
          allCoords.push(coord);
        }
      }
    }
  }

  // Build FeatureCollection for detailed display
  const features = steps
    .filter(s => s.geometry && s.geometry.coordinates && s.geometry.coordinates.length >= 2)
    .map(s => ({
      type: 'Feature',
      geometry: s.geometry,
      properties: {
        mode: s.mode,
        route: s.route || null,
        route_id: s.route_id || null,
        color: s.color || WALK_COLOR,
        dashArray: s.mode === 'walk' ? WALK_DASH : null,
      },
    }));

  // Comfort score (0-10): penalize transfers, long walks, many modes
  const comfortScore = Math.max(0, Math.min(10, Math.round(
    10 - transferCount * 1.5 - (totalWalkingMeters > 500 ? 2 : totalWalkingMeters > 200 ? 1 : 0)
  )));

  // Efficiency score (0-10): based on total duration relative to a reasonable threshold
  const efficiencyScore = Math.max(0, Math.min(10, Math.round(
    10 - Math.max(0, total_duration - 15) * 0.15
  )));

  return {
    origin: originLabel,
    destination: destLabel,
    total_duration,
    transfers: transferCount,
    walking_distance: Math.round(totalWalkingMeters),
    score: {
      comfort: comfortScore,
      efficiency: efficiencyScore,
    },
    geometry: {
      type: 'LineString',
      coordinates: allCoords.length >= 2 ? allCoords : [],
    },
    geometry_detailed: { type: 'FeatureCollection', features },
    steps,
  };
}

// ---------------------------------------------------------------------------
// Main routing function
// ---------------------------------------------------------------------------

async function getGraph() {
  const now = Date.now();
  if (!graphCache || (now - graphCacheTimestamp) > GRAPH_CACHE_TTL_MS) {
    graphCache = await buildGraph();
    graphCacheTimestamp = now;
  }
  return graphCache;
}

/**
 * Compute a single best multimodal route between origin and destination.
 * Backwards-compatible with existing /api/route endpoint.
 * @param {object} origin  - { latitude, longitude, station_id?, label }
 * @param {object} dest    - { latitude, longitude, station_id?, label }
 * @returns {Promise<object>} itinerary or error
 */
async function computeRoute(origin, dest, options = {}) {
  const results = await computeRoutes(origin, dest, 1, options);
  if (results.error) return results;
  // Return the first (best) route in flat format for backward compatibility
  return results.routes[0];
}

/**
 * Compute up to `maxRoutes` best multimodal routes.
 * Returns routes ranked by a composite score: duration, transfers, walking.
 *
 * @param {object} origin  - { latitude, longitude, station_id?, label }
 * @param {object} dest    - { latitude, longitude, station_id?, label }
 * @param {number} maxRoutes - Maximum number of routes to return (default 3)
 * @returns {Promise<object>} { origin, destination, routes: [...] } or { error }
 */
async function computeRoutes(origin, dest, maxRoutes = 3, options = {}) {
  const { adj, waitingTimeByRoute } = await getGraph();

  // Determine peak/offpeak from departure_time option
  let dijkstraOpts = {};
  if (options.departure_time) {
    const hour = new Date(options.departure_time).getHours();
    dijkstraOpts.peak = isPeakHour(hour);
  }

  // Find nearest stations to origin and destination
  const originCandidates = origin.station_id
    ? [{ station_id: origin.station_id, distance_meters: 0 }]
    : await findNearestStations(origin.latitude, origin.longitude, 5);

  const destCandidates = dest.station_id
    ? [{ station_id: dest.station_id, distance_meters: 0 }]
    : await findNearestStations(dest.latitude, dest.longitude, 5);

  if (originCandidates.length === 0) {
    return { error: 'No stations found near origin.' };
  }
  if (destCandidates.length === 0) {
    return { error: 'No stations found near destination.' };
  }

  // Collect all Dijkstra results from candidate pairs
  const allResults = [];

  for (const oCandidate of originCandidates) {
    for (const dCandidate of destCandidates) {
      if (oCandidate.station_id === dCandidate.station_id) continue;
      // Origin must have outgoing edges; destination only needs to be reachable
      if (!adj[oCandidate.station_id]) continue;

      const result = dijkstra(adj, oCandidate.station_id, dCandidate.station_id, dijkstraOpts);
      if (result) {
        const walkToCost = (oCandidate.distance_meters || 0) / WALK_SPEED_M_PER_MIN;
        const walkFromCost = (dCandidate.distance_meters || 0) / WALK_SPEED_M_PER_MIN;
        const totalCost = walkToCost + result.total_cost + walkFromCost;

        // Derive a path signature to deduplicate identical routes
        const pathSig = result.path.map(e => `${e.from}-${e.to}`).join('|');

        allResults.push({
          totalCost,
          pathSig,
          result,
          oCandidate,
          dCandidate,
        });
      }
    }
  }

  if (allResults.length === 0) {
    return { error: 'No route found between the given locations.' };
  }

  // Sort by total cost and deduplicate by path signature
  allResults.sort((a, b) => a.totalCost - b.totalCost);
  const seen = new Set();
  const uniqueResults = [];
  for (const r of allResults) {
    if (!seen.has(r.pathSig)) {
      seen.add(r.pathSig);
      uniqueResults.push(r);
      if (uniqueResults.length >= maxRoutes) break;
    }
  }

  // Build full itineraries for the top results
  const routes = [];
  for (const r of uniqueResults) {
    const itinerary = await buildItinerary(
      r.result.path,
      origin,
      dest,
      origin.label,
      dest.label,
      waitingTimeByRoute
    );
    const pricedItinerary = calculateItineraryPricing(itinerary);
    routes.push(pricedItinerary);
  }

  return {
    origin: { lat: origin.latitude, lon: origin.longitude, label: origin.label },
    destination: { lat: dest.latitude, lon: dest.longitude, label: dest.label },
    routes,
  };
}

/**
 * Invalidate the graph cache (call after re-import).
 */
function invalidateCache() {
  graphCache = null;
  graphCacheTimestamp = 0;
}

module.exports = { computeRoute, computeRoutes, buildGraph, dijkstra, invalidateCache, getModeColor };
