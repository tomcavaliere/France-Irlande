// Tests unitaires pour js/utils.js
import { describe, it, expect, vi } from 'vitest';
import utils from '../js/utils.js';

const {
  escAttr, escHtml, formatTime, summarizeExpenses,
  validateComment, validateExpense, validateJournal,
  EXPENSE_CATEGORIES, LIMITS,
  computeQuotaBytes, formatBytes, quotaLevel, RTDB_QUOTA_BYTES,
  safeFetch, computeKmDay, filterTracksByStages, isOfflineable: _isOfflineable, actionLabel: _actionLabel, filterVisibleJournalDates: _filterVisibleJournalDates,
  COMMENT_COOLDOWN_MS, isCommentOnCooldown, commentCooldownRemaining
} = utils;

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

describe('validateComment', () => {
  it('accepte un commentaire standard', () => {
    expect(validateComment({ name: 'Maman', text: 'Courage !' }))
      .toEqual({ ok: true });
  });

  it('rejette un name vide ou absent', () => {
    expect(validateComment({ name: '', text: 'ok' }).ok).toBe(false);
    expect(validateComment({ name: '   ', text: 'ok' }).ok).toBe(false);
    expect(validateComment({ text: 'ok' }).ok).toBe(false);
  });

  it('rejette un text vide ou absent', () => {
    expect(validateComment({ name: 'Tom', text: '' }).ok).toBe(false);
    expect(validateComment({ name: 'Tom', text: '   ' }).ok).toBe(false);
    expect(validateComment({ name: 'Tom' }).ok).toBe(false);
  });

  it('rejette un name > 30 caractères', () => {
    const longName = 'a'.repeat(31);
    const r = validateComment({ name: longName, text: 'hi' });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/30/);
  });

  it('accepte un name pile à 30 caractères', () => {
    expect(validateComment({ name: 'a'.repeat(30), text: 'hi' }).ok).toBe(true);
  });

  it('rejette un text > 500 caractères', () => {
    const r = validateComment({ name: 'Tom', text: 'a'.repeat(501) });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/500/);
  });

  it('accepte un text pile à 500 caractères', () => {
    expect(validateComment({ name: 'Tom', text: 'a'.repeat(500) }).ok).toBe(true);
  });

  it('rejette les inputs non-objets', () => {
    expect(validateComment(null).ok).toBe(false);
    expect(validateComment(undefined).ok).toBe(false);
    expect(validateComment('string').ok).toBe(false);
  });

  it('trim les espaces sur name/text avant validation', () => {
    expect(validateComment({ name: '  Tom  ', text: '  Bravo !  ' }).ok).toBe(true);
  });

  it('rejette les types inattendus (name non-string)', () => {
    const r = validateComment({ name: 123, text: 'ok' });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('nom');
  });
});

