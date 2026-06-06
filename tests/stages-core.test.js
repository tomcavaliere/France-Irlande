import { describe, it, expect } from 'vitest';
import StagesCore from '../js/stages-core.js';

const { countryFlag, formatStageDateLabel, computeRecapTotals, isValidStageDate, buildManualStage } = StagesCore;

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

describe('isValidStageDate', () => {
  it('accepte une vraie date ISO', () => {
    expect(isValidStageDate('2026-04-20')).toBe(true);
  });
  it('rejette une date impossible', () => {
    expect(isValidStageDate('2026-02-30')).toBe(false);
  });
});

describe('buildManualStage', () => {
  it('annule la création si une étape existe déjà', () => {
    const result = buildManualStage('2026-04-20', {
      '2026-04-20': { lat: 1, lon: 2, kmTotal: 30 }
    }, null, Date.UTC(2026, 3, 21));
    expect(result).toEqual({ ok: false, error: 'Une étape existe déjà pour cette date.' });
  });

  it('reprend la dernière étape précédente comme base', () => {
    const result = buildManualStage('2026-04-21', {
      '2026-04-20': { lat: 48.1, lon: -1.7, kmTotal: 120.4 }
    }, { lat: 49, lon: -2, kmTotal: 130 }, Date.UTC(2026, 3, 21));
    expect(result.ok).toBe(true);
    expect(result.stageData).toMatchObject({
      lat: 48.1,
      lon: -1.7,
      kmTotal: 120.4,
      kmDay: 0,
      elevGain: 0,
      note: '',
      published: false
    });
  });

  it('retombe sur current s’il n’existe encore aucune étape', () => {
    const result = buildManualStage('2026-04-20', {}, {
      lat: 47.2,
      lon: -1.55,
      kmTotal: 12
    }, Date.UTC(2026, 3, 20));
    expect(result.ok).toBe(true);
    expect(result.stageData).toMatchObject({
      lat: 47.2,
      lon: -1.55,
      kmTotal: 12,
      kmDay: 0
    });
  });

  it('bloque la création d’une étape dans le futur', () => {
    const result = buildManualStage('2026-04-22', {}, null, Date.UTC(2026, 3, 21));
    expect(result).toEqual({ ok: false, error: 'Impossible de créer une étape dans le futur.' });
  });
});
