import { describe, it, expect } from 'vitest';
import VisitorAuthCore from '../js/visitor-auth-core.js';

const { normalizeHash, extractPasswordHash, validatePasswordChange } = VisitorAuthCore;

// 64-character valid hex string used throughout
const VALID = 'a'.repeat(64);

describe('normalizeHash', () => {
  it('accepte un hash 64 hex lowercase et le retourne tel quel', () => {
    expect(normalizeHash(VALID)).toBe(VALID);
  });
  it('normalise en lowercase', () => {
    expect(normalizeHash('A'.repeat(64))).toBe(VALID);
  });
  it('trim les espaces avant validation', () => {
    expect(normalizeHash(' ' + VALID + ' ')).toBe(VALID);
  });
  it('retourne "" pour une longueur incorrecte (63 ou 65 chars)', () => {
    expect(normalizeHash('a'.repeat(63))).toBe('');
    expect(normalizeHash('a'.repeat(65))).toBe('');
  });
  it('retourne "" si le hash contient un caractère non-hex ("g")', () => {
    expect(normalizeHash('g' + 'a'.repeat(63))).toBe('');
  });
  it('retourne "" pour null, undefined, number, object', () => {
    expect(normalizeHash(null)).toBe('');
    expect(normalizeHash(undefined)).toBe('');
    expect(normalizeHash(42)).toBe('');
    expect(normalizeHash({})).toBe('');
  });
});

describe('extractPasswordHash', () => {
  it('retourne "" pour null ou undefined', () => {
    expect(extractPasswordHash(null)).toBe('');
    expect(extractPasswordHash(undefined)).toBe('');
  });
  it('retourne le hash normalisé pour une string valide', () => {
    expect(extractPasswordHash(VALID)).toBe(VALID);
  });
  it('retourne le hash normalisé pour un objet avec passwordHash valide', () => {
    expect(extractPasswordHash({ passwordHash: VALID })).toBe(VALID);
    expect(extractPasswordHash({ passwordHash: 'A'.repeat(64) })).toBe(VALID);
  });
  it('retourne "" pour un objet avec passwordHash invalide ou absent', () => {
    expect(extractPasswordHash({ passwordHash: 'bad' })).toBe('');
    expect(extractPasswordHash({})).toBe('');
  });
});

describe('validatePasswordChange', () => {
  const opts = { min: 6, max: 128 };

  it('retourne {ok:true} pour un mot de passe valide', () => {
    expect(validatePasswordChange('abcdef', 'abcdef', opts)).toEqual({ ok: true });
  });
  it('retourne {ok:false} avec message "trop court" si longueur < min', () => {
    const r = validatePasswordChange('abc', 'abc', opts);
    expect(r.ok).toBe(false);
    expect(r.error).toContain('trop court');
    expect(r.error).toContain('6');
  });
  it('retourne {ok:false} avec message "trop long" si longueur > max', () => {
    const r = validatePasswordChange('a'.repeat(129), 'a'.repeat(129), opts);
    expect(r.ok).toBe(false);
    expect(r.error).toContain('trop long');
    expect(r.error).toContain('128');
  });
  it('retourne {ok:false} avec message "ne correspondent pas" si passwords différents', () => {
    const r = validatePasswordChange('abcdef', 'abcdeg', opts);
    expect(r.ok).toBe(false);
    expect(r.error).toContain('ne correspondent pas');
  });
});