describe('validateExpense', () => {
  const valid = { amount: 12.5, cat: 'Nourriture', date: '2026-04-15', desc: 'Pain' };

  it('accepte une dépense standard', () => {
    expect(validateExpense(valid)).toEqual({ ok: true });
  });

  it('accepte desc absent (optionnel)', () => {
    const { desc: _desc, ...rest } = valid;
    expect(validateExpense(rest).ok).toBe(true);
  });

  it('rejette amount <= 0', () => {
    expect(validateExpense({ ...valid, amount: 0 }).ok).toBe(false);
    expect(validateExpense({ ...valid, amount: -5 }).ok).toBe(false);
  });

  it('rejette amount >= 10000', () => {
    expect(validateExpense({ ...valid, amount: 10000 }).ok).toBe(false);
    expect(validateExpense({ ...valid, amount: 99999 }).ok).toBe(false);
  });

  it('accepte amount juste en dessous de 10000', () => {
    expect(validateExpense({ ...valid, amount: 9999.99 }).ok).toBe(true);
  });

  it('rejette amount non numérique', () => {
    expect(validateExpense({ ...valid, amount: 'abc' }).ok).toBe(false);
    expect(validateExpense({ ...valid, amount: NaN }).ok).toBe(false);
    expect(validateExpense({ ...valid, amount: Infinity }).ok).toBe(false);
  });

  it('rejette une catégorie hors liste fermée', () => {
    expect(validateExpense({ ...valid, cat: 'Gadgets' }).ok).toBe(false);
    expect(validateExpense({ ...valid, cat: '' }).ok).toBe(false);
    expect(validateExpense({ ...valid, cat: undefined }).ok).toBe(false);
  });

  it('accepte toutes les catégories valides', () => {
    EXPENSE_CATEGORIES.forEach(cat => {
      expect(validateExpense({ ...valid, cat }).ok).toBe(true);
    });
  });

  it('rejette une date au mauvais format', () => {
    expect(validateExpense({ ...valid, date: '15/04/2026' }).ok).toBe(false);
    expect(validateExpense({ ...valid, date: '2026-4-15' }).ok).toBe(false);
    expect(validateExpense({ ...valid, date: '' }).ok).toBe(false);
    expect(validateExpense({ ...valid, date: undefined }).ok).toBe(false);
  });

  it('rejette desc > 100 caractères', () => {
    const r = validateExpense({ ...valid, desc: 'a'.repeat(101) });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/100/);
  });

  it('accepte desc pile à 100 caractères', () => {
    expect(validateExpense({ ...valid, desc: 'a'.repeat(100) }).ok).toBe(true);
  });

  it('rejette les inputs non-objets', () => {
    expect(validateExpense(null).ok).toBe(false);
    expect(validateExpense(undefined).ok).toBe(false);
  });

  it('accepte amount numérique en string', () => {
    expect(validateExpense({ ...valid, amount: '12.5' }).ok).toBe(true);
  });

  it('rejette cat avec espaces non exacts (liste fermée stricte)', () => {
    expect(validateExpense({ ...valid, cat: ' Hébergement ' }).ok).toBe(false);
  });

  it('rejette date avec espaces même si visuellement ISO', () => {
    expect(validateExpense({ ...valid, date: ' 2026-05-01 ' }).ok).toBe(false);
  });
});

describe('validateJournal', () => {
  it('accepte un texte court', () => {
    expect(validateJournal('Super journée !')).toEqual({ ok: true });
  });

  it('accepte une chaîne vide (effacement)', () => {
    expect(validateJournal('').ok).toBe(true);
  });

  it('accepte null/undefined', () => {
    expect(validateJournal(null).ok).toBe(true);
    expect(validateJournal(undefined).ok).toBe(true);
  });

  it('rejette un texte > 5000 caractères', () => {
    const r = validateJournal('a'.repeat(5001));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/5000/);
  });

  it('accepte un texte pile à 5000 caractères', () => {
    expect(validateJournal('a'.repeat(5000)).ok).toBe(true);
  });

  it('rejette les types non-string', () => {
    expect(validateJournal(42).ok).toBe(false);
    expect(validateJournal({}).ok).toBe(false);
  });
});

describe('LIMITS et EXPENSE_CATEGORIES exportés', () => {
  it('expose les limites partagées', () => {
    expect(LIMITS.COMMENT_NAME).toBe(30);
    expect(LIMITS.COMMENT_TEXT).toBe(500);
    expect(LIMITS.EXPENSE_DESC).toBe(100);
    expect(LIMITS.EXPENSE_MAX_AMOUNT).toBe(10000);
    expect(LIMITS.JOURNAL_TEXT).toBe(5000);
  });

  it('expose la liste fermée des catégories', () => {
    expect(EXPENSE_CATEGORIES).toContain('Hébergement');
    expect(EXPENSE_CATEGORIES).toContain('Nourriture');
    expect(EXPENSE_CATEGORIES).toContain('Transport');
    expect(EXPENSE_CATEGORIES).toContain('Équipement');
    expect(EXPENSE_CATEGORIES).toContain('Loisirs');
    expect(EXPENSE_CATEGORIES).toContain('Autre');
    expect(EXPENSE_CATEGORIES).toHaveLength(6);
  });
});

