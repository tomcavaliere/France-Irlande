// Tests de la façade js/services/db.js avec des globales window._fb* simulées
// (aucun appel Firebase réel).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Db from '../js/services/db.js';

function installFakeFirebase(){
  const fake = {
    _fbDb: { fake: true },
    _fbRef: vi.fn((db, path) => ({ db, path })),
    _fbSet: vi.fn(() => Promise.resolve()),
    _fbRemove: vi.fn(() => Promise.resolve()),
    _fbGet: vi.fn(() => Promise.resolve({ val: () => 42, exists: () => true })),
    _fbOnValue: vi.fn(() => () => {}),
  };
  globalThis.window = fake;
  return fake;
}

describe('Db (Firebase disponible)', () => {
  let fb;
  beforeEach(() => { fb = installFakeFirebase(); });
  afterEach(() => { delete globalThis.window; });

  it('ready() est vrai', () => {
    expect(Db.ready()).toBe(true);
  });

  it('set() construit la ref et délègue à _fbSet', async () => {
    await Db.set('stages/2026-05-02/published', true);
    expect(fb._fbRef).toHaveBeenCalledWith(fb._fbDb, 'stages/2026-05-02/published');
    expect(fb._fbSet).toHaveBeenCalledWith({ db: fb._fbDb, path: 'stages/2026-05-02/published' }, true);
  });

  it('remove() délègue à _fbRemove', async () => {
    await Db.remove('journals/2026-05-02');
    expect(fb._fbRemove).toHaveBeenCalledWith({ db: fb._fbDb, path: 'journals/2026-05-02' });
  });

  it('get() retourne le snapshot', async () => {
    const snap = await Db.get('current');
    expect(snap.val()).toBe(42);
  });

  it('on() transmet le callback d’erreur seulement s’il est fourni', () => {
    const cb = () => {};
    const onErr = () => {};
    Db.on('tracks', cb);
    expect(fb._fbOnValue).toHaveBeenLastCalledWith({ db: fb._fbDb, path: 'tracks' }, cb);
    Db.on('journals', cb, onErr);
    expect(fb._fbOnValue).toHaveBeenLastCalledWith({ db: fb._fbDb, path: 'journals' }, cb, onErr);
  });

  it('propage le rejet de Firebase à l’appelant', async () => {
    fb._fbSet.mockReturnValueOnce(Promise.reject(new Error('PERMISSION_DENIED')));
    await expect(Db.set('comments/x/y', {})).rejects.toThrow('PERMISSION_DENIED');
  });
});

describe('Db (Firebase non chargé)', () => {
  let errSpy;
  beforeEach(() => {
    globalThis.window = {};
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    delete globalThis.window;
    errSpy.mockRestore();
  });

  it('ready() est faux', () => {
    expect(Db.ready()).toBe(false);
  });

  it('set/remove/get rejettent au lieu de lever un TypeError', async () => {
    await expect(Db.set('current', {})).rejects.toThrow('Firebase indisponible');
    await expect(Db.remove('current')).rejects.toThrow('Firebase indisponible');
    await expect(Db.get('current')).rejects.toThrow('Firebase indisponible');
    expect(errSpy).toHaveBeenCalledWith('[db] set current', expect.any(Error));
  });

  it('on() retourne un désabonnement no-op', () => {
    const unsub = Db.on('current', () => {});
    expect(typeof unsub).toBe('function');
    expect(() => unsub()).not.toThrow();
  });
});
