const { parsePrice, extractCity, calculatePriceStats } = require('../src/scraper');

describe('Scraper Utilities', () => {
  describe('parsePrice', () => {
    test('parses Hungarian price format with spaces', () => {
      expect(parsePrice('45 000 000 Ft')).toBe(45000000);
    });

    test('parses million shorthand', () => {
      expect(parsePrice('45M Ft')).toBe(45000000);
    });

    test('parses decimal million shorthand', () => {
      expect(parsePrice('45.5M Ft')).toBe(45500000);
    });

    test('returns null for invalid input', () => {
      expect(parsePrice('')).toBeNull();
      expect(parsePrice(null)).toBeNull();
      expect(parsePrice(undefined)).toBeNull();
    });
  });

  describe('extractCity', () => {
    test('extracts city from comma-separated address', () => {
      const city = extractCity('Budapest, XIII. kerület');
      expect(city).toBeTruthy();
    });

    test('returns input for single location', () => {
      expect(extractCity('Debrecen')).toBe('Debrecen');
    });

    test('handles empty input', () => {
      expect(extractCity('')).toBeNull();
      expect(extractCity(null)).toBeNull();
    });
  });

  describe('calculatePriceStats', () => {
    test('calculates stats for a set of prices', () => {
      const stats = calculatePriceStats([10, 20, 30, 40, 50]);
      expect(stats.avg).toBe(30);
      expect(stats.median).toBe(30);
      expect(stats.min).toBe(10);
      expect(stats.max).toBe(50);
    });

    test('handles single price', () => {
      const stats = calculatePriceStats([100]);
      expect(stats.avg).toBe(100);
      expect(stats.median).toBe(100);
    });

    test('handles empty array', () => {
      const stats = calculatePriceStats([]);
      expect(stats.avg).toBe(0);
      expect(stats.min).toBe(0);
      expect(stats.max).toBe(0);
    });
  });
});