describe('computeQuotaBytes', () => {
  it('retourne 0 pour une entrée vide ou invalide', () => {
    expect(computeQuotaBytes(null)).toEqual({ count: 0, bytes: 0 });
    expect(computeQuotaBytes({})).toEqual({ count: 0, bytes: 0 });
    expect(computeQuotaBytes('nope')).toEqual({ count: 0, bytes: 0 });
  });

  it('compte les photos et estime les octets décodés (length * 0.75)', () => {
    const photos = {
      0: { p1: 'AAAA', p2: 'BBBBBBBB' }, // 4 + 8 = 12 chars → 9 bytes
      1: { p3: 'CCCCCCCCCCCC' }           // 12 chars → 9 bytes
    };
    const r = computeQuotaBytes(photos);
    expect(r.count).toBe(3);
    expect(r.bytes).toBe(18);
  });

  it('ignore le préfixe data:image/...;base64,', () => {
    const photos = { 0: { p1: 'data:image/jpeg;base64,AAAAAAAA' } }; // 8 chars après virgule
    expect(computeQuotaBytes(photos).bytes).toBe(6);
  });

  it('ignore les valeurs non-string', () => {
    const photos = { 0: { p1: 'AAAA', p2: 42, p3: null } };
    const r = computeQuotaBytes(photos);
    expect(r.count).toBe(1);
    expect(r.bytes).toBe(3);
  });
});

describe('formatBytes', () => {
  it('formate en B, KB, MB, GB', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(formatBytes(2 * 1024 * 1024 * 1024)).toBe('2.00 GB');
  });

  it('gère les valeurs invalides', () => {
    expect(formatBytes(-1)).toBe('0 B');
    expect(formatBytes(NaN)).toBe('0 B');
  });
});

describe('quotaLevel', () => {
  const Q = RTDB_QUOTA_BYTES;
  it('retourne les bons seuils', () => {
    expect(quotaLevel(0)).toBe('ok');
    expect(quotaLevel(Q * 0.5)).toBe('ok');
    expect(quotaLevel(Q * 0.70)).toBe('warn');
    expect(quotaLevel(Q * 0.84)).toBe('warn');
    expect(quotaLevel(Q * 0.85)).toBe('high');
    expect(quotaLevel(Q * 0.89)).toBe('high');
    expect(quotaLevel(Q * 0.90)).toBe('block');
    expect(quotaLevel(Q)).toBe('block');
  });

  it('accepte un quota custom', () => {
    expect(quotaLevel(95, 100)).toBe('block');
    expect(quotaLevel(60, 100)).toBe('ok');
  });
});

