# RGPD — registre des traitements

Responsable du traitement : Tom Cavaliere (personne physique, site personnel non
commercial), tomcavaliere66@gmail.com. Information des personnes :
[`confidentialite.html`](../confidentialite.html), liée depuis le gate visiteur,
l'attribution de la carte et le bandeau sous les onglets.

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

## Règles pour les évolutions

- Aucun email ni identifiant nominatif dans un nœud RTDB en lecture publique
  (vérifié par `npm run security:test`).
- Tout nouveau tiers contacté, toute nouvelle donnée ou nouvelle clé `localStorage` :
  mettre à jour `confidentialite.html` et ce registre.
- Un identifiant sur l'appareil n'est posé qu'au moment où l'utilisateur agit
  (`getVisitorId()` pour écrire, `peekVisitorId()` pour afficher).
