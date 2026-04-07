// Tests unitaires pour js/utils.js
import { describe, it, expect } from 'vitest';
import utils from '../js/utils.js';

const { escAttr, escHtml, formatTime, summarizeExpenses } = utils;

describe('escAttr', () => {
  it('échappe les guillemets, apostrophes et &', () => {
    expect(escAttr('a & b')).toBe('a &amp; b');
    expect(escAttr('"hi"')).toBe('&quot;hi&quot;');
    expect(escAttr("it's")).toBe('it&#39;s');
  });

  it('protège contre une injection dans un attribut onclick', () => {
    const evil = `'); alert('xss`;
    const out = escAttr(evil);
    expect(out).not.toContain("'");
    expect(out).toContain('&#39;');
  });

  it('coerce les valeurs non-string', () => {
    expect(escAttr(42)).toBe('42');
    expect(escAttr(null)).toBe('null');
  });
});

describe('escHtml', () => {
  it('échappe < et > pour empêcher l\'injection de balises', () => {
    expect(escHtml('<script>alert(1)</script>'))
      .toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('échappe & et "', () => {
    expect(escHtml('Tom & "Jerry"')).toBe('Tom &amp; &quot;Jerry&quot;');
  });

  it('laisse passer le texte ordinaire intact', () => {
    expect(escHtml('Bonjour Cork !')).toBe('Bonjour Cork !');
  });
});

describe('formatTime', () => {
  it('formate un timestamp connu en français', () => {
    // 2026-04-07 14:30 UTC — on teste juste la structure car le résultat
    // dépend du fuseau horaire de la machine.
    const out = formatTime(new Date('2026-04-07T14:30:00').getTime());
    expect(out).toMatch(/à \d{2}:\d{2}$/);
    expect(out).toMatch(/avr/);
  });

  it('accepte un objet Date converti en number', () => {
    const ts = new Date('2026-01-15T10:00:00').getTime();
    expect(typeof formatTime(ts)).toBe('string');
  });
});

describe('summarizeExpenses', () => {
  const sample = {
    e1: { amount: 12.5, cat: 'Nourriture',  date: '2026-04-01', desc: 'Pain' },
    e2: { amount: 35,   cat: 'Hébergement', date: '2026-04-01', desc: 'Camping' },
    e3: { amount: 8,    cat: 'Nourriture',  date: '2026-04-02', desc: 'Café' },
    e4: { amount: 4.5,  cat: 'Transport',   date: '2026-04-02', desc: 'Bus' }
  };

  it('calcule le total exact', () => {
    expect(summarizeExpenses(sample).total).toBeCloseTo(60, 5);
  });

  it('compte les jours distincts', () => {
    expect(summarizeExpenses(sample).days).toBe(2);
  });

  it('calcule la moyenne par jour', () => {
    expect(summarizeExpenses(sample).perDay).toBeCloseTo(30, 5);
  });

  it('agrège correctement par catégorie', () => {
    const r = summarizeExpenses(sample);
    expect(r.byCat.Nourriture).toBeCloseTo(20.5, 5);
    expect(r.byCat['Hébergement']).toBe(35);
    expect(r.byCat.Transport).toBe(4.5);
  });

  it('regroupe par date', () => {
    const r = summarizeExpenses(sample);
    expect(r.byDate['2026-04-01']).toHaveLength(2);
    expect(r.byDate['2026-04-02']).toHaveLength(2);
  });

  it('cas vide : ne crashe pas et days=1 (évite la division par zéro)', () => {
    const r = summarizeExpenses({});
    expect(r.total).toBe(0);
    expect(r.days).toBe(1);
    expect(r.perDay).toBe(0);
  });

  it('valeurs amount non-numériques traitées comme 0', () => {
    const r = summarizeExpenses({
      e1: { amount: 10, cat: 'Autre', date: '2026-04-01' },
      e2: { amount: 'oops', cat: 'Autre', date: '2026-04-01' }
    });
    expect(r.total).toBe(10);
  });
});
