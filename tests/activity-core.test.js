import { describe, it, expect } from 'vitest';
import ActivityCore from '../js/activity-core.js';
import Utils from '../js/utils.js';

const {
  safeString, normalizeType, normalizeEntry, typeLabel, shouldIgnoreEntry,
  prepareEntries, summarize, lastDaysSeries, topUsers
} = ActivityCore;

// Horloge fixe : 20 mai 2026, 15h locale.
const NOW = new Date(2026, 4, 20, 15, 0).getTime();
const at = (day, hour = 10) => new Date(2026, 4, day, hour, 0).getTime();

describe('safeString', () => {
  it('trim, repli si vide, tronque', () => {
    expect(safeString('  Marie  ', 60)).toBe('Marie');
    expect(safeString('   ', 60, 'Inconnu')).toBe('Inconnu');
    expect(safeString(42, 60, 'x')).toBe('x');
    expect(safeString('abcdef', 3)).toBe('abc');
  });
});

describe('normalizeType / typeLabel', () => {
  it('garde les types connus, sinon other', () => {
    expect(normalizeType('visitor_login')).toBe('visitor_login');
    expect(normalizeType('hack')).toBe('other');
    expect(normalizeType(undefined)).toBe('other');
  });
  it('libellés français', () => {
    expect(typeLabel('admin_login')).toBe('Connexion admin');
    expect(typeLabel('visitor_login')).toBe('Connexion visiteur');
    expect(typeLabel('visitor_suspicious')).toBe('Alerte suspecte');
    expect(typeLabel('other')).toBe('Événement');
  });
});

describe('normalizeEntry', () => {
  it('normalise un événement valide', () => {
    expect(normalizeEntry({ type: 'visitor_login', name: ' Jean ', ts: 123 }))
      .toEqual({ type: 'visitor_login', name: 'Jean', ts: 123 });
  });
  it('ts invalide → 0, nom vide → Inconnu, entrée non-objet tolérée', () => {
    expect(normalizeEntry({ type: 'x', name: '', ts: 'abc' })).toEqual({ type: 'other', name: 'Inconnu', ts: 0 });
    expect(normalizeEntry(null)).toEqual({ type: 'other', name: 'Inconnu', ts: 0 });
  });
});

describe('shouldIgnoreEntry', () => {
  it('ignore les connexions admin et celles des voyageurs', () => {
    expect(shouldIgnoreEntry({ type: 'admin_login', name: 'x' })).toBe(true);
    expect(shouldIgnoreEntry({ type: 'visitor_login', name: 'Tom' })).toBe(true);
    expect(shouldIgnoreEntry({ type: 'visitor_login', name: ' chloe ' })).toBe(true);
  });
  it('ignore les voyageurs quelle que soit la casse ou les accents', () => {
    expect(shouldIgnoreEntry({ type: 'visitor_login', name: 'Chloé' })).toBe(true);
    expect(shouldIgnoreEntry({ type: 'visitor_login', name: 'CHLOÉ' })).toBe(true);
    expect(shouldIgnoreEntry({ type: 'visitor_login', name: 'TOM' })).toBe(true);
  });
  it('garde les autres visiteurs et les alertes', () => {
    expect(shouldIgnoreEntry({ type: 'visitor_login', name: 'Marie' })).toBe(false);
    expect(shouldIgnoreEntry({ type: 'visitor_suspicious', name: 'Tom' })).toBe(false);
    expect(shouldIgnoreEntry(null)).toBe(false);
  });
});

describe('prepareEntries', () => {
  it('normalise, filtre ts invalides et ignorés, trie du plus récent au plus ancien', () => {
    const tree = {
      a: { type: 'visitor_login', name: 'Marie', ts: at(18) },
      b: { type: 'visitor_login', name: 'Paul', ts: at(19) },
      c: { type: 'admin_login', name: 'tom@x.fr', ts: at(19, 12) },
      d: { type: 'visitor_login', name: 'Sans date' },
      e: { type: 'visitor_suspicious', name: 'Alerte 4 essais', ts: at(17) }
    };
    expect(prepareEntries(tree).map((e) => e.name)).toEqual(['Paul', 'Marie', 'Alerte 4 essais']);
  });
  it('tolère un arbre vide ou null', () => {
    expect(prepareEntries(null)).toEqual([]);
  });
});

describe('summarize', () => {
  it('compte total, visiteurs, alertes et noms uniques', () => {
    const entries = [
      { type: 'visitor_login', name: 'Marie' },
      { type: 'visitor_login', name: 'Marie' },
      { type: 'visitor_login', name: 'Paul' },
      { type: 'visitor_suspicious', name: 'Alerte' }
    ];
    expect(summarize(entries)).toEqual({ total: 4, visitors: 3, suspicious: 1, uniqueUsers: 3 });
  });
});

describe('lastDaysSeries', () => {
  it('compte par jour local sur les N derniers jours, du plus ancien au plus récent', () => {
    const entries = [{ ts: at(20, 1) }, { ts: at(20, 23) }, { ts: at(18) }, { ts: at(10) }];
    expect(lastDaysSeries(entries, 3, Utils.localISODate, NOW)).toEqual([
      { date: '2026-05-18', count: 1 },
      { date: '2026-05-19', count: 0 },
      { date: '2026-05-20', count: 2 }
    ]);
  });
  it('7 jours par défaut, ts invalides ignorés', () => {
    const series = lastDaysSeries([{ ts: 0 }, { ts: NaN }], 0, Utils.localISODate, NOW);
    expect(series).toHaveLength(7);
    expect(series[0].date).toBe('2026-05-14');
    expect(series[6].date).toBe('2026-05-20');
    expect(series.every((d) => d.count === 0)).toBe(true);
  });
});

describe('topUsers', () => {
  it('trie par nombre décroissant puis ordre alphabétique, borne le nombre', () => {
    const entries = [
      { name: 'Paul' }, { name: 'Marie' }, { name: 'Paul' }, { name: 'Anne' }, { name: 'Marie' }, { name: 'Zoé' }
    ];
    expect(topUsers(entries, 3)).toEqual([
      { name: 'Marie', count: 2 },
      { name: 'Paul', count: 2 },
      { name: 'Anne', count: 1 }
    ]);
  });
});
