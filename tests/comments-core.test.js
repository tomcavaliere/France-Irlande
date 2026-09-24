import { describe, it, expect } from 'vitest';
import CommentsCore from '../js/core/comments-core.js';

const { normalizeAdminReplyAuthorName, normalizeCommentReply, DEFAULT_ADMIN_REPLY_AUTHOR } = CommentsCore;

describe('normalizeAdminReplyAuthorName', () => {
  it('reconnaît les voyageurs sans tenir compte des accents ni de la casse', () => {
    expect(normalizeAdminReplyAuthorName('chloe.martin@example.com')).toBe('Chloé');
    expect(normalizeAdminReplyAuthorName('CHLOÉ')).toBe('Chloé');
    expect(normalizeAdminReplyAuthorName('tom.cavaliere@gmail.com')).toBe('Tom');
  });

  it('dérive un nom lisible d’un email inconnu', () => {
    expect(normalizeAdminReplyAuthorName('jean-paul_durand@example.com')).toBe('Jean Paul Durand');
  });

  it('met en forme un nom libre', () => {
    expect(normalizeAdminReplyAuthorName('  marie   CURIE ')).toBe('Marie Curie');
  });

  it('repli sur Admin si vide ou non-string', () => {
    expect(normalizeAdminReplyAuthorName('')).toBe('Admin');
    expect(normalizeAdminReplyAuthorName('___@x.fr')).toBe('Admin');
    expect(normalizeAdminReplyAuthorName(null)).toBe('Admin');
  });
});

describe('normalizeCommentReply', () => {
  it('normalise une réponse complète', () => {
    const raw = { text: '  Merci !  ', ts: 12, authorName: 'chloe', likes: { v1: true }, replies: { r1: { name: 'A', text: 'B', ts: 1 } } };
    expect(normalizeCommentReply(raw)).toEqual({
      text: 'Merci !',
      ts: 12,
      authorName: 'Chloé',
      likes: { v1: true },
      replies: { r1: { name: 'A', text: 'B', ts: 1 } }
    });
  });

  it('auteur absent → auteur par défaut ; champs manquants tolérés', () => {
    expect(normalizeCommentReply({ text: 'ok' })).toEqual({
      text: 'ok', ts: 0, authorName: DEFAULT_ADMIN_REPLY_AUTHOR, likes: {}, replies: {}
    });
  });

  it('null si absente ou sans texte', () => {
    expect(normalizeCommentReply(null)).toBeNull();
    expect(normalizeCommentReply({ text: '   ' })).toBeNull();
    expect(normalizeCommentReply('texte')).toBeNull();
  });
});
