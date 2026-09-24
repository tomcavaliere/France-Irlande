import { describe, it, expect } from 'vitest';
import JournalCore from '../../js/core/journal-core.js';

const { countBravos, hasVoted, buildKmInfoLabel, formatJournalDateLabel, mergeRemoteWithDrafts } = JournalCore;

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

describe('mergeRemoteWithDrafts', () => {
  it('retourne le snapshot distant tel quel sans brouillon', () => {
    const remote = { '2026-05-01': 'jour 1', '2026-05-02': 'jour 2' };
    expect(mergeRemoteWithDrafts(remote, {}, {})).toEqual(remote);
  });

  it('un brouillon en attente gagne sur la valeur distante', () => {
    const remote = { '2026-05-02': 'ancienne version' };
    const drafts = { '2026-05-02': 'version en cours de frappe' };
    expect(mergeRemoteWithDrafts(remote, drafts, {})).toEqual({ '2026-05-02': 'version en cours de frappe' });
  });

  it('conserve un brouillon pour une date absente du distant', () => {
    expect(mergeRemoteWithDrafts({ a: 'x' }, { b: 'nouveau' }, {})).toEqual({ a: 'x', b: 'nouveau' });
  });

  it('garde un brouillon vide (effacement volontaire)', () => {
    expect(mergeRemoteWithDrafts({ d: 'texte' }, { d: '' }, {})).toEqual({ d: '' });
  });

  it('brouillon non-string : repli sur la valeur locale, sinon chaîne vide', () => {
    expect(mergeRemoteWithDrafts({ d: 'distant' }, { d: undefined }, { d: 'local' })).toEqual({ d: 'local' });
    expect(mergeRemoteWithDrafts({ d: 'distant' }, { d: null }, {})).toEqual({ d: '' });
  });

  it('tolère un snapshot distant null (nœud vide)', () => {
    expect(mergeRemoteWithDrafts(null, { d: 'brouillon' }, null)).toEqual({ d: 'brouillon' });
    expect(mergeRemoteWithDrafts(null, null, null)).toEqual({});
  });

  it('ne mute pas le snapshot distant', () => {
    const remote = { d: 'distant' };
    mergeRemoteWithDrafts(remote, { d: 'brouillon' }, {});
    expect(remote).toEqual({ d: 'distant' });
  });
});
