// Tests unitaires pour js/gps-core.js
// Lancer avec : npm test
//
// On utilise une fixture sous-échantillonnée du vrai tracé EuroVelo 1
// (25 points en France + 25 en Irlande) pour rester déterministe et rapide.

import { describe, it, expect } from 'vitest';
import gpsCore from '../js/gps-core.js';
import fixture from './fixtures/route-sample.js';

const { snapToRoute, routePointsAhead, ptsBbox, computeStageInfo, campingDist } = gpsCore;

const { ROUTE_PTS, CUM_KM, TOTAL_KM, FRANCE_END_IDX } = fixture;

describe('snapToRoute', () => {
  it('snap exact : un point identique à un point du tracé renvoie cet index', () => {
    const target = ROUTE_PTS[10];
    const r = snapToRoute(target[0], target[1], ROUTE_PTS, CUM_KM);
    expect(r.idx).toBe(10);
    expect(r.lat).toBe(target[0]);
    expect(r.lon).toBe(target[1]);
    expect(r.kmTotal).toBe(CUM_KM[10]);
  });

  it('snap approché : un point légèrement décalé renvoie le plus proche', () => {
    const target = ROUTE_PTS[10];
    // décalage ~10m
    const r = snapToRoute(target[0] + 0.0001, target[1] + 0.0001, ROUTE_PTS, CUM_KM);
    expect(r.idx).toBe(10);
  });

  it('point très éloigné : renvoie quand même un index valide (jamais null)', () => {
    const r = snapToRoute(0, 0, ROUTE_PTS, CUM_KM);
    expect(r.idx).toBeGreaterThanOrEqual(0);
    expect(r.idx).toBeLessThan(ROUTE_PTS.length);
    expect(typeof r.kmTotal).toBe('number');
  });

  it('kmTotal cohérent avec CUM_KM', () => {
    const r = snapToRoute(ROUTE_PTS[5][0], ROUTE_PTS[5][1], ROUTE_PTS, CUM_KM);
    expect(r.kmTotal).toBe(CUM_KM[r.idx]);
  });

  it('entrée vide/invalide : renvoie un fallback stable', () => {
    const r = snapToRoute(1, 2, null, null);
    expect(r).toEqual({ idx: -1, kmTotal: 0, lat: 1, lon: 2 });
  });

  it('points dupliqués : choisit le premier index le plus proche', () => {
    const pts = [[45, 6], [45, 6], [45.1, 6.1]];
    const kms = [0, 1, 2];
    const r = snapToRoute(45, 6, pts, kms);
    expect(r.idx).toBe(0);
    expect(r.kmTotal).toBe(0);
  });
});

describe('routePointsAhead', () => {
  it('renvoie au moins le point de départ', () => {
    const pts = routePointsAhead(0, 50, ROUTE_PTS, CUM_KM);
    expect(pts.length).toBeGreaterThanOrEqual(1);
    expect(pts[0]).toEqual(ROUTE_PTS[0]);
  });

  it("s'arrête une fois la distance cible atteinte", () => {
    const fromIdx = 5;
    const distKm = 100;
    const pts = routePointsAhead(fromIdx, distKm, ROUTE_PTS, CUM_KM);
    const lastIdx = fromIdx + pts.length - 1;
    // Tous les points sauf le dernier doivent être en deçà de la cible
    for (let i = fromIdx; i < lastIdx; i++){
      expect(CUM_KM[i]).toBeLessThan(CUM_KM[fromIdx] + distKm);
    }
  });

  it('cas limite : fromIdx proche de la fin du tracé', () => {
    const fromIdx = ROUTE_PTS.length - 2;
    const pts = routePointsAhead(fromIdx, 500, ROUTE_PTS, CUM_KM);
    expect(pts.length).toBeGreaterThanOrEqual(1);
    expect(pts.length).toBeLessThanOrEqual(2);
  });

  it('distKm=0 : renvoie seulement le point de départ', () => {
    const pts = routePointsAhead(7, 0, ROUTE_PTS, CUM_KM);
    expect(pts).toEqual([ROUTE_PTS[7]]);
  });

  it('fromIdx hors bornes : clamp correctement', () => {
    const ptsLow = routePointsAhead(-10, 10, ROUTE_PTS, CUM_KM);
    expect(ptsLow[0]).toEqual(ROUTE_PTS[0]);
    const ptsHigh = routePointsAhead(9999, 10, ROUTE_PTS, CUM_KM);
    expect(ptsHigh[0]).toEqual(ROUTE_PTS[ROUTE_PTS.length - 1]);
  });

  it('entrée invalide : renvoie tableau vide', () => {
    expect(routePointsAhead(0, 10, null, null)).toEqual([]);
  });
});

describe('ptsBbox', () => {
  it('bbox correcte sur 3 points connus', () => {
    const pts = [[10, 20], [12, 18], [11, 25]];
    const b = ptsBbox(pts, 0);
    expect(b).toEqual({ s: 10, n: 12, w: 18, e: 25 });
  });

  it('marge appliquée symétriquement', () => {
    const b = ptsBbox([[10, 20], [12, 25]], 0.5);
    expect(b).toEqual({ s: 9.5, n: 12.5, w: 19.5, e: 25.5 });
  });
});

