import { describe, it, expect } from 'vitest';
import StagesCore from '../js/stages-core.js';

const {
  countryFlag, formatStageDateLabel, computeRecapTotals, isValidStageDate, buildManualStage,
  collectStageStoragePaths, dayCount
} = StagesCore;

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
    }, null, new Date(2026, 3, 21, 12).getTime());
    expect(result).toEqual({ ok: false, error: 'Une étape existe déjà pour cette date.' });
  });

  it('reprend la dernière étape précédente comme base', () => {
    const result = buildManualStage('2026-04-21', {
      '2026-04-20': { lat: 48.1, lon: -1.7, kmTotal: 120.4 }
    }, { lat: 49, lon: -2, kmTotal: 130 }, new Date(2026, 3, 21, 12).getTime());
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
    }, new Date(2026, 3, 20, 12).getTime());
    expect(result.ok).toBe(true);
    expect(result.stageData).toMatchObject({
      lat: 47.2,
      lon: -1.55,
      kmTotal: 12,
      kmDay: 0
    });
  });

  it('bloque la création d’une étape dans le futur', () => {
    const result = buildManualStage('2026-04-22', {}, null, new Date(2026, 3, 21, 12).getTime());
    expect(result).toEqual({ ok: false, error: 'Impossible de créer une étape dans le futur.' });
  });
});

describe('collectStageStoragePaths', () => {
  it('retourne les paths Storage des photos et vidéos', () => {
    const photos = {
      p1: { url: 'https://x/1.jpg', path: 'photos/2026-05-02/p1.jpg', ts: 1 },
      p2: { url: 'https://x/2.jpg', path: 'photos/2026-05-02/p2.jpg', ts: 2 }
    };
    const videos = { v1: 'https://firebasestorage.googleapis.com/v1' };
    expect(collectStageStoragePaths('2026-05-02', photos, videos)).toEqual([
      'photos/2026-05-02/p1.jpg',
      'photos/2026-05-02/p2.jpg',
      'videos/2026-05-02/v1'
    ]);
  });

  it('ignore les photos legacy base64 et les meta sans path', () => {
    const photos = {
      legacy: 'data:image/jpeg;base64,AAAA',
      noPath: { url: 'https://x/3.jpg', ts: 3 },
      emptyPath: { url: 'https://x/4.jpg', path: '', ts: 4 }
    };
    expect(collectStageStoragePaths('2026-05-02', photos, null)).toEqual([]);
  });

  it('tolère des arbres absents ou invalides', () => {
    expect(collectStageStoragePaths('2026-05-02', null, undefined)).toEqual([]);
    expect(collectStageStoragePaths('2026-05-02', 'x', 42)).toEqual([]);
  });
});

describe('dayCount', () => {
  it('compte les étapes quand elles sont chargées', () => {
    expect(dayCount({ a: {}, b: {}, c: {} }, { a: {} })).toBe(3);
  });
  it('repli sur les jours avec tracé GPX tant que les étapes sont inconnues', () => {
    expect(dayCount({}, { a: {}, b: {} })).toBe(2);
    expect(dayCount(null, { a: {} })).toBe(1);
  });
  it('0 sans étape ni tracé', () => {
    expect(dayCount(null, null)).toBe(0);
  });
});
