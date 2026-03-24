/**
 * Pricing service for Dakar transport networks.
 * 
 * Handles fare calculation for different transport modes:
 * - DDD: Step-based pricing by distance
 * - BRT: Fixed fare
 * - TER: Zone-based (delegated to existing logic)
 */

const { DDD_FARE_TIERS, BRT_FARES, AFTU_FARES, PRICING_CONFIG } = require('../config/pricing');
const { haversine } = require('../utils/haversine');

/**
 * Estimate DDD fare based on distance traveled.
 * Uses step function pricing with predefined tiers.
 * 
 * @param {number} distanceKm - Distance traveled in kilometers
 * @returns {number} Fare in FCFA
 */
function estimateDDDFare(distanceKm) {
  if (typeof distanceKm !== 'number' || isNaN(distanceKm) || distanceKm < 0) {
    return DDD_FARE_TIERS[0].price;
  }

  for (const tier of DDD_FARE_TIERS) {
    if (distanceKm <= tier.maxDistanceKm) {
      return tier.price;
    }
  }

  return DDD_FARE_TIERS[DDD_FARE_TIERS.length - 1].price;
}

/**
 * Get BRT fare.
 * 
 * @param {string} [type='standard'] - Type of BRT service ('standard' or 'express')
 * @returns {number} Fare in FCFA
 */
function estimateBRTFare(type = 'standard') {
  return BRT_FARES[type] || PRICING_CONFIG.BRT.defaultFare;
}

/**
 * Get AFTU fare.
 * 
 * @param {string} [type='standard'] - Type of AFTU service ('standard' or 'express')
 * @returns {number} Fare in FCFA
 */
function estimateAFTUFare(type = 'standard') {
  return AFTU_FARES[type] || PRICING_CONFIG.AFTU.defaultFare;
}

/**
 * Calculate total distance for a route segment from step data.
 * Uses distance_meters if available, otherwise calculates using Haversine.
 * 
 * @param {Array} steps - Array of route steps with coordinates or distance_meters
 * @param {Object} stationMap - Map of station_id to station data with coordinates
 * @returns {number} Total distance in kilometers
 */
function calculateRouteDistance(steps, stationMap = {}) {
  let totalDistanceMeters = 0;

  for (const step of steps) {
    if (step.distance_meters && step.distance_meters > 0) {
      totalDistanceMeters += step.distance_meters;
    } else if (step.from_station_id && step.to_station_id && stationMap) {
      const fromStation = stationMap[step.from_station_id];
      const toStation = stationMap[step.to_station_id];
      
      if (fromStation && toStation && 
          fromStation.latitude && fromStation.longitude &&
          toStation.latitude && toStation.longitude) {
        totalDistanceMeters += haversine(
          fromStation.latitude,
          fromStation.longitude,
          toStation.latitude,
          toStation.longitude
        );
      }
    }
  }

  return totalDistanceMeters / 1000;
}

/**
 * Calculate distance for a single transport segment using station coordinates.
 * 
 * @param {number} fromLat - Origin latitude
 * @param {number} fromLon - Origin longitude
 * @param {number} toLat - Destination latitude
 * @param {number} toLon - Destination longitude
 * @returns {number} Distance in kilometers
 */
function calculateSegmentDistanceKm(fromLat, fromLon, toLat, toLon) {
  if (!fromLat || !fromLon || !toLat || !toLon) {
    return 0;
  }
  return haversine(fromLat, fromLon, toLat, toLon) / 1000;
}

/**
 * Estimate fare for a single step based on transport mode.
 * 
 * @param {Object} step - Route step with mode and distance info
 * @param {number} distanceKm - Distance in kilometers for this step
 * @returns {number|null} Estimated fare in FCFA, or null for walk/unknown modes
 */
function estimateStepFare(step, distanceKm) {
  const mode = (step.mode || '').toUpperCase();

  switch (mode) {
    case 'DDD':
      return estimateDDDFare(distanceKm);
    case 'BRT':
      return estimateBRTFare(step.service_type || 'standard');
    case 'AFTU':
      return estimateAFTUFare(step.service_type || 'standard');
    case 'TER':
      return null;
    case 'WALK':
      return 0;
    default:
      return null;
  }
}

/**
 * Calculate pricing for an entire itinerary.
 * Adds estimated_price to each transport step and computes total_price.
 * 
 * @param {Object} itinerary - Itinerary object with steps array
 * @param {Object} stationMap - Map of station_id to station data
 * @returns {Object} Itinerary with pricing information added
 */
function calculateItineraryPricing(itinerary, stationMap = {}) {
  if (!itinerary || !itinerary.steps) {
    return itinerary;
  }

  let totalPrice = 0;
  const pricedSteps = [];

  let currentDDDSegment = null;

  for (const step of itinerary.steps) {
    const mode = (step.mode || '').toUpperCase();
    const pricedStep = { ...step };

    if (mode === 'DDD') {
      let distanceKm = 0;

      if (step.distance_meters) {
        distanceKm = step.distance_meters / 1000;
      } else if (step.distance_km) {
        distanceKm = step.distance_km;
      } else if (stationMap[step.from_station_id] && stationMap[step.to_station_id]) {
        const from = stationMap[step.from_station_id];
        const to = stationMap[step.to_station_id];
        distanceKm = calculateSegmentDistanceKm(from.latitude, from.longitude, to.latitude, to.longitude);
      }

      pricedStep.distance_km = Math.round(distanceKm * 100) / 100;
      pricedStep.estimated_price = estimateDDDFare(distanceKm);
      totalPrice += pricedStep.estimated_price;

    } else if (mode === 'BRT') {
      pricedStep.estimated_price = estimateBRTFare(step.service_type);
      totalPrice += pricedStep.estimated_price;

    } else if (mode === 'AFTU') {
      pricedStep.estimated_price = estimateAFTUFare(step.service_type);
      totalPrice += pricedStep.estimated_price;

    } else if (mode === 'TER') {
      pricedStep.estimated_price = null;

    } else if (mode === 'WALK') {
      pricedStep.estimated_price = 0;
    }

    pricedSteps.push(pricedStep);
  }

  return {
    ...itinerary,
    total_price: totalPrice,
    steps: pricedSteps,
  };
}

/**
 * Get pricing configuration for a specific network.
 * 
 * @param {string} network - Network identifier (DDD, BRT, TER)
 * @returns {Object|null} Pricing configuration or null if not found
 */
function getPricingConfig(network) {
  return PRICING_CONFIG[(network || '').toUpperCase()] || null;
}

module.exports = {
  estimateDDDFare,
  estimateBRTFare,
  estimateAFTUFare,
  calculateRouteDistance,
  calculateSegmentDistanceKm,
  estimateStepFare,
  calculateItineraryPricing,
  getPricingConfig,
};