describe('safeFetch', () => {
  it('résout dès le premier succès', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const r = await safeFetch('u', {}, { fetch: fetchMock, retries: 2, backoff: 0 });
    expect(r.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('réessaie après une erreur réseau puis résout', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('net'))
      .mockResolvedValueOnce({ ok: true, status: 200 });
    const r = await safeFetch('u', {}, { fetch: fetchMock, retries: 2, backoff: 0 });
    expect(r.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejette après épuisement des retries', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('net down'));
    await expect(
      safeFetch('u', {}, { fetch: fetchMock, retries: 2, backoff: 0 })
    ).rejects.toThrow('net down');
    expect(fetchMock).toHaveBeenCalledTimes(3); // 1 + 2 retries
  });

  it('rejette sur statut HTTP non-ok avec .status', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    try {
      await safeFetch('u', {}, { fetch: fetchMock, retries: 0, backoff: 0 });
      throw new Error('devrait rejeter');
    } catch (err) {
      expect(err.message).toBe('HTTP 500');
      expect(err.status).toBe(500);
    }
  });

  it('appelle onError entre les retries', async () => {
    const onError = vi.fn();
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('fail1'))
      .mockResolvedValueOnce({ ok: true, status: 200 });
    await safeFetch('u', {}, { fetch: fetchMock, retries: 2, backoff: 0, onError });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].message).toBe('fail1');
    expect(onError.mock.calls[0][1]).toBe(1);
  });

  it('rejette proprement si fetch est indisponible', async () => {
    await expect(
      safeFetch('u', {}, { fetch: null, retries: 0 })
    ).rejects.toThrow('fetch indisponible');
  });

  it('abort sur timeout', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((url, opts) => new Promise((resolve, reject) => {
      opts.signal.addEventListener('abort', () => reject(new Error('aborted')));
    }));
    const p = safeFetch('u', {}, { fetch: fetchMock, retries: 0, timeout: 50 });
    p.catch(() => {});
    await vi.advanceTimersByTimeAsync(60);
    await expect(p).rejects.toThrow('aborted');
    vi.useRealTimers();
  });

  it('respecte le backoff exponentiel exact entre retries', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockRejectedValue(new Error('net'));
    const p = safeFetch('u', {}, { fetch: fetchMock, retries: 2, backoff: 100 });
    const assertReject = expect(p).rejects.toThrow('net');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(99);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(199);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await assertReject;
    vi.useRealTimers();
  });

  it('ignore une erreur levée par onError', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('fail1'))
      .mockResolvedValueOnce({ ok: true, status: 200 });
    const onError = vi.fn(() => { throw new Error('callback boom'); });
    const r = await safeFetch('u', {}, { fetch: fetchMock, retries: 1, backoff: 0, onError });
    expect(r.ok).toBe(true);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('préserve un signal fourni par l’appelant', async () => {
    const ctrl = new AbortController();
    const fetchMock = vi.fn((url, opts) => {
      expect(opts.signal).toBe(ctrl.signal);
      return Promise.resolve({ ok: true, status: 200 });
    });
    const r = await safeFetch('u', { signal: ctrl.signal }, { fetch: fetchMock, retries: 0, timeout: 1 });
    expect(r.ok).toBe(true);
  });
});

describe('computeKmDay', () => {
  it('retourne kmTotal arrondi si aucune étape antérieure', () => {
    expect(computeKmDay(182.7, {}, '2026-05-03')).toBe(183);
  });

  it('calcule la différence avec la veille', () => {
    const stages = { '2026-05-01': { kmTotal: 100 } };
    expect(computeKmDay(180, stages, '2026-05-02')).toBe(80);
  });

  it('prend la plus récente étape < today (pas forcément la veille)', () => {
    const stages = {
      '2026-04-28': { kmTotal: 50 },
      '2026-04-30': { kmTotal: 120 }
    };
    expect(computeKmDay(200, stages, '2026-05-02')).toBe(80);
  });

  it('retourne 0 si kmTotal < prevKm (reset GPS)', () => {
    const stages = { '2026-05-01': { kmTotal: 200 } };
    expect(computeKmDay(150, stages, '2026-05-02')).toBe(0);
  });

  it('retourne kmTotal arrondi si stages null/undefined', () => {
    expect(computeKmDay(42.3, null, '2026-05-01')).toBe(42);
    expect(computeKmDay(42.3, undefined, '2026-05-01')).toBe(42);
  });

  it('ignore les étapes du jour même', () => {
    const stages = {
      '2026-05-01': { kmTotal: 100 },
      '2026-05-02': { kmTotal: 150 }
    };
    expect(computeKmDay(180, stages, '2026-05-02')).toBe(80);
  });
});

