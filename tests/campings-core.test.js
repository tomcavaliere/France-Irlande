import { describe, it, expect } from 'vitest';
import campingsCore from '../js/campings-core.js';

const { nearTrace, normalizeWebsite, campingTags, mapCampingFeature } = campingsCore;

describe('nearTrace', () => {
  const pts = [
    [45.0, 6.0], [45.1, 6.1], [45.2, 6.2],
    [45.3, 6.3], [45.4, 6.4], [45.5, 6.5]
  ];

  it('retourne true pour un point proche', () => {
    expect(nearTrace(45.0005, 6.0005, pts, 1)).toBe(true);
  });

  it('retourne false pour un point lointain', () => {
    expect(nearTrace(48, 2, pts, 1)).toBe(false);
  });

  it('respecte l’échantillonnage i+=3', () => {
    const p = [
      [0.0, 0.0], [45.0, 45.0], [45.0, 45.0],
      [0.01, 0.01]
    ];
    expect(nearTrace(45.0, 45.0, p, 1)).toBe(false);
    expect(nearTrace(0.01, 0.01, p, 2)).toBe(true);
  });
});

describe('normalizeWebsite', () => {
  it('garde uniquement http/https', () => {
    expect(normalizeWebsite('https://a.b')).toBe('https://a.b');
    expect(normalizeWebsite('http://a.b')).toBe('http://a.b');
    expect(normalizeWebsite('javascript:alert(1)')).toBe('');
    expect(normalizeWebsite('ftp://a.b')).toBe('');
  });
});

describe('campingTags', () => {
  it('mappe les tags attendus', () => {
    const tags = campingTags({
      shower: 'yes',
      drinking_water: 'yes',
      toilets: 'yes',
      electricity: 'yes',
      internet_access: 'wlan',
      fee: 'no'
    });
    expect(tags).toEqual(['🚿', '💧', '🚽', '⚡', '📶', 'Gratuit']);
  });
});

describe('mapCampingFeature', () => {
  it('mappe un feature valide', () => {
    const r = mapCampingFeature({
      geometry: { coordinates: [6.1, 45.2] },
      properties: { name: 'Mon Camp', website: 'https://camp.test', shower: 'yes' }
    });
    expect(r.lat).toBe(45.2);
    expect(r.lon).toBe(6.1);
    expect(r.name).toBe('Mon Camp');
    expect(r.website).toBe('https://camp.test');
    expect(r.tags).toContain('🚿');
  });

  it('fallback nom + blocage URL non-safe', () => {
    const r = mapCampingFeature({
      geometry: { coordinates: [6.1, 45.2] },
      properties: { 'name:fr': '', website: 'javascript:alert(1)' }
    });
    expect(r.name).toBe('Camping sans nom');
    expect(r.website).toBe('');
  });

  it('retourne null si feature invalide', () => {
    expect(mapCampingFeature(null)).toBeNull();
    expect(mapCampingFeature({ geometry: { coordinates: [1] } })).toBeNull();
  });
});
