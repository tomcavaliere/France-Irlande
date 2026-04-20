import { describe, it, expect } from 'vitest';
import StagesCore from '../js/stages-core.js';

const { countryFlag, formatStageDateLabel, computeRecapTotals } = StagesCore;

describe('countryFlag', () => {
  it('retourne 🇫🇷 si idx = 0 (bien en deçà de la frontière)', () => {
    expect(countryFlag(0, 1000)).toBe('🇫🇷');
  });
  it('retourne 🇫🇷 si idx === franceEndIdx (frontière incluse)', () => {
    expect(countryFlag(1000, 1000)).toBe('🇫🇷');
  });
  it('retourne 🇮🇪 si idx > franceEndIdx', () => {
    expect(countryFlag(1001, 1000)).toBe('🇮🇪');
  });
  it('retourne "" si idx négatif ou NaN', () => {
    expect(countryFlag(-1, 1000)).toBe('');
    expect(countryFlag(NaN, 1000)).toBe('');
  });
});

describe('formatStageDateLabel', () => {
  it('contient le jour abrégé et le mois abrégé en fr-FR', () => {
    const label = formatStageDateLabel('2026-04-20');
    expect(label).toContain('lun.');
    expect(label).toContain('avr.');
  });
});

describe('computeRecapTotals', () => {
  it('retourne pct=0 et avg=0 si kmDone=0 et nbDays=0', () => {
    expect(computeRecapTotals(0, 100, 0, 1000)).toEqual({ pct: 0, avgKmPerDay: 0 });
  });
  it('calcule pct et avgKmPerDay corrects', () => {
    expect(computeRecapTotals(500, 500, 10, 1000)).toEqual({ pct: 50, avgKmPerDay: 50 });
  });
  it('clamp pct à 100 si kmDone > totalKm', () => {
    expect(computeRecapTotals(1200, 0, 5, 1000)).toEqual({ pct: 100, avgKmPerDay: 240 });
  });
  it('arrondit pct (49.4 → 49)', () => {
    const r = computeRecapTotals(494, 0, 1, 1000);
    expect(r.pct).toBe(49);
  });
  it('protège la division par zéro (nbDays=0)', () => {
    const r = computeRecapTotals(500, 500, 0, 1000);
    expect(r.avgKmPerDay).toBe(0);
  });
});
