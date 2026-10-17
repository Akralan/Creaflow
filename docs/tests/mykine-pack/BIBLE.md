# BIBLE DU PACK MYKINÉ — faits de référence (ne pas ingérer dans l'app)

> Document interne au test. Tous les fichiers du pack (couche A `A/`, couche B `B/`) doivent respecter ces faits : mêmes noms, mêmes chiffres, mêmes dates. Les docs de la couche A sont de la documentation technique **sans récit** (ce qu'un dépôt GitHub contient). La couche B est le devlog daté et les décisions, écrits sec, comme un dev les note pour lui, jamais pour un lecteur.

## Le projet

- **MyKiné** : le kiné prescrit un programme d'exercices ; le patient les fait chez lui devant la caméra de son téléphone ; l'app compte les répétitions, vérifie l'amplitude et l'alignement en direct, et envoie un compte-rendu de séance au kiné.
- **Auteur** : Alix, dev solo. Travaille dessus le soir et le week-end, à plein temps depuis juin 2026.
- **Kiné conseil** : Julien Ferrand, kiné du sport à Lyon (cabinet Part-Dieu), ami. Sa collègue : Marion Dubost (même cabinet).
- **Début** : 9 novembre 2025, après que Julien dit qu'environ 6 patients sur 10 ne font pas leurs exercices à la maison, et qu'il n'a aucun moyen de le savoir.

## Stack

- **App patient** : Expo (React Native), TypeScript. Pose estimation sur l'appareil avec **MediaPipe Pose (BlazePose)**, modèle `lite` puis `full` en TFLite, **33 points**. Aucune vidéo ne quitte le téléphone : seuls les angles articulaires et les compteurs sont envoyés.
- **Back-end** : Python **FastAPI**, PostgreSQL 16, SQLAlchemy, déployé sur un VPS Scaleway (DEV1-S) à Paris, Docker Compose, Caddy.
- **Dashboard kiné** : Next.js 15, TypeScript, Tailwind.
- **Patient sans compte** : il reçoit un lien SMS (`mykine.app/s/<code à 6 lettres>`), le lien ouvre l'app ou une page web de repli.
- **Boîtier** (abandonné) : Raspberry Pi 5 + Camera Module 3, écran 7", pensé pour les patients âgés sans smartphone. Coût estimé des pièces : 94 €. Abandonné le 14 mars 2026.

## Chiffres clés (à reprendre tels quels)

- Fréquence d'images : modèle `lite` 24 fps sur Pixel 7, 15 fps sur Pixel 4a ; modèle `full` 9 fps sur Pixel 4a, 19 fps sur Pixel 7.
- Compteur de répétitions : machine à états `haut → descente → bas → montée`, hystérésis de 8° sur les seuils d'angle. Faux positifs sur le squat : **18 %** avant hystérésis, **4 %** après, mesurés sur **120 répétitions filmées** (mars-avril 2026).
- Angle caméra requis : **45°** (trois quarts face), parce que de profil le genou se cache derrière l'autre et le squelette saute.
- Pilote 1 (mai 2026) : 5 patients de Julien, 3 ont fait au moins une séance, 2 n'ont jamais ouvert le lien.
- Pilote 2 (juillet-septembre 2026) : 4 kinés (Julien, Marion, + 2 via le groupe Facebook « Kinés du sport France »), 19 patients.
- État au 10 octobre 2026 : **8 kinés actifs, 31 patients, 412 séances enregistrées**, 12 kinés en liste d'attente.
- Prix testé : **29 € HT / mois / kiné**, patients illimités. 2 kinés sur 4 ont dit qu'ils paieraient ; les 2 autres veulent que ce soit « compris dans leur logiciel ».
- Exercices au catalogue : 14 (v0.4). Exercices impossibles pour le moment : tout ce qui se fait allongé au sol (le modèle perd le bassin).

## Décisions datées (couche B, `decisions.md`)

1. 2025-11-23 — Pose estimation sur l'appareil, jamais côté serveur (latence et vie privée).
2. 2026-01-18 — Explorer un boîtier pour les patients sans smartphone.
3. 2026-02-07 — Pas de compte patient : un lien SMS suffit.
4. 2026-03-14 — Abandon du boîtier.
5. 2026-03-14 — Caméra à 45° obligatoire, vérifiée avant la séance.
6. 2026-04-05 — Passer du modèle `lite` au `full`, avec saut d'images une sur deux sur les téléphones lents.
7. 2026-06-02 — Ne jamais stocker de vidéo. Seules les séries d'angles sont conservées.
8. 2026-06-21 — Feedback en direct par couleur (vert / orange / rouge) sur le membre concerné, au lieu d'un score en fin de séance.
9. 2026-08-30 — Retirer les exercices au sol du catalogue plutôt que les livrer mal.
10. 2026-10-03 — Pas d'hébergeur HDS pour l'instant : anonymiser (pas de nom de patient côté serveur, un pseudonyme choisi par le kiné).

## Repères du devlog (couche B, `devlog.md`) — ordre chronologique

- 2025-11-09 : discussion avec Julien, 6 patients sur 10.
- 2025-11-16 : prototype web, MediaPipe JS, compte des squats dans le navigateur. Marche sur le laptop, pas sur le téléphone de Julien (iPhone 11, 6 fps).
- 2025-11-23 : décision sur l'appareil.
- 2025-12 : calcul d'angle de flexion du genou (hanche-genou-cheville), premiers seuils ; le compteur compte double quand on tremble en bas.
- 2026-01 : Expo, premier build Android ; TFLite ; boîtier commandé (Pi 5).
- 2026-02 : FastAPI, programmes, lien SMS ; Julien crée son premier programme en 11 minutes.
- 2026-03-07 : démo au cabinet à Julien et Marion. Marion fait un squat de profil : le squelette saute sur le genou, elle arrête à 40 secondes, « je ne peux pas donner ça à un patient ». Julien trouve l'app « lente ».
- 2026-03-14 : abandon du boîtier (personne ne veut d'un matériel, 94 € de pièces, et le problème d'angle est le même) ; angle 45° imposé.
- 2026-04 : modèle full, saut d'images, hystérésis ; 120 répétitions filmées avec Julien un samedi ; 18 % → 4 %.
- 2026-05-12 : pilote 1 lancé, 5 patients. 2026-05-26 : 3 sur 5 ont fait une séance ; retour d'une patiente : « je ne sais pas si je le fais bien ».
- 2026-06-02 : décision vidéo. 2026-06-21 : feedback couleur. 2026-06-28 : premier message d'un patient à Julien : « c'est la première fois que je fais mes exercices toute la semaine ».
- 2026-07 : dashboard kiné, taux d'adhésion par patient ; prix 29 € testé ; pilote 2 démarre ; mois calme.
- 2026-08 : exercices d'épaule (élévation latérale), occlusion du bras par le tronc ; exercices au sol testés, échec, retirés le 30.
- 2026-09 : post dans le groupe Facebook « Kinés du sport France », 12 kinés en liste d'attente en 4 jours ; iOS : TFLite via Expo dev client, 3 jours perdus ; mise à jour Expo SDK casse la caméra, retour arrière.
- 2026-10-03 : décision HDS/anonymisation. 2026-10-10 : v0.4, 8 kinés, 31 patients, 412 séances.
