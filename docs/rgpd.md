# RGPD — registre des traitements et audit

Responsable du traitement : Tom Cavaliere (personne physique, site personnel non
commercial), tomcavaliere66@gmail.com. Information des personnes :
[`confidentialite.html`](../confidentialite.html), liée depuis le gate visiteur,
l'attribution de la carte et le carnet.

Ce document est la source de vérité interne ; la page publique doit rester alignée
avec lui.

## Registre des traitements (carnet archivé)

| Traitement | Personnes | Données | Base légale | Destinataires | Conservation |
|---|---|---|---|---|---|
| Commentaires et réponses | Proches | Nom saisi, texte, date | Consentement (publication volontaire) | Public (lecture RTDB ouverte), Firebase | Durée de l'archive ; suppression sur demande |
| Bravos, likes de réponses | Proches | Identifiant aléatoire (sans nom) | Intérêt légitime | Public, Firebase | Durée de l'archive |
| Journal de connexions (`activity`) et profils (`visitorProfiles`) | Proches, admin | Prénom ou email admin, date de connexion | Intérêt légitime (pendant le voyage) | Admin uniquement | **Supprimés à l'archivage** ; plus aucune écriture (`ARCHIVED`) |
| Contenus du voyage | Tom, Chloé, tiers éventuels sur les photos | Positions, traces GPS, récits, photos, vidéos | Consentement de Tom et Chloé | Public, Firebase | Durée de l'archive |
| Dépenses | Tom, Chloé | Montant, catégorie, payeur | Intérêt légitime (usage privé) | Admin uniquement | Durée de l'archive |
| Consultation du site | Tout visiteur | Adresse IP, navigateur | Intérêt légitime | GitHub (hébergement), OpenStreetMap (tuiles), Firebase | Selon chaque prestataire |

Mode démo : aucune donnée envoyée à un serveur (stubs en mémoire). Seuls `ev1-demo` et
les délais anti-spam (`ev1-*-last-*`) sont écrits dans le `localStorage`.

**Sous-traitants et transferts** : Google Firebase (RTDB `europe-west1` en Belgique ;
Auth et Storage, Google LLC certifiée Data Privacy Framework), GitHub, Inc. (États-Unis,
DPF), OpenStreetMap Foundation (Royaume-Uni, adéquation). Réservés à l'admin :
Open-Meteo, Overpass API, OpenCampingMap.

**Stockage local** : aucun cookie, aucune mesure d'audience. Les clés `localStorage`
sont listées dans `confidentialite.html` ; toutes sont strictement nécessaires
(exemptées de consentement, délibération CNIL n° 2020-091).

## Audit du 24 septembre 2026

| # | Constat | Gravité | Correction |
|---|---|---|---|
| 1 | Aucune information des personnes (art. 13) ni mentions légales (LCEN) | Élevée | `confidentialite.html` |
| 2 | Email de l'admin lisible par tous : `visitorAuth.updatedBy` dans un nœud en lecture publique | Élevée | Champ retiré du code et refusé par les règles ; `security:test` échoue sur toute clé `mail`/`updatedBy` sous un nœud public |
| 3 | Journal de connexions et profils visiteurs conservés sans limite après la fin de leur finalité | Moyenne | Plus aucun suivi en archive, admin compris ; purge manuelle |
| 4 | Le tracé partait d'une adresse privée, publiée au mètre près | Moyenne | Zone de confidentialité de 1,5 km (GPX, `route-data.js`, fixture) |
| 5 | Identifiant `ev1_visitor_id` posé à chaque affichage du carnet, même en archive et en démo | Moyenne | Créé seulement lors d'une écriture ; en mémoire en démo ; retiré en archive |
| 6 | Prénom demandé au gate de l'archive sans finalité | Faible | Mot de passe seul en archive ; prénom retiré des appareils |
| 7 | Appel open-meteo (IP + position) au démarrage pour tous les visiteurs | Faible | Uniquement à l'ouverture de l'onglet Étapes (admin) |
| 8 | Clé admin Firebase (`serviceAccountKey.json`) non ignorée par git | Faible | Ajoutée à `.gitignore` |

Déjà conforme : pas de cookie, d'analytics ni de police tierce ; Leaflet auto-hébergé ;
nœuds sensibles en lecture admin ; démo sans Firebase et données fictives ; EXIF des
photos supprimé par la recompression canvas ; aucune adresse email dans l'historique
git.

## Actions manuelles

À faire dans la console Firebase, **avant** de publier la page de confidentialité (elle
affirme que le journal de connexions est supprimé) :

- [ ] RTDB : supprimer `/activity` et `/visitorProfiles`.
- [ ] RTDB : supprimer `/visitorAuth/updatedBy`.
- [ ] RTDB : supprimer `/health` et `/training` (onglets retirés de l'app, données de
  santé devenues sans usage).
- [ ] Règles : publier `firebase/database.rules.json`, **après** le déploiement du code
  (l'ancien code écrit encore `updatedBy`, que les nouvelles règles refusent).
- [ ] `/tracks/<premier jour>` : la trace GPS réelle du jour 1 part probablement du
  domicile. Réimporter un GPX tronqué via l'admin, ou éditer les coordonnées.
- [ ] Photos et vidéos publiques : retirer les personnes identifiables sans leur accord ;
  confirmer l'accord de Chloé pour ce qui la concerne.

Facultatif :

- [ ] L'historique git public contient encore l'ancien point de départ du tracé. Le
  réécrire (`git filter-repo` puis force-push) est destructif et ne peut pas effacer les
  copies déjà clonées : à décider en connaissance de cause.

## Règles pour les évolutions

- Aucun email ni identifiant nominatif dans un nœud RTDB en lecture publique
  (vérifié par `npm run security:test`).
- Tout nouveau tiers contacté, toute nouvelle donnée ou nouvelle clé `localStorage` :
  mettre à jour `confidentialite.html` et ce registre.
- Un identifiant sur l'appareil n'est posé qu'au moment où l'utilisateur agit
  (`getVisitorId()` pour écrire, `peekVisitorId()` pour afficher).
