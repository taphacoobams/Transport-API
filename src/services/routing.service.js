const dbService = require('./database.service');
const { haversineDistance } = require('../utils/geo.utils');
const { getNetworkStyle } = require('../config/networkStyles');

const WALK_COLOR = '#888888';
const WALK_DASH = [6, 8];

/**
 * Routing service — finds itineraries across Dakar's transport network.
 *
 * Strategy:
 * 1. Find nearest stations to origin and destination using PostGIS.
 * 2. For each origin–destination station pair, check if a direct route exists.
 * 3. If no direct route, attempt a single-transfer itinerary.
 * 4. Score candidates by total estimated travel time and return the best.
 */

const WALK_SPEED_KMH = 4.5;
const MAX_WALK_KM = 2;
const MAX_NEAREST = 5;
const MAX_TRANSFER_WALK_KM = 1;

/**
 * Compute an itinerary from origin to destination coordinates.
 */
async function computeItinerary(originLat, originLon, destLat, destLon) {
  const originStations = await dbService.findNearestStations(originLat, originLon, MAX_NEAREST, MAX_WALK_KM);
  if (originStations.length === 0) {
    return { error: 'No stations found near origin. Try a location within Dakar.' };
  }

  const destStations = await dbService.findNearestStations(destLat, destLon, MAX_NEAREST, MAX_WALK_KM);
  if (destStations.length === 0) {
    return { error: 'No stations found near destination. Try a location within Dakar.' };
  }

  const candidates = [];

  // Try direct routes
  for (const oStation of originStations) {
    const oRoutes = await dbService.getRoutesByStation(oStation.id);
    for (const dStation of destStations) {
      const dRoutes = await dbService.getRoutesByStation(dStation.id);

      // Find common routes
      const commonRoutes = oRoutes.filter(or => dRoutes.some(dr => dr.id === or.id));

      for (const route of commonRoutes) {
        const tr = await computeRouteTravelTime(route.id, oStation.id, dStation.id);
        if (tr !== null) {
          const walkToOrigin = walkTime(oStation.distance_km);
          const walkFromDest = walkTime(dStation.distance_km);
          const rideStyle = getNetworkStyle(route.network_name);

          const steps = [
            { action: 'walk', from: 'origin', to: oStation.station_name, station_id: oStation.id, duration_minutes: Math.round(walkToOrigin * 100) / 100, distance_km: Math.round(oStation.distance_km * 1000) / 1000, geometry: { type: 'LineString', coordinates: [[parseFloat(originLon), parseFloat(originLat)], [parseFloat(oStation.longitude), parseFloat(oStation.latitude)]] } },
            { action: 'ride', transport: route.network_name, route: route.route_name, route_id: route.id, from: oStation.station_name, from_station_id: oStation.id, to: dStation.station_name, to_station_id: dStation.id, duration_minutes: tr.minutes, geometry: { type: 'LineString', coordinates: tr.coordinates }, color: rideStyle.color },
            { action: 'walk', from: dStation.station_name, to: 'destination', station_id: dStation.id, duration_minutes: Math.round(walkFromDest * 100) / 100, distance_km: Math.round(dStation.distance_km * 1000) / 1000, geometry: { type: 'LineString', coordinates: [[parseFloat(dStation.longitude), parseFloat(dStation.latitude)], [parseFloat(destLon), parseFloat(destLat)]] } },
          ];

          candidates.push({
            type: 'direct',
            total_minutes: Math.round((walkToOrigin + tr.minutes + walkFromDest) * 100) / 100,
            geometry: buildItineraryGeoJSON(steps),
            steps,
          });
        }
      }
    }
  }

  // Try single-transfer routes if no direct found
  if (candidates.length === 0) {
    for (const oStation of originStations) {
      const oRoutes = await dbService.getRoutesByStation(oStation.id);
      for (const dStation of destStations) {
        const dRoutes = await dbService.getRoutesByStation(dStation.id);

        for (const oRoute of oRoutes) {
          const oRouteStations = await dbService.getRouteStations(oRoute.id);
          for (const dRoute of dRoutes) {
            const dRouteStations = await dbService.getRouteStations(dRoute.id);

            // Find transfer stations (stations near each other on different routes)
            const transfers = findTransferPoints(oRouteStations, dRouteStations);

            for (const transfer of transfers) {
              const leg1 = await computeRouteTravelTime(oRoute.id, oStation.id, transfer.from.id);
              const leg2 = await computeRouteTravelTime(dRoute.id, transfer.to.id, dStation.id);

              if (leg1 !== null && leg2 !== null) {
                const walkToOrigin = walkTime(oStation.distance_km);
                const walkFromDest = walkTime(dStation.distance_km);
                const transferWalk = walkTime(transfer.distance_km);
                const oStyle = getNetworkStyle(oRoute.network_name);
                const dStyle = getNetworkStyle(dRoute.network_name);

                const tFrom = transfer.from;
                const tTo = transfer.to;

                const steps = [
                  { action: 'walk', from: 'origin', to: oStation.station_name, station_id: oStation.id, duration_minutes: Math.round(walkToOrigin * 100) / 100, distance_km: Math.round(oStation.distance_km * 1000) / 1000, geometry: { type: 'LineString', coordinates: [[parseFloat(originLon), parseFloat(originLat)], [parseFloat(oStation.longitude), parseFloat(oStation.latitude)]] } },
                  { action: 'ride', transport: oRoute.network_name, route: oRoute.route_name, route_id: oRoute.id, from: oStation.station_name, from_station_id: oStation.id, to: tFrom.station_name, to_station_id: tFrom.id, duration_minutes: leg1.minutes, geometry: { type: 'LineString', coordinates: leg1.coordinates }, color: oStyle.color },
                  { action: 'transfer', from: tFrom.station_name, from_station_id: tFrom.id, to: tTo.station_name, to_station_id: tTo.id, duration_minutes: Math.round(transferWalk * 100) / 100, distance_km: Math.round(transfer.distance_km * 1000) / 1000, geometry: { type: 'LineString', coordinates: [[parseFloat(tFrom.longitude), parseFloat(tFrom.latitude)], [parseFloat(tTo.longitude), parseFloat(tTo.latitude)]] } },
                  { action: 'ride', transport: dRoute.network_name, route: dRoute.route_name, route_id: dRoute.id, from: tTo.station_name, from_station_id: tTo.id, to: dStation.station_name, to_station_id: dStation.id, duration_minutes: leg2.minutes, geometry: { type: 'LineString', coordinates: leg2.coordinates }, color: dStyle.color },
                  { action: 'walk', from: dStation.station_name, to: 'destination', station_id: dStation.id, duration_minutes: Math.round(walkFromDest * 100) / 100, distance_km: Math.round(dStation.distance_km * 1000) / 1000, geometry: { type: 'LineString', coordinates: [[parseFloat(dStation.longitude), parseFloat(dStation.latitude)], [parseFloat(destLon), parseFloat(destLat)]] } },
                ];

                candidates.push({
                  type: 'transfer',
                  total_minutes: Math.round((walkToOrigin + leg1.minutes + transferWalk + leg2.minutes + walkFromDest) * 100) / 100,
                  geometry: buildItineraryGeoJSON(steps),
                  steps,
                });
              }
            }
          }
        }
      }
    }
  }

  if (candidates.length === 0) {
    return {
      error: 'No route found between the given locations.',
      origin_stations: originStations.map(s => ({ id: s.id, name: s.name, distance_km: s.distance_km })),
      destination_stations: destStations.map(s => ({ id: s.id, name: s.name, distance_km: s.distance_km })),
    };
  }

  // Sort by total time and return top 3
  candidates.sort((a, b) => a.total_minutes - b.total_minutes);
  return {
    origin: { lat: parseFloat(originLat), lon: parseFloat(originLon) },
    destination: { lat: parseFloat(destLat), lon: parseFloat(destLon) },
    itineraries: candidates.slice(0, 3),
  };
}

