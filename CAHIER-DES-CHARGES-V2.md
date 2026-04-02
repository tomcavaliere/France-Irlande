# Cahier des charges — BikePlanner : app générique de bikepacking

Version 1.0 — Avril 2026  
Basé sur le projet EuroVelo 1 Cork → Sligo

---

## 1. Vision du projet

Transformer l'app de voyage personnelle en une **plateforme générique** où n'importe quel cyclo-voyageur peut :
1. Importer son tracé GPX
2. Répondre à un questionnaire sur ses préférences
3. Obtenir automatiquement un découpage en étapes cohérent
4. Utiliser l'interface existante (carte, journal, météo, dépenses) pour son propre voyage

---

## 2. Ce que fait l'app actuelle (point de départ)

Tout ce qui est aujourd'hui **hardcodé** dans `index.html` et devra devenir **dynamique** :

| Élément | Situation actuelle | Ce qu'il faut faire |
|---|---|---|
| Tracé GPX | Embarqué en dur (4 Mo de coordonnées) | Upload par l'utilisateur |
| Étapes | 28 étapes avec noms, km, dénivelé calculés manuellement | Générées par algorithme |
| Noms des étapes | "Cork → Kinsale" saisis à la main | Récupérés via géocodage inversé |
| Hébergements | Saisis manuellement par étape | Optionnel / API externe |
| Totaux (km, D+) | Constantes hardcodées | Calculés depuis le GPX |
| Données Firebase | Un seul projet pour un seul voyage | Un projet par voyage, par utilisateur |

---

## 3. Parcours utilisateur cible

```
1. Arrivée sur la page d'accueil
       ↓
2. Créer un compte (email/mot de passe)
       ↓
3. "Nouveau voyage" → importer un fichier GPX
       ↓
4. Questionnaire de planification (voir §4)
       ↓
5. Aperçu du découpage en étapes généré
   → possibilité d'ajuster manuellement
       ↓
6. Voyage créé → accès à l'interface connue
   (Carte / Étapes / Journal / Météo / Dépenses)
       ↓
7. Pendant le voyage : cocher étapes, écrire journal, photos
       ↓
8. Partager un lien public en lecture seule aux proches
```

---

## 4. Questionnaire de planification

### Paramètres obligatoires
- **Nombre de jours total** disponibles pour le voyage
- **Distance journalière cible** (ex: 60-80 km/jour)
- **Niveau** : Débutant / Intermédiaire / Expérimenté (influence le rapport dénivelé/distance)
- **Jours de repos** : tous les combien de jours ? (ex: 1 jour off tous les 6)
- **Date de départ** (pour la météo et le journal)

