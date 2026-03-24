/**
 * Unit tests for the pricing service.
 */

const {
  estimateDDDFare,
  estimateBRTFare,
  calculateRouteDistance,
  calculateSegmentDistanceKm,
  estimateStepFare,
  calculateItineraryPricing,
  getPricingConfig,
} = require('../src/services/pricingService');

const { DDD_FARE_TIERS, BRT_FARES } = require('../src/config/pricing');

describe('Pricing Service', () => {
  describe('estimateDDDFare', () => {
    it('should return 150 FCFA for distances up to 3 km', () => {
      expect(estimateDDDFare(0)).toBe(150);
      expect(estimateDDDFare(1)).toBe(150);
      expect(estimateDDDFare(2.5)).toBe(150);
      expect(estimateDDDFare(3)).toBe(150);
    });

    it('should return 200 FCFA for distances between 3 and 5 km', () => {
      expect(estimateDDDFare(3.1)).toBe(200);
      expect(estimateDDDFare(4)).toBe(200);
      expect(estimateDDDFare(5)).toBe(200);
    });

    it('should return 250 FCFA for distances between 5 and 8 km', () => {
      expect(estimateDDDFare(5.1)).toBe(250);
      expect(estimateDDDFare(7)).toBe(250);
      expect(estimateDDDFare(8)).toBe(250);
    });

    it('should return 300 FCFA for distances between 8 and 12 km', () => {
      expect(estimateDDDFare(8.1)).toBe(300);
      expect(estimateDDDFare(10)).toBe(300);
      expect(estimateDDDFare(12)).toBe(300);
    });

    it('should return 350 FCFA for distances between 12 and 16 km', () => {
      expect(estimateDDDFare(12.1)).toBe(350);
      expect(estimateDDDFare(14)).toBe(350);
      expect(estimateDDDFare(16)).toBe(350);
    });

    it('should return 400 FCFA for distances between 16 and 20 km', () => {
      expect(estimateDDDFare(16.1)).toBe(400);
      expect(estimateDDDFare(18)).toBe(400);
      expect(estimateDDDFare(20)).toBe(400);
    });

    it('should return 450 FCFA for distances between 20 and 25 km', () => {
      expect(estimateDDDFare(20.1)).toBe(450);
      expect(estimateDDDFare(22)).toBe(450);
      expect(estimateDDDFare(25)).toBe(450);
    });

    it('should return 500 FCFA for distances over 25 km', () => {
      expect(estimateDDDFare(25.1)).toBe(500);
      expect(estimateDDDFare(30)).toBe(500);
      expect(estimateDDDFare(100)).toBe(500);
    });

    it('should handle edge cases gracefully', () => {
      expect(estimateDDDFare(-1)).toBe(150);
      expect(estimateDDDFare(NaN)).toBe(150);
      expect(estimateDDDFare(null)).toBe(150);
      expect(estimateDDDFare(undefined)).toBe(150);
    });
  });

  describe('estimateBRTFare', () => {
    it('should return 400 FCFA for standard BRT', () => {
      expect(estimateBRTFare('standard')).toBe(400);
      expect(estimateBRTFare()).toBe(400);
    });

    it('should return 500 FCFA for express BRT', () => {
      expect(estimateBRTFare('express')).toBe(500);
    });

    it('should return default fare for unknown types', () => {
      expect(estimateBRTFare('unknown')).toBe(500);
    });
  });

  describe('calculateRouteDistance', () => {
    it('should sum distance_meters from steps', () => {
      const steps = [
        { distance_meters: 1000 },
        { distance_meters: 2000 },
        { distance_meters: 500 },
      ];
      expect(calculateRouteDistance(steps)).toBe(3.5);
    });

    it('should return 0 for empty steps', () => {
      expect(calculateRouteDistance([])).toBe(0);
    });

    it('should skip steps without distance', () => {
      const steps = [
        { distance_meters: 1000 },
        { mode: 'walk' },
        { distance_meters: 2000 },
      ];
      expect(calculateRouteDistance(steps)).toBe(3);
    });
  });

  describe('calculateSegmentDistanceKm', () => {
    it('should calculate distance between two points', () => {
      // Dakar coordinates (approximate)
      const dist = calculateSegmentDistanceKm(14.6937, -17.4441, 14.7167, -17.4677);
      expect(dist).toBeGreaterThan(0);
      expect(dist).toBeLessThan(10);
    });

    it('should return 0 for missing coordinates', () => {
      expect(calculateSegmentDistanceKm(null, null, null, null)).toBe(0);
      expect(calculateSegmentDistanceKm(14.6937, null, 14.7167, -17.4677)).toBe(0);
    });
  });

  describe('estimateStepFare', () => {
    it('should return DDD fare for DDD mode', () => {
      expect(estimateStepFare({ mode: 'DDD' }, 5)).toBe(200);
      expect(estimateStepFare({ mode: 'ddd' }, 10)).toBe(300);
    });

    it('should return BRT fare for BRT mode', () => {
      expect(estimateStepFare({ mode: 'BRT' }, 5)).toBe(400);
      expect(estimateStepFare({ mode: 'BRT', service_type: 'express' }, 5)).toBe(500);
    });

    it('should return null for TER mode', () => {
      expect(estimateStepFare({ mode: 'TER' }, 5)).toBeNull();
    });

    it('should return 0 for walk mode', () => {
      expect(estimateStepFare({ mode: 'walk' }, 0.5)).toBe(0);
      expect(estimateStepFare({ mode: 'WALK' }, 0.5)).toBe(0);
    });
  });

  describe('calculateItineraryPricing', () => {
    it('should add pricing to DDD steps', () => {
      const itinerary = {
        origin: 'Point A',
        destination: 'Point B',
        steps: [
          { mode: 'walk', distance_meters: 200 },
          { mode: 'DDD', distance_meters: 5000 },
          { mode: 'walk', distance_meters: 150 },
        ],
      };

      const result = calculateItineraryPricing(itinerary);

      expect(result.total_price).toBe(200); // 5km = 200 FCFA
      expect(result.steps[0].estimated_price).toBe(0);
      expect(result.steps[1].estimated_price).toBe(200);
      expect(result.steps[1].distance_km).toBe(5);
      expect(result.steps[2].estimated_price).toBe(0);
    });

    it('should add pricing to BRT steps', () => {
      const itinerary = {
        steps: [
          { mode: 'BRT' },
        ],
      };

      const result = calculateItineraryPricing(itinerary);

      expect(result.total_price).toBe(400);
      expect(result.steps[0].estimated_price).toBe(400);
    });

    it('should handle multimodal itineraries', () => {
      const itinerary = {
        steps: [
          { mode: 'walk', distance_meters: 300 },
          { mode: 'DDD', distance_meters: 3000 },
          { mode: 'walk', distance_meters: 200 },
          { mode: 'BRT' },
          { mode: 'walk', distance_meters: 100 },
        ],
      };

      const result = calculateItineraryPricing(itinerary);

      expect(result.total_price).toBe(550); // 150 (DDD 3km) + 400 (BRT)
      expect(result.steps[1].estimated_price).toBe(150);
      expect(result.steps[3].estimated_price).toBe(400);
    });

    it('should handle null/undefined itinerary', () => {
      expect(calculateItineraryPricing(null)).toBeNull();
      expect(calculateItineraryPricing(undefined)).toBeUndefined();
    });

    it('should handle itinerary without steps', () => {
      const itinerary = { origin: 'A', destination: 'B' };
      expect(calculateItineraryPricing(itinerary)).toEqual(itinerary);
    });
  });

  describe('getPricingConfig', () => {
    it('should return DDD config', () => {
      const config = getPricingConfig('DDD');
      expect(config.type).toBe('step');
      expect(config.tiers).toBeDefined();
      expect(config.currency).toBe('FCFA');
    });

    it('should return BRT config', () => {
      const config = getPricingConfig('BRT');
      expect(config.type).toBe('fixed');
      expect(config.fares).toBeDefined();
    });

    it('should return TER config', () => {
      const config = getPricingConfig('TER');
      expect(config.type).toBe('zone');
    });

    it('should be case-insensitive', () => {
      expect(getPricingConfig('ddd')).toEqual(getPricingConfig('DDD'));
      expect(getPricingConfig('brt')).toEqual(getPricingConfig('BRT'));
    });

    it('should return null for unknown networks', () => {
      expect(getPricingConfig('UNKNOWN')).toBeNull();
      expect(getPricingConfig('')).toBeNull();
      expect(getPricingConfig(null)).toBeNull();
    });
  });

  describe('DDD Fare Tiers Configuration', () => {
    it('should have all expected price points', () => {
      const prices = DDD_FARE_TIERS.map(t => t.price);
      expect(prices).toContain(150);
      expect(prices).toContain(200);
      expect(prices).toContain(250);
      expect(prices).toContain(300);
      expect(prices).toContain(350);
      expect(prices).toContain(400);
      expect(prices).toContain(450);
      expect(prices).toContain(500);
    });

    it('should have tiers in ascending order', () => {
      for (let i = 1; i < DDD_FARE_TIERS.length; i++) {
        expect(DDD_FARE_TIERS[i].maxDistanceKm).toBeGreaterThan(DDD_FARE_TIERS[i - 1].maxDistanceKm);
        expect(DDD_FARE_TIERS[i].price).toBeGreaterThan(DDD_FARE_TIERS[i - 1].price);
      }
    });

    it('should have last tier with Infinity distance', () => {
      const lastTier = DDD_FARE_TIERS[DDD_FARE_TIERS.length - 1];
      expect(lastTier.maxDistanceKm).toBe(Infinity);
    });
  });
});
