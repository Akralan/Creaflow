# Roadmap

Dernière mise à jour : octobre 2026

## Fait

### v0.1 — prototype

- Page web, MediaPipe JS, comptage de squats dans le navigateur.
- Calcul d'angle de flexion du genou (hanche-genou-cheville).
- Premiers seuils haut / bas.

### v0.2 — app et API

- App Expo, build Android, TFLite (`lite` puis `full`).
- API FastAPI : kinés, patients, programmes, dépôt de séances.
- Lien patient par SMS, sans compte.
- Contrôle de cadrage : corps entier, angle de trois quarts (45°).
- Sélection automatique du modèle et saut d'images selon la cadence.
- Compteur avec hystérésis (8°), validé sur 120 répétitions annotées (4 % de faux positifs).

### v0.3 — feedback et dashboard

- Feedback couleur en direct sur le membre concerné (vert / orange / rouge), contrôle d'alignement par exercice.
- Dashboard kiné : liste des patients, fiche, éditeur de programme, courbes d'angle, taux d'adhésion 7 et 30 jours.
- Séries d'angles uniquement côté serveur ; aucune vidéo, aucune coordonnée de point.
- Export CSV des séances.
- Rappels SMS optionnels.

### v0.4 — catalogue et iOS

- 14 exercices au catalogue, exercices d'épaule (élévations, rotation externe).
- Exercices au sol retirés du catalogue.
- Build iOS, délégué Core ML.
- Version web de repli.
- Pseudonymisation : alias choisi par le kiné, téléphone chiffré, aucun nom en base.
- Idempotence du dépôt de séance, file hors ligne.
- Sentry sans données de requête.

## En cours

- Vue cabinet : plusieurs kinés sur un même groupe de patients.
- Seuils d'angle réglables par le kiné, par exercice, avec bornes de sécurité.
- Réglage du temps de repos entre séries.

## À venir

- Exercices d'épaule supplémentaires : rotation interne, élévation en plan scapulaire, tirage avec élastique.
- Exercices de cheville : équilibre unipodal (durée de tenue, oscillation du centre de masse estimée par les hanches).
- Dashboard utilisable sur téléphone.
- Facturation : Stripe, 29 € HT / mois / kiné, essai 30 jours.
- Hébergement HDS : à évaluer au-delà de 20 cabinets.
- Intégration avec un logiciel de cabinet (export de programme, import de patients) : à cadrer avec un éditeur.

## Non prévu

- Exercices au sol tant que le modèle de pose ne tient pas le bassin en position allongée.
- Télé-consultation, messagerie.
- Application grand public sans kiné.
- Détection de matériel (élastique, haltère).
- Traitement vidéo côté serveur.