describe('filterTracksByStages', () => {
  it('returns empty object when tracks is invalid', () => {
    expect(filterTracksByStages(null, {})).toEqual({});
    expect(filterTracksByStages(undefined, {})).toEqual({});
    expect(filterTracksByStages('nope', {})).toEqual({});
  });

  it('returns tracks unchanged when stages is invalid or missing', () => {
    const t = { '2026-05-01': { kmDay: 10 } };
    expect(filterTracksByStages(t, null)).toBe(t);
    expect(filterTracksByStages(t, undefined)).toBe(t);
    expect(filterTracksByStages(t, 'nope')).toBe(t);
  });

  it('returns tracks unchanged when stages is empty', () => {
    const t = { '2026-05-01': { kmDay: 10 } };
    expect(filterTracksByStages(t, {})).toBe(t);
  });

  it('filters out orphan tracks when stage dates exist', () => {
    const tracks = {
      '2026-05-01': { kmDay: 10 },
      '2026-05-02': { kmDay: 20 }
    };
    const stages = {
      '2026-05-02': { kmTotal: 20 },
      '2026-05-03': { kmTotal: 30 }
    };
    expect(filterTracksByStages(tracks, stages)).toEqual({
      '2026-05-02': { kmDay: 20 }
    });
  });

  it('keeps matching track objects by reference', () => {
    const t = { kmDay: 42 };
    const tracks = { '2026-05-01': t };
    const stages = { '2026-05-01': { kmTotal: 42 } };
    const filtered = filterTracksByStages(tracks, stages);
    expect(filtered['2026-05-01']).toBe(t);
  });
});

describe('isOfflineable', () => {
  it('autorise current', () => {
    expect(utils.isOfflineable('current')).toBe(true);
  });

  it('autorise stages/ et ses sous-paths', () => {
    expect(utils.isOfflineable('stages/2026-05-01')).toBe(true);
    expect(utils.isOfflineable('stages/2026-05-01/note')).toBe(true);
    expect(utils.isOfflineable('stages/2026-05-01/published')).toBe(true);
  });

  it('autorise journals/', () => {
    expect(utils.isOfflineable('journals/2026-05-01')).toBe(true);
  });

  it('refuse photos/', () => {
    expect(utils.isOfflineable('photos/2026-05-01/abc')).toBe(false);
  });

  it('refuse comments/', () => {
    expect(utils.isOfflineable('comments/2026-05-01/xyz')).toBe(false);
  });

  it('refuse bravos/', () => {
    expect(utils.isOfflineable('bravos/2026-05-01/vid')).toBe(false);
  });

  it('refuse expenses/', () => {
    expect(utils.isOfflineable('expenses/abc')).toBe(false);
  });

  it('refuse chaîne vide', () => {
    expect(utils.isOfflineable('')).toBe(false);
  });

  it('refuse null/undefined/nombre', () => {
    expect(utils.isOfflineable(null)).toBe(false);
    expect(utils.isOfflineable(undefined)).toBe(false);
    expect(utils.isOfflineable(42)).toBe(false);
  });
});

describe('actionLabel', () => {
  it('current → position', () => {
    expect(utils.actionLabel('current')).toBe('position');
  });

  it('stages/date → étape', () => {
    expect(utils.actionLabel('stages/2026-05-01')).toBe('étape');
  });

  it('stages/date/note → note', () => {
    expect(utils.actionLabel('stages/2026-05-01/note')).toBe('note');
  });

  it('stages/date/published → publication', () => {
    expect(utils.actionLabel('stages/2026-05-01/published')).toBe('publication');
  });

  it('stages/date/journalDeleted → suppression', () => {
    expect(utils.actionLabel('stages/2026-05-01/journalDeleted')).toBe('suppression');
  });

  it('stages/date/published/note → note (terminal segment)', () => {
    expect(utils.actionLabel('stages/2026-05-01/published/note')).toBe('note');
  });

  it('journals/date → journal', () => {
    expect(utils.actionLabel('journals/2026-05-01')).toBe('journal');
  });

  it('photos/date/id → photo', () => {
    expect(utils.actionLabel('photos/2026-05-01/abc')).toBe('photo');
  });

  it('comments/date/id → commentaire', () => {
    expect(utils.actionLabel('comments/2026-05-01/xyz')).toBe('commentaire');
  });

  it('bravos/date/vid → bravo', () => {
    expect(utils.actionLabel('bravos/2026-05-01/vid')).toBe('bravo');
  });

  it('expenses/id → dépense', () => {
    expect(utils.actionLabel('expenses/abc')).toBe('dépense');
  });

  it('non-string → élément', () => {
    expect(utils.actionLabel(null)).toBe('élément');
    expect(utils.actionLabel(42)).toBe('élément');
  });

  it('chemin inconnu → élément', () => {
    expect(utils.actionLabel('unknown/path')).toBe('élément');
  });
});

