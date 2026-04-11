import { describe, it, expect } from 'vitest';
import offlineCore from '../js/offline-core.js';

const { upsertBoundedIndex, trimQueue, hydrateComments } = offlineCore;

describe('upsertBoundedIndex', () => {
  it('insère une nouvelle clé', () => {
    const r = upsertBoundedIndex(['2026-01-01'], '2026-01-02', 50);
    expect(r.index).toEqual(['2026-01-01', '2026-01-02']);
    expect(r.evicted).toEqual([]);
  });

  it('ne duplique pas une clé existante', () => {
    const r = upsertBoundedIndex(['2026-01-01'], '2026-01-01', 50);
    expect(r.index).toEqual(['2026-01-01']);
    expect(r.evicted).toEqual([]);
  });

  it('éviction FIFO quand la taille max est dépassée', () => {
    const r = upsertBoundedIndex(['a', 'b', 'c'], 'd', 3);
    expect(r.index).toEqual(['b', 'c', 'd']);
    expect(r.evicted).toEqual(['a']);
  });

  it('ignore une clé invalide', () => {
    const r = upsertBoundedIndex(['a'], '', 3);
    expect(r.index).toEqual(['a']);
    expect(r.evicted).toEqual([]);
  });
});

describe('trimQueue', () => {
  it('retourne la queue inchangée si <= max', () => {
    expect(trimQueue([1, 2], 3)).toEqual([1, 2]);
  });

  it('conserve uniquement les derniers éléments si > max', () => {
    expect(trimQueue([1, 2, 3, 4], 2)).toEqual([3, 4]);
  });

  it('gère une entrée invalide', () => {
    expect(trimQueue(null, 2)).toEqual([]);
  });
});

describe('hydrateComments', () => {
  it('hydrate les dates absentes depuis le cache', () => {
    const r = hydrateComments(
      ['2026-05-01', '2026-05-02'],
      { '2026-05-01': { a: 1 }, '2026-05-02': { b: 2 } },
      {}
    );
    expect(r['2026-05-01']).toEqual({ a: 1 });
    expect(r['2026-05-02']).toEqual({ b: 2 });
  });

  it('n’écrase pas un état déjà présent', () => {
    const r = hydrateComments(
      ['2026-05-01'],
      { '2026-05-01': { a: 1 } },
      { '2026-05-01': { keep: true } }
    );
    expect(r['2026-05-01']).toEqual({ keep: true });
  });

  it('ignore les entrées corrompues/non-objet', () => {
    const r = hydrateComments(['2026-05-01'], { '2026-05-01': 'broken' }, {});
    expect(r).toEqual({});
  });
});
