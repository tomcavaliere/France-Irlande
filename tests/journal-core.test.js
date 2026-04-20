import { describe, it, expect } from 'vitest';
import JournalCore from '../js/journal-core.js';

const { countBravos, hasVoted, buildKmInfoLabel, formatJournalDateLabel } = JournalCore;

describe('countBravos', () => {
  it('retourne 0 pour null/undefined/objet vide', () => {
    expect(countBravos(null)).toBe(0);
    expect(countBravos(undefined)).toBe(0);
    expect(countBravos({})).toBe(0);
  });
  it('compte les clés', () => {
    expect(countBravos({ a: true, b: true })).toBe(2);
  });
});

describe('hasVoted', () => {
  it('retourne false si bravosData null/undefined', () => {
    expect(hasVoted(null, 'me')).toBe(false);
    expect(hasVoted(undefined, 'me')).toBe(false);
  });
  it('retourne false si visitorId absent', () => {
    expect(hasVoted({}, 'me')).toBe(false);
    expect(hasVoted({ other: true }, 'me')).toBe(false);
  });
  it('retourne true si visitorId présent', () => {
    expect(hasVoted({ me: true }, 'me')).toBe(true);
  });
});

describe('buildKmInfoLabel', () => {
  it('retourne "" si kmDay falsy ou stage null', () => {
    expect(buildKmInfoLabel({ kmDay: 0 })).toBe('');
    expect(buildKmInfoLabel({})).toBe('');
    expect(buildKmInfoLabel(null)).toBe('');
  });
  it('retourne le label km sans élévation', () => {
    expect(buildKmInfoLabel({ kmDay: 42 })).toBe('🚴 42 km');
  });
  it('inclut D+ si elevGain > 0 après clamp', () => {
    expect(buildKmInfoLabel({ kmDay: 42, elevGain: 300 })).toBe('🚴 42 km · ⛰️ D+ 300 m');
  });
  it('omet D+ si elevGain négatif (clamp → 0)', () => {
    expect(buildKmInfoLabel({ kmDay: 42, elevGain: -5 })).toBe('🚴 42 km');
  });
  it('arrondit kmDay', () => {
    expect(buildKmInfoLabel({ kmDay: 42.7 })).toBe('🚴 43 km');
  });
});

describe('formatJournalDateLabel', () => {
  it('contient le jour long et le mois long en fr-FR', () => {
    const label = formatJournalDateLabel('2026-04-20');
    expect(label).toContain('lundi');
    expect(label).toContain('avril');
  });
});
