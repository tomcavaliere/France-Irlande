import { describe, it, expect } from 'vitest';
import DashboardCore from '../js/core/dashboard-core.js';

const {
  linePath, cumulative, addDaysISO, weekStartISO, roundByStep, clampMetric,
  normalizeHealthEntry, formatHealthValue, healthSeries, positiveNumber,
  normalizeTrainingEntry, formatTrainingValue, trainingSeries, weekTotal
} = DashboardCore;

const METRICS = [
  { key: 'sleep', min: 0, max: 10, step: 0.1, unit: '/10' },
  { key: 'hrAvg', min: 0, max: 250, step: 1, unit: ' bpm' },
  { key: 'tempMin', min: -30, max: 60, step: 0.1, unit: ' °C' }
];

describe('linePath', () => {
  it('vide → chaîne vide', () => {
    expect(linePath([], 0, 10)).toBe('');
  });
  it('une valeur → segment horizontal', () => {
    expect(linePath([5], 0, 10)).toBe('M 4 35 L 96 35');
  });
  it('plusieurs valeurs réparties sur la largeur, min en bas, max en haut', () => {
    expect(linePath([0, 5, 10], 0, 10)).toBe('M 4 62 L 50 35 L 96 8');
  });
  it('plage nulle → courbe sur la ligne de base', () => {
    expect(linePath([0, 0], 0, 0)).toBe('M 4 62 L 96 62');
  });
});

describe('cumulative', () => {
  it('cumule progressivement', () => {
    expect(cumulative([1, 2, 3])).toEqual([1, 3, 6]);
    expect(cumulative([])).toEqual([]);
  });
});

describe('addDaysISO / weekStartISO', () => {
  it('ajoute des jours en traversant mois et années', () => {
    expect(addDaysISO('2026-05-30', 3)).toBe('2026-06-02');
    expect(addDaysISO('2026-01-01', -1)).toBe('2025-12-31');
  });
  it('retourne le lundi de la semaine', () => {
    expect(weekStartISO('2026-05-20')).toBe('2026-05-18'); // mercredi
    expect(weekStartISO('2026-05-18')).toBe('2026-05-18'); // lundi
    expect(weekStartISO('2026-05-24')).toBe('2026-05-18'); // dimanche
  });
});

describe('roundByStep / clampMetric', () => {
  it('arrondit au pas sans bruit flottant', () => {
    expect(roundByStep(7.349, 0.1)).toBe(7.3);
    expect(roundByStep(0.1 + 0.2, 0.1)).toBe(0.3);
    expect(roundByStep(71.6, 1)).toBe(72);
    expect(roundByStep('4', 0)).toBe(4);
  });
  it('borne puis arrondit ; non numérique → 0', () => {
    expect(clampMetric(METRICS[0], 12)).toBe(10);
    expect(clampMetric(METRICS[2], -45)).toBe(-30);
    expect(clampMetric(METRICS[1], 71.6)).toBe(72);
    expect(clampMetric(METRICS[0], 'abc')).toBe(0);
  });
});

describe('normalizeHealthEntry / formatHealthValue / healthSeries', () => {
  it('normalise toutes les métriques et garde un ts valide', () => {
    expect(normalizeHealthEntry({ sleep: 7.26, hrAvg: 300, ts: 99 }, METRICS))
      .toEqual({ ts: 99, sleep: 7.3, hrAvg: 250, tempMin: 0 });
  });
  it('ts absent → horloge injectée', () => {
    expect(normalizeHealthEntry(null, METRICS, 1234).ts).toBe(1234);
  });
  it('formate selon le pas', () => {
    expect(formatHealthValue(METRICS[0], 7)).toBe('7.0/10');
    expect(formatHealthValue(METRICS[1], 71.6)).toBe('72 bpm');
  });
  it('série chronologique triée par date', () => {
    const tree = { '2026-05-02': { sleep: 6 }, '2026-05-01': { sleep: 8 } };
    expect(healthSeries(tree, METRICS[0], METRICS)).toEqual([
      { date: '2026-05-01', val: 8 },
      { date: '2026-05-02', val: 6 }
    ]);
    expect(healthSeries(null, METRICS[0], METRICS)).toEqual([]);
  });
});

describe('training', () => {
  it('positiveNumber : fini et > 0, sinon 0', () => {
    expect(positiveNumber('12.5')).toBe(12.5);
    expect(positiveNumber(-3)).toBe(0);
    expect(positiveNumber('x')).toBe(0);
  });
  it('normalizeTrainingEntry : squats/pompes entiers, négatifs à 0', () => {
    expect(normalizeTrainingEntry({ squats: 20.6, pushups: -5, absMin: 2.5, runKm: 'x', ts: 7 }))
      .toEqual({ squats: 21, pushups: 0, absMin: 2.5, runKm: 0, ts: 7 });
    expect(normalizeTrainingEntry(null, 42).ts).toBe(42);
  });
  it('formatTrainingValue par exercice', () => {
    expect(formatTrainingValue('runKm', 5)).toBe('5.0');
    expect(formatTrainingValue('absMin', 10)).toBe('10');
    expect(formatTrainingValue('absMin', 2.5)).toBe('2.5');
    expect(formatTrainingValue('squats', 99.6)).toBe('100');
  });
  it('trainingSeries et weekTotal', () => {
    const tree = {
      '2026-05-17': { squats: 50 },  // dimanche, semaine précédente
      '2026-05-18': { squats: 30 },  // lundi
      '2026-05-24': { squats: 40 },  // dimanche
      '2026-05-25': { squats: 99 }   // lundi suivant
    };
    expect(trainingSeries(tree, 'squats').map((d) => d.val)).toEqual([50, 30, 40, 99]);
    expect(weekTotal(tree, 'squats', '2026-05-18')).toBe(70);
    expect(weekTotal(null, 'squats', '2026-05-18')).toBe(0);
  });
});