### Paramètres optionnels
- **Dénivelé max par jour** (ex: 1200m D+)
- **Préférence d'arrivée** : ville / camping / peu importe
- **Nom du voyage** (affiché dans l'app)

### Ce que l'algorithme doit produire
À partir de ces paramètres + le GPX :
- Une liste d'étapes avec : point de départ, point d'arrivée, km, D+, D-
- Des noms automatiques pour chaque étape (géocodage inversé)
- Les coordonnées de début et fin de chaque étape

---

## 5. L'algorithme de découpage — le cœur du problème

C'est la partie **la plus complexe** du projet. Voici ce qu'il doit faire :

### 5.1 Parsing du GPX
- Lire le XML, extraire les `<trkpt>` (latitude, longitude, élévation, horodatage optionnel)
- Calculer les distances entre points consécutifs (formule de Haversine)
- Calculer le dénivelé positif et négatif cumulé
- Simplifier le tracé (réduire les 50 000+ points à quelques centaines par étape) via l'algorithme de Ramer-Douglas-Peucker

### 5.2 Logique de découpage
```
Pour chaque jour :
  - Partir du point d'arrivée du jour précédent
  - Avancer le long du tracé jusqu'à atteindre la distance cible
  - Appliquer des corrections si nécessaire :
      → Si le D+ accumulé dépasse le max journalier → couper plus tôt
      → Si on est proche d'une ville (dans 5 km) → aller jusqu'à la ville
      → Si on est sur une montée → ne pas couper au milieu, finir la montée
  - Marquer le point de coupure comme fin d'étape
  - Insérer un jour de repos si le cycle le demande
```

### 5.3 Difficultés de l'algorithme

**Problème 1 — Couper au bon endroit**
La distance cible de 70 km tombe souvent au milieu de nulle part. Il faut trouver le point "logique" le plus proche : entrée d'une ville, sommet d'un col, bord de mer. Sans données de terrain (OpenStreetMap), l'algorithme ne sait pas si le point km 70 est dans une forêt ou en ville.

**Problème 2 — Le dénivelé change tout**
Un jour à 80 km plat n'est pas équivalent à 80 km avec 2000m D+. Il faut une notion de "distance équivalente" (formule de Naismith adaptée au vélo). Cette formule est subjective et dépend du chargement du vélo, du type de terrain, etc.

**Problème 3 — Les jours de repos**
Insérer des jours de repos sans décaler toutes les étapes suivantes demande une logique de renumérotation dynamique.

**Problème 4 — Les tracés GPX sont souvent imparfaits**
- Points GPS dupliqués ou aberrants (sauts de plusieurs km)
- Élévation manquante ou incorrecte (dépend de l'appareil)
- Tracé non continu (plusieurs segments)
- Fichiers multi-track ou multi-segment

---

## 6. Géocodage inversé — nommer les étapes

Pour obtenir "Cork → Kinsale" automatiquement, il faut interroger une API à partir des coordonnées GPS de début et fin d'étape.

### Options
| API | Gratuit | Limite | Qualité |
|---|---|---|---|
| **Nominatim (OpenStreetMap)** | ✅ Oui | 1 req/sec | Bonne |
| Google Maps Geocoding | ❌ Non | 200$/mois gratuit puis payant | Excellente |
| Photon (self-hosted) | ✅ Oui | Illimité | Bonne |

**Nominatim** est le choix évident pour un projet gratuit. La limite d'1 req/sec est suffisante (28 étapes = 56 requêtes = moins d'une minute).

---

## 7. Architecture technique nécessaire

### Changements par rapport à l'app actuelle

**Firebase — structure multi-voyage**
```
/users
  {userId}
    /voyages
      {voyageId}
        meta: { nom, dateDepart, totalKm, totalGain, nbEtapes }
        state: { completed, journal, ratings, tags }
        /photos
        /comments
        /expenses
        /stages: [ { day, title, km, ... } ]   ← généré par l'algo
```

**Stockage du GPX**
Le GPX brut (4 Mo) ne peut pas aller dans Firebase RTDB (trop lourd, trop cher en bandwidth). Options :
- Firebase Storage (payant, ~$0.026/Go) → acceptable pour de petits volumes
- Encoder uniquement les points simplifiés dans RTDB (quelques Ko)
- Stocker le GPX dans GitHub Pages de l'utilisateur (complexe)

**Recommandation** : ne stocker que les points simplifiés dans RTDB, pas le GPX brut.

### Nouvelles pages nécessaires
- **Page d'accueil** : liste des voyages de l'utilisateur
- **Page création** : upload GPX + questionnaire
- **Page aperçu** : résultat du découpage, ajustement manuel des étapes
- **Page voyage** : l'interface actuelle (inchangée)
- **Page partage** : vue publique en lecture seule

---

## 8. Faisabilité — analyse honnête

### ✅ Parties simples (déjà maîtrisées)
- Interface voyage : déjà faite et fonctionnelle
- Firebase Auth multi-utilisateurs : déjà en place
- Météo, photos, commentaires, dépenses : réutilisables à l'identique
- Parsing GPX basique (XML → coordonnées) : faisable en JS pur

### 🟠 Parties complexes mais faisables
- Calcul de distances et dénivelé depuis le GPX : algorithmes connus, implémentables en JS
- Géocodage inversé via Nominatim : API simple, bien documentée
- Simplification du tracé (Douglas-Peucker) : algorithme disponible en open source
- Structure Firebase multi-voyage : refactoring conséquent mais logique

### 🔴 Parties difficiles
- **L'algorithme de découpage intelligent** : trouver des points de coupure "logiques" sans données de terrain est le vrai défi. Un algorithme purement basé sur la distance produira souvent des étapes qui se terminent au milieu d'une montée ou en rase campagne. Il faudra soit accepter ce compromis, soit intégrer des données OpenStreetMap (villes, villages) pour affiner.

- **La gestion des GPX imparfaits** : traiter tous les cas (points aberrants, élévation manquante, multi-segments) est un travail de robustesse important.

- **L'ajustement manuel** : permettre à l'utilisateur de déplacer les points de coupure sur la carte (drag & drop sur Leaflet) est techniquement faisable mais demande un UI soigné.

---

## 9. Estimation de complexité

| Phase | Contenu | Complexité |
|---|---|---|
| **Phase 1** | Parsing GPX + calcul km/D+ + simplification tracé | 🟠 Moyenne |
| **Phase 2** | Algorithme de découpage en étapes | 🔴 Élevée |
| **Phase 3** | Géocodage inversé (noms des étapes) | 🟢 Faible |
| **Phase 4** | Refactoring Firebase multi-voyage | 🟠 Moyenne |
| **Phase 5** | UI création voyage (upload + questionnaire + aperçu) | 🟠 Moyenne |
| **Phase 6** | Ajustement manuel des étapes | 🟠 Moyenne |
| **Phase 7** | Lien de partage public | 🟢 Faible |

**Total estimé** : projet de taille significative. La phase 2 (algorithme) est celle qui concentre le plus d'incertitude — la qualité du résultat final en dépend entièrement.

---

## 10. Ce qui peut être réutilisé tel quel

- Toute l'interface Carte/Journal/Étapes/Météo/Dépenses/Infos
- Le système de photos (lazy loading, base64, compression)
- Le système de commentaires par étape
- Le mode hors-ligne (service worker + localStorage)
- Firebase Auth
- Les CSS et composants visuels

**L'essentiel de l'interface ne change pas** — c'est uniquement la couche de données (STAGES, FULL_ROUTE, TOTAL_KM) qui devient dynamique plutôt que hardcodée.

---

## 11. Recommandation

Avant de se lancer dans le développement, valider une chose critique :

> **L'algorithme de découpage produit-il des étapes acceptables ?**

Approche recommandée :
1. Implémenter d'abord l'algo de découpage en JavaScript isolé (hors app)
2. Le tester avec le GPX de l'Irlande (résultat connu : 28 étapes)
3. Comparer le découpage automatique avec les vraies étapes du projet
4. Si le résultat est satisfaisant à 80%+, continuer le développement
5. Si non, affiner l'algo avant de construire l'interface autour

C'est le seul vrai risque du projet — tout le reste est de l'ingénierie connue.
