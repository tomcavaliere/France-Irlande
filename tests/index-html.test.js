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
