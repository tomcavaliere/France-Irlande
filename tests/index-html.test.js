// Garde-fous statiques sur index.html (accessibilité, métadonnées PWA).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

describe('index.html', () => {
  it('ne bloque pas le zoom (WCAG 1.4.4)', () => {
    const viewport = indexHtml.match(/<meta name="viewport" content="([^"]+)"/);
    expect(viewport).not.toBeNull();
    expect(viewport[1]).not.toMatch(/user-scalable\s*=\s*(no|0)/);
    expect(viewport[1]).not.toMatch(/maximum-scale\s*=\s*1(\.0)?\b/);
  });
});

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));

/**
 * Dimensions d'un PNG (en-tête IHDR).
 * @param {string} rel
 * @returns {{width:number, height:number}}
 */
function pngSize(rel){
  const buf = fs.readFileSync(path.join(ROOT, rel));
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe('manifest.json', () => {
  it('reste relatif au scope GitHub Pages', () => {
    expect(manifest.start_url).toBe('./');
    expect(manifest.scope).toBe('./');
  });

  it('déclare des icônes PNG 192 et 512 aux bonnes dimensions', () => {
    for (const size of [192, 512]) {
      const icon = manifest.icons.find((i) => i.type === 'image/png' && i.sizes === `${size}x${size}` && i.purpose === 'any');
      expect(icon).toBeDefined();
      expect(pngSize(icon.src)).toEqual({ width: size, height: size });
    }
  });

  it('fournit une icône maskable', () => {
    const icon = manifest.icons.find((i) => i.purpose === 'maskable');
    expect(icon).toBeDefined();
    expect(fs.existsSync(path.join(ROOT, icon.src))).toBe(true);
  });

  it('référence une apple-touch-icon 180×180 depuis index.html', () => {
    const href = indexHtml.match(/<link rel="apple-touch-icon" href="([^"]+)"/);
    expect(href).not.toBeNull();
    expect(pngSize(href[1])).toEqual({ width: 180, height: 180 });
  });
});