/**
 * Compute total travel time along a route between two stations.
 * Returns null if the stations are not on the route in the right order.
 */
async function computeRouteTravelTime(routeId, fromStationId, toStationId) {
  const routeStations = await dbService.getRouteStations(routeId);
  const fromIdx = routeStations.findIndex(rs => rs.id === fromStationId);
  const toIdx = routeStations.findIndex(rs => rs.id === toStationId);

  if (fromIdx === -1 || toIdx === -1 || fromIdx >= toIdx) return null;

  let totalMinutes = 0;
  const coordinates = [];
  for (let i = fromIdx; i <= toIdx; i++) {
    const st = routeStations[i];
    if (st.latitude && st.longitude) {
      coordinates.push([parseFloat(st.longitude), parseFloat(st.latitude)]);
    }
    if (i < toIdx) {
      const tt = await dbService.getTravelTime(routeId, routeStations[i].id, routeStations[i + 1].id);
      if (!tt) return null;
      totalMinutes += parseFloat(tt.travel_time_minutes);
    }
  }

  return {
    minutes: Math.round(totalMinutes * 100) / 100,
    coordinates,
  };
}

/**
 * Find potential transfer points between two sets of route stations.
 */
function findTransferPoints(routeAStations, routeBStations) {
  const transfers = [];

  for (const sA of routeAStations) {
    for (const sB of routeBStations) {
      if (sA.id === sB.id) {
        transfers.push({ from: sA, to: sB, distance_km: 0 });
      } else if (sA.latitude && sA.longitude && sB.latitude && sB.longitude) {
        const dist = haversineDistance(sA.latitude, sA.longitude, sB.latitude, sB.longitude);
        if (dist <= MAX_TRANSFER_WALK_KM) {
          transfers.push({ from: sA, to: sB, distance_km: dist });
        }
      }
    }
  }

  return transfers.sort((a, b) => a.distance_km - b.distance_km).slice(0, 3);
}

/**
 * Walking time in minutes for a given distance in km.
 */
function walkTime(distanceKm) {
  return (distanceKm / WALK_SPEED_KMH) * 60;
}

/**
 * Build a GeoJSON FeatureCollection from itinerary steps.
 */
function buildItineraryGeoJSON(steps) {
  const features = steps
    .filter(s => s.geometry && s.geometry.coordinates && s.geometry.coordinates.length >= 2)
    .map(s => ({
      type: 'Feature',
      geometry: s.geometry,
      properties: {
        mode: s.action,
        route: s.route || null,
        route_id: s.route_id || null,
        color: s.color || WALK_COLOR,
        dashArray: (s.action === 'walk' || s.action === 'transfer') ? WALK_DASH : null,
      },
    }));
  return { type: 'FeatureCollection', features };
}

module.exports = {
  computeItinerary,
  computeRouteTravelTime,
  findTransferPoints,
  walkTime,
};
