// Garde-fou : la liste PRECACHE de sw.js doit couvrir tous les assets locaux
// chargés par index.html, avec des chemins relatifs au scope du SW
// (le site est servi sous /France-Irlande/ sur GitHub Pages).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const swSource = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

/**
 * Extrait la liste PRECACHE du source de sw.js.
 * @returns {string[]}
 */
function readPrecache(){
  const match = swSource.match(/const PRECACHE = \[([\s\S]*?)\];/);
  if (!match) throw new Error('PRECACHE introuvable dans sw.js');
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

/**
 * Assets locaux référencés par index.html (scripts, feuilles de style, manifest).
 * @returns {string[]}
 */
function readLocalAssets(){
  const refs = [
    ...[...indexHtml.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]),
    ...[...indexHtml.matchAll(/<link[^>]*\shref="([^"]+)"/g)].map((m) => m[1]),
  ];
  return refs.filter((ref) => !/^https?:\/\//.test(ref));
}

const precache = readPrecache();

describe('sw.js PRECACHE', () => {
  it('uses only relative or absolute-URL entries (no root-absolute paths)', () => {
    const rootAbsolute = precache.filter((p) => p.startsWith('/'));
    expect(rootAbsolute).toEqual([]);
  });

  it('includes the app shell entry points', () => {
    expect(precache).toContain('./');
    expect(precache).toContain('./index.html');
  });

  it('covers every local asset referenced by index.html', () => {
    const missing = readLocalAssets()
      .map((ref) => './' + ref.replace(/^\.\//, ''))
      .filter((ref) => !precache.includes(ref));
    expect(missing).toEqual([]);
  });

  it('only lists local files that exist on disk', () => {
    const absent = precache
      .filter((p) => p.startsWith('./') && p !== './')
      .filter((p) => !fs.existsSync(path.join(ROOT, p)));
    expect(absent).toEqual([]);
  });

  it('has no duplicate entries', () => {
    expect(new Set(precache).size).toBe(precache.length);
  });
});