describe('filterVisibleJournalDates', () => {
  const stages = {
    '2026-05-01': { kmTotal: 50, published: true },
    '2026-05-02': { kmTotal: 100 },
    '2026-05-03': { kmTotal: 150, published: true, journalDeleted: true },
    '2026-05-04': { kmTotal: 200, published: true }
  };

  it('retourne tableau vide si stages vide', () => {
    expect(utils.filterVisibleJournalDates({}, true)).toEqual([]);
    expect(utils.filterVisibleJournalDates({}, false)).toEqual([]);
  });

  it('admin voit brouillons et publiés', () => {
    const r = utils.filterVisibleJournalDates(stages, true);
    expect(r).toContain('2026-05-01');
    expect(r).toContain('2026-05-02');
    expect(r).toContain('2026-05-04');
  });

  it('visiteur ne voit que les publiés', () => {
    const r = utils.filterVisibleJournalDates(stages, false);
    expect(r).toContain('2026-05-01');
    expect(r).toContain('2026-05-04');
    expect(r).not.toContain('2026-05-02');
  });

  it('personne ne voit les journalDeleted', () => {
    expect(utils.filterVisibleJournalDates(stages, true)).not.toContain('2026-05-03');
    expect(utils.filterVisibleJournalDates(stages, false)).not.toContain('2026-05-03');
  });

  it('tri décroissant (dernier jour en premier)', () => {
    const r = utils.filterVisibleJournalDates(stages, true);
    expect(r[0]).toBe('2026-05-04');
    expect(r[r.length - 1]).toBe('2026-05-01');
  });

  it('stages null / non-objet → tableau vide', () => {
    expect(utils.filterVisibleJournalDates(null, true)).toEqual([]);
    expect(utils.filterVisibleJournalDates('nope', false)).toEqual([]);
    expect(utils.filterVisibleJournalDates(undefined, true)).toEqual([]);
  });

  it('visiteur ignore published truthy non-booléen', () => {
    const st = {
      '2026-05-01': { published: 1 },
      '2026-05-02': { published: true }
    };
    expect(utils.filterVisibleJournalDates(st, false)).toEqual(['2026-05-02']);
  });
});

describe('COMMENT_COOLDOWN_MS', () => {
  it('expose un cooldown positif (>= 5s)', () => {
    expect(COMMENT_COOLDOWN_MS).toBeGreaterThanOrEqual(5000);
  });
});

describe('isCommentOnCooldown', () => {
  const CD = 30000; // 30s

  it('retourne false si lastSentTs est 0 (jamais envoyé)', () => {
    expect(isCommentOnCooldown(0, Date.now(), CD)).toBe(false);
  });

  it('retourne false si lastSentTs est null ou undefined', () => {
    expect(isCommentOnCooldown(null, Date.now(), CD)).toBe(false);
    expect(isCommentOnCooldown(undefined, Date.now(), CD)).toBe(false);
  });

  it('retourne true si dans le cooldown (5s après envoi, cooldown 30s)', () => {
    const now = 1000000;
    const sent = now - 5000; // envoyé il y a 5s
    expect(isCommentOnCooldown(sent, now, CD)).toBe(true);
  });

  it('retourne false si le cooldown est écoulé (31s après envoi, cooldown 30s)', () => {
    const now = 1000000;
    const sent = now - 31000;
    expect(isCommentOnCooldown(sent, now, CD)).toBe(false);
  });

  it('retourne false exactement au bord (cooldown = elapsed)', () => {
    const now = 1000000;
    const sent = now - CD;
    expect(isCommentOnCooldown(sent, now, CD)).toBe(false);
  });

  it('utilise COMMENT_COOLDOWN_MS par défaut si cooldownMs absent', () => {
    const now = 1000000;
    const sent = now - 5000;
    // Doit être en cooldown avec le cooldown par défaut (30s)
    expect(isCommentOnCooldown(sent, now)).toBe(true);
  });

  it('utilise Date.now() si nowTs absent', () => {
    const sent = Date.now() - 5000; // envoyé il y a 5s
    expect(isCommentOnCooldown(sent)).toBe(true);
  });

  it('retourne false si sent est très vieux (1 heure)', () => {
    const now = 1000000;
    const sent = now - 3600000;
    expect(isCommentOnCooldown(sent, now, CD)).toBe(false);
  });
});

