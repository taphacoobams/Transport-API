const dbService = require('./database.service');
const { haversineDistance } = require('../utils/geo.utils');

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
        const travelTime = await computeRouteTravelTime(route.id, oStation.id, dStation.id);
        if (travelTime !== null) {
          const walkToOrigin = walkTime(oStation.distance_km);
          const walkFromDest = walkTime(dStation.distance_km);

          candidates.push({
            type: 'direct',
            total_minutes: Math.round((walkToOrigin + travelTime + walkFromDest) * 100) / 100,
            steps: [
              { action: 'walk', from: 'origin', to: oStation.name, station_id: oStation.id, duration_minutes: Math.round(walkToOrigin * 100) / 100, distance_km: Math.round(oStation.distance_km * 1000) / 1000 },
              { action: 'ride', transport: route.transport_type_name, route: route.name, route_id: route.id, from: oStation.name, from_station_id: oStation.id, to: dStation.name, to_station_id: dStation.id, duration_minutes: travelTime },
              { action: 'walk', from: dStation.name, to: 'destination', station_id: dStation.id, duration_minutes: Math.round(walkFromDest * 100) / 100, distance_km: Math.round(dStation.distance_km * 1000) / 1000 },
            ],
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
              const leg1Time = await computeRouteTravelTime(oRoute.id, oStation.id, transfer.from.id);
              const leg2Time = await computeRouteTravelTime(dRoute.id, transfer.to.id, dStation.id);

              if (leg1Time !== null && leg2Time !== null) {
                const walkToOrigin = walkTime(oStation.distance_km);
                const walkFromDest = walkTime(dStation.distance_km);
                const transferWalk = walkTime(transfer.distance_km);

                candidates.push({
                  type: 'transfer',
                  total_minutes: Math.round((walkToOrigin + leg1Time + transferWalk + leg2Time + walkFromDest) * 100) / 100,
                  steps: [
                    { action: 'walk', from: 'origin', to: oStation.name, station_id: oStation.id, duration_minutes: Math.round(walkToOrigin * 100) / 100, distance_km: Math.round(oStation.distance_km * 1000) / 1000 },
                    { action: 'ride', transport: oRoute.transport_type_name, route: oRoute.name, route_id: oRoute.id, from: oStation.name, from_station_id: oStation.id, to: transfer.from.name, to_station_id: transfer.from.id, duration_minutes: leg1Time },
                    { action: 'transfer', from: transfer.from.name, from_station_id: transfer.from.id, to: transfer.to.name, to_station_id: transfer.to.id, duration_minutes: Math.round(transferWalk * 100) / 100, distance_km: Math.round(transfer.distance_km * 1000) / 1000 },
                    { action: 'ride', transport: dRoute.transport_type_name, route: dRoute.name, route_id: dRoute.id, from: transfer.to.name, from_station_id: transfer.to.id, to: dStation.name, to_station_id: dStation.id, duration_minutes: leg2Time },
                    { action: 'walk', from: dStation.name, to: 'destination', station_id: dStation.id, duration_minutes: Math.round(walkFromDest * 100) / 100, distance_km: Math.round(dStation.distance_km * 1000) / 1000 },
                  ],
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
  for (let i = fromIdx; i < toIdx; i++) {
    const tt = await dbService.getTravelTime(routeId, routeStations[i].id, routeStations[i + 1].id);
    if (!tt) return null;
    totalMinutes += parseFloat(tt.minutes);
  }

  return Math.round(totalMinutes * 100) / 100;
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
      } else {
        const dist = haversineDistance(sA.lat, sA.lon, sB.lat, sB.lon);
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

module.exports = {
  computeItinerary,
  computeRouteTravelTime,
  findTransferPoints,
  walkTime,
};
