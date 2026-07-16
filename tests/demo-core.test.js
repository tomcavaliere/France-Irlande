import { describe, it, expect } from 'vitest';
import DemoCore from '../js/demo-core.js';

const { pathGet, pathSet, pathRemove, makeSnapshot, isDemoRequested } = DemoCore;

describe('pathGet', () => {
  it('lit une valeur à la racine', () => {
    expect(pathGet({ current: { lat: 53.2 } }, 'current')).toEqual({ lat: 53.2 });
  });
  it('lit un chemin profond a/b/c', () => {
    expect(pathGet({ a: { b: { c: 42 } } }, 'a/b/c')).toBe(42);
  });
  it('retourne undefined pour un chemin absent', () => {
    expect(pathGet({ a: {} }, 'a/b/c')).toBeUndefined();
    expect(pathGet({}, 'x')).toBeUndefined();
  });
  it('tolère les slashes de tête et de queue', () => {
    expect(pathGet({ stages: { d: 1 } }, '/stages/')).toEqual({ d: 1 });
  });
  it('retourne undefined si un intermédiaire est un scalaire', () => {
    expect(pathGet({ a: 5 }, 'a/b')).toBeUndefined();
  });
  it('retourne undefined pour un arbre non-objet ou un path non-string', () => {
    expect(pathGet(null, 'a')).toBeUndefined();
    expect(pathGet({ a: 1 }, null)).toBeUndefined();
  });
});

describe('pathSet', () => {
  it('écrit une valeur à la racine', () => {
    const tree = {};
    pathSet(tree, 'current', { lat: 1 });
    expect(tree.current).toEqual({ lat: 1 });
  });
  it('crée les objets intermédiaires manquants', () => {
    const tree = {};
    pathSet(tree, 'photos/2026-05-01/p1', { url: 'u' });
    expect(tree.photos['2026-05-01'].p1).toEqual({ url: 'u' });
  });
  it('remplace entièrement la valeur existante (sémantique Firebase set)', () => {
    const tree = { a: { b: { x: 1, y: 2 } } };
    pathSet(tree, 'a/b', 7);
    expect(tree.a.b).toBe(7);
  });
  it('écrase un intermédiaire scalaire par un objet si besoin', () => {
    const tree = { a: 5 };
    pathSet(tree, 'a/b', 1);
    expect(tree.a.b).toBe(1);
  });
  it('set null supprime la clé (sémantique Firebase)', () => {
    const tree = { a: { b: 1, c: 2 } };
    pathSet(tree, 'a/b', null);
    expect(tree.a).toEqual({ c: 2 });
  });
  it('conserve les valeurs falsy non-null (0, false, "")', () => {
    const tree = {};
    pathSet(tree, 'a/zero', 0);
    pathSet(tree, 'a/faux', false);
    pathSet(tree, 'a/vide', '');
    expect(tree.a).toEqual({ zero: 0, faux: false, vide: '' });
  });
});

describe('pathRemove', () => {
  it('supprime une feuille', () => {
    const tree = { a: { b: 1, c: 2 } };
    pathRemove(tree, 'a/b');
    expect(tree.a).toEqual({ c: 2 });
  });
  it('nettoie les ancêtres devenus vides', () => {
    const tree = { bravos: { '2026-05-01': { v1: true } }, keep: 1 };
    pathRemove(tree, 'bravos/2026-05-01/v1');
    expect(tree).toEqual({ keep: 1 });
  });
  it('ne nettoie pas les ancêtres encore peuplés', () => {
    const tree = { a: { b: { x: 1 }, c: 2 } };
    pathRemove(tree, 'a/b/x');
    expect(tree).toEqual({ a: { c: 2 } });
  });
  it('est un no-op sur un chemin absent', () => {
    const tree = { a: 1 };
    pathRemove(tree, 'x/y/z');
    expect(tree).toEqual({ a: 1 });
  });
});

describe('makeSnapshot', () => {
  it('val() retourne la valeur et exists() true', () => {
    const snap = makeSnapshot({ lat: 53.2 });
    expect(snap.val()).toEqual({ lat: 53.2 });
    expect(snap.exists()).toBe(true);
  });
  it('null et undefined → val() null, exists() false', () => {
    expect(makeSnapshot(null).val()).toBeNull();
    expect(makeSnapshot(null).exists()).toBe(false);
    expect(makeSnapshot(undefined).val()).toBeNull();
    expect(makeSnapshot(undefined).exists()).toBe(false);
  });
  it('val() retourne un clone indépendant de la source', () => {
    const source = { stages: { d1: { published: true } } };
    const out = makeSnapshot(source).val();
    out.stages.d1.published = false;
    expect(source.stages.d1.published).toBe(true);
  });
  it('chaque appel à val() retourne un clone distinct', () => {
    const snap = makeSnapshot({ n: 1 });
    expect(snap.val()).not.toBe(snap.val());
  });
  it('les valeurs falsy non-null existent (0, false, "")', () => {
    expect(makeSnapshot(0).exists()).toBe(true);
    expect(makeSnapshot(false).exists()).toBe(true);
    expect(makeSnapshot('').exists()).toBe(true);
    expect(makeSnapshot(0).val()).toBe(0);
  });
});

describe('isDemoRequested', () => {
  it('hash #demo → true', () => {
    expect(isDemoRequested('#demo', null)).toBe(true);
  });
  it('flag localStorage "1" → true', () => {
    expect(isDemoRequested('', '1')).toBe(true);
  });
  it('ni hash ni flag → false', () => {
    expect(isDemoRequested('', null)).toBe(false);
    expect(isDemoRequested('#autre', '0')).toBe(false);
    expect(isDemoRequested('#Demo', '')).toBe(false);
  });
  it('tolère les entrées non-string', () => {
    expect(isDemoRequested(undefined, undefined)).toBe(false);
    expect(isDemoRequested(null, 1)).toBe(false);
  });
});