describe('commentCooldownRemaining', () => {
  const CD = 30000;

  it('retourne 0 si lastSentTs est 0 ou absent', () => {
    expect(commentCooldownRemaining(0, Date.now(), CD)).toBe(0);
    expect(commentCooldownRemaining(null, Date.now(), CD)).toBe(0);
  });

  it('retourne le nombre de secondes restantes arrondi au supérieur', () => {
    const now = 1000000;
    const sent = now - 5000; // envoyé il y a 5s, 25s restants
    expect(commentCooldownRemaining(sent, now, CD)).toBe(25);
  });

  it(`retourne 1 pour moins d'une seconde restante`, () => {
    const now = 1000000;
    const sent = now - 29500; // 500ms restantes
    expect(commentCooldownRemaining(sent, now, CD)).toBe(1);
  });

  it('retourne 0 si le cooldown est terminé', () => {
    const now = 1000000;
    const sent = now - 35000;
    expect(commentCooldownRemaining(sent, now, CD)).toBe(0);
  });
});

describe('validateVisitorName', () => {
  const { validateVisitorName } = utils;

  it('accepte un prénom simple', () => {
    expect(validateVisitorName('Marie')).toEqual({ ok: true });
    expect(validateVisitorName('Jean')).toEqual({ ok: true });
  });

  it('accepte un prénom + nom', () => {
    expect(validateVisitorName('Jean Dupont')).toEqual({ ok: true });
    expect(validateVisitorName('Marie-Claire Martin')).toEqual({ ok: true });
  });

  it('accepte les caractères accentués', () => {
    expect(validateVisitorName('Éléonore')).toEqual({ ok: true });
    expect(validateVisitorName('Zoé Müller')).toEqual({ ok: true });
  });

  it('accepte les noms avec tiret et apostrophe', () => {
    expect(validateVisitorName("Jean-Pierre")).toEqual({ ok: true });
    expect(validateVisitorName("O'Brien")).toEqual({ ok: true });
  });

  it('rejette une valeur nulle ou vide', () => {
    expect(validateVisitorName(null).ok).toBe(false);
    expect(validateVisitorName('').ok).toBe(false);
    expect(validateVisitorName('  ').ok).toBe(false);
    expect(validateVisitorName(undefined).ok).toBe(false);
  });

  it('rejette un prénom trop court', () => {
    expect(validateVisitorName('A').ok).toBe(false);
  });

  it('rejette un nom dépassant la limite', () => {
    expect(validateVisitorName('A'.repeat(31)).ok).toBe(false);
  });

  it('rejette des chiffres ou caractères spéciaux', () => {
    expect(validateVisitorName('Tom1').ok).toBe(false);
    expect(validateVisitorName('Tom!').ok).toBe(false);
    expect(validateVisitorName('Tom@Dupont').ok).toBe(false);
  });

  it('rejette plus de deux mots', () => {
    expect(validateVisitorName('Jean Pierre Dupont').ok).toBe(false);
  });

  it('accepte les espaces en début/fin après trim', () => {
    // Après trim, "  Jean  " → "Jean", valide
    expect(validateVisitorName('  Jean  ')).toEqual({ ok: true });
  });
});