describe('computeStageInfo — simulation de 3 étapes successives', () => {
  // 3 positions GPS échelonnées le long du tracé.
  // On vérifie comment l'app verrait évoluer son état.
  const stage1 = ROUTE_PTS[0];                       // début (France)
  const stage2 = ROUTE_PTS[FRANCE_END_IDX];          // fin de la France
  const stage3 = ROUTE_PTS[ROUTE_PTS.length - 1];    // arrivée (Irlande)

  const info1 = computeStageInfo(stage1[0], stage1[1], ROUTE_PTS, CUM_KM, TOTAL_KM, FRANCE_END_IDX);
  const info2 = computeStageInfo(stage2[0], stage2[1], ROUTE_PTS, CUM_KM, TOTAL_KM, FRANCE_END_IDX);
  const info3 = computeStageInfo(stage3[0], stage3[1], ROUTE_PTS, CUM_KM, TOTAL_KM, FRANCE_END_IDX);

  it('étape 1 : début du tracé en France, progression ~0%', () => {
    expect(info1.country).toBe('FR');
    expect(info1.kmTotal).toBe(0);
    expect(info1.progressPct).toBe(0);
    expect(info1.kmRemaining).toBeCloseTo(TOTAL_KM, 1);
  });

  it('étape 2 : fin de la France, encore en FR', () => {
    expect(info2.country).toBe('FR');
    expect(info2.idx).toBe(FRANCE_END_IDX);
    expect(info2.progressPct).toBeGreaterThan(0);
    expect(info2.progressPct).toBeLessThan(100);
  });

  it('étape 3 : arrivée en Irlande, ~100%', () => {
    expect(info3.country).toBe('IE');
    expect(info3.kmTotal).toBeCloseTo(TOTAL_KM, 1);
    expect(info3.kmRemaining).toBeCloseTo(0, 1);
    expect(info3.progressPct).toBeCloseTo(100, 1);
  });

  it('invariant métier : kmTotal strictement croissant entre les étapes', () => {
    expect(info1.kmTotal).toBeLessThan(info2.kmTotal);
    expect(info2.kmTotal).toBeLessThan(info3.kmTotal);
  });

  it('invariant métier : kmRemaining strictement décroissant', () => {
    expect(info1.kmRemaining).toBeGreaterThan(info2.kmRemaining);
    expect(info2.kmRemaining).toBeGreaterThan(info3.kmRemaining);
  });

  it('transition de pays se produit bien à FRANCE_END_IDX', () => {
    const justAfter = ROUTE_PTS[FRANCE_END_IDX + 1];
    const info = computeStageInfo(justAfter[0], justAfter[1], ROUTE_PTS, CUM_KM, TOTAL_KM, FRANCE_END_IDX);
    expect(info.country).toBe('IE');
  });

  it('totalKm=0 : progression forcée à 0', () => {
    const p = ROUTE_PTS[10];
    const info = computeStageInfo(p[0], p[1], ROUTE_PTS, CUM_KM, 0, FRANCE_END_IDX);
    expect(info.progressPct).toBe(0);
  });

  it('entrée route invalide : fallback sans crash', () => {
    const info = computeStageInfo(1, 2, [], [], 100, 0);
    expect(info.idx).toBe(-1);
    expect(info.kmTotal).toBe(0);
    expect(info.kmRemaining).toBe(100);
    expect(info.progressPct).toBe(0);
    expect(info.country).toBe('FR');
  });
});

describe('campingDist', () => {
  // POI fictif : on prend un point pile sur le tracé pour avoir un détour ~0
  it('POI sur le tracé devant nous : detour ~0, trace > 0', () => {
    const fromIdx = 5;
    const target = ROUTE_PTS[15];
    const d = campingDist(fromIdx, target[0], target[1], ROUTE_PTS, CUM_KM);
    expect(d.detour).toBeLessThan(0.5);
    expect(d.trace).toBeGreaterThan(0);
    expect(d.trace).toBeCloseTo(CUM_KM[15] - CUM_KM[5], 0);
  });

  it('POI derrière nous : trace clampée à 0 (pas de km négatifs)', () => {
    const fromIdx = 20;
    const target = ROUTE_PTS[5];
    const d = campingDist(fromIdx, target[0], target[1], ROUTE_PTS, CUM_KM);
    expect(d.trace).toBe(0);
  });

  it('POI à côté du tracé : detour > 0', () => {
    const fromIdx = 0;
    const onRoute = ROUTE_PTS[10];
    // ~1km à l'écart en latitude
    const d = campingDist(fromIdx, onRoute[0] + 0.01, onRoute[1], ROUTE_PTS, CUM_KM);
    expect(d.detour).toBeGreaterThan(0.5);
    expect(d.detour).toBeLessThan(2);
  });

  it('arrondis : trace en entier, detour à 1 décimale', () => {
    const d = campingDist(0, ROUTE_PTS[10][0], ROUTE_PTS[10][1], ROUTE_PTS, CUM_KM);
    expect(d.trace).toBe(Math.round(d.trace));
    expect(Math.round(d.detour * 10) / 10).toBe(d.detour);
  });

  it('fromIdx hors bornes : clamp sans crash', () => {
    const d = campingDist(9999, ROUTE_PTS[10][0], ROUTE_PTS[10][1], ROUTE_PTS, CUM_KM);
    expect(d.trace).toBe(0);
  });

  it('entrée invalide : retourne 0/0', () => {
    expect(campingDist(0, 1, 2, null, null)).toEqual({ trace: 0, detour: 0 });
  });
});
