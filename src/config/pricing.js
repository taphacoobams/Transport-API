/**
 * Pricing configuration for Dakar transport networks.
 * DDD uses step-based pricing depending on distance traveled.
 */

const DDD_FARE_TIERS = [
  { maxDistanceKm: 3, price: 150 },
  { maxDistanceKm: 5, price: 200 },
  { maxDistanceKm: 8, price: 250 },
  { maxDistanceKm: 12, price: 300 },
  { maxDistanceKm: 16, price: 350 },
  { maxDistanceKm: 20, price: 400 },
  { maxDistanceKm: 25, price: 450 },
  { maxDistanceKm: Infinity, price: 500 },
];

const BRT_FARES = {
  standard: 400,
  express: 500,
};

const AFTU_FARES = {
  standard: 200,
  express: 250,
};

const TER_ZONE_FARES = {
  1: 500,
  2: 1000,
  3: 1500,
};

const PRICING_CONFIG = {
  DDD: {
    type: 'step',
    tiers: DDD_FARE_TIERS,
    currency: 'FCFA',
  },
  BRT: {
    type: 'fixed',
    fares: BRT_FARES,
    defaultFare: 500,
    currency: 'FCFA',
  },
  AFTU: {
    type: 'fixed',
    fares: AFTU_FARES,
    defaultFare: 200,
    currency: 'FCFA',
  },
  TER: {
    type: 'zone',
    fares: TER_ZONE_FARES,
    currency: 'FCFA',
  },
};

module.exports = {
  DDD_FARE_TIERS,
  BRT_FARES,
  AFTU_FARES,
  TER_ZONE_FARES,
  PRICING_CONFIG,
};
