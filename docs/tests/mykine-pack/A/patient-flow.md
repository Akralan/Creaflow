# Parcours patient

Dernière mise à jour : octobre 2026

Le patient n'a pas de compte, pas de mot de passe, pas d'adresse email. Son identifiant est le code à 6 lettres du lien reçu par SMS.

## Lien

Format : `https://mykine.app/s/ABCDEF`. Code tiré au sort dans un alphabet de 23 lettres (sans I, O, L), soit 148 millions de combinaisons. Validité 90 jours, renouvelable par le kiné (« Renvoyer le lien »). Un lien renvoyé révoque le précédent.

La page `mykine.app/s/{code}` :

1. tente d'ouvrir l'app par lien universel (`applinks` iOS, `assetlinks.json` Android) ;
2. sinon propose l'installation (stores) ;
3. sinon, bouton « Continuer sur le web » → version web de repli (`apps/patient` exportée en web, MediaPipe en WebAssembly, modèle `lite` seulement).

La version web est fonctionnelle mais plus lente (modèle `lite`, 10 à 14 fps sur un téléphone récent) ; l'app native reste la voie principale.

## Ouverture

`GET /api/v1/s/{code}` renvoie le pseudonyme (celui choisi par le kiné), le programme actif, les exercices prévus aujourd'hui et le catalogue. Si aucun exercice n'est prévu aujourd'hui, l'écran d'accueil l'indique et propose de faire la séance quand même (« Faire la séance de demain »).

Le code est conservé dans le stockage local de l'app après la première ouverture ; les ouvertures suivantes passent par l'icône de l'app.

## Cadrage

Écran obligatoire avant la première répétition de chaque séance (`src/screens/Framing.tsx`) :

- gabarit de silhouette à l'écran ;
- message tant que le corps entier n'est pas visible pendant 2 s ;
- message tant que l'angle de prise de vue n'est pas de trois quarts (`MIN_CAMERA_ANGLE_DEG = 45`) : « Tourne-toi un peu, on doit voir tes deux genoux » ;
- vérification de cadence (3 s), choix du modèle, et refus si moins de 4 angles par seconde (« Ton téléphone est trop lent pour cet exercice »).

Le téléphone est posé, pas tenu : l'écran rappelle « Pose ton téléphone contre un mur ou un meuble, à hauteur de hanche, à 2 ou 3 mètres ».

## Exercice

Écran `src/screens/Exercise.tsx` :

- aperçu caméra avec le squelette dessiné (points et segments suivis seulement) ;
- compteur en gros, `reps / target_reps`, série courante ;
- le membre concerné est coloré selon `feedback.ts` : vert (amplitude atteinte), orange (insuffisante), rouge (alignement hors plage) ;
- message court lié au rouge, défini par exercice dans le catalogue (« Garde le dos droit », « Ton genou dépasse ton pied ») ;
- bouton « Passer » qui enregistre l'exercice comme non fait, et « Pause ».

Entre deux séries : compte à rebours de repos (`rest_seconds`, 45 s par défaut, non modifiable en v0.4).

Pas de son. Pas de vibration. Aucun enregistrement vidéo, le flux caméra n'est jamais écrit sur le disque.

## Fin de séance

Récapitulatif : par exercice, répétitions faites / cible, partielles, et une phrase par exercice (« Amplitude atteinte sur 10 répétitions sur 12 »). Bouton « Envoyer à {kine_name} » → `POST /api/v1/s/{code}/sessions`.

Hors ligne : la séance est mise en file (`expo-sqlite`, table `pending_sessions`) et envoyée à la prochaine ouverture ; un bandeau l'indique.

## Historique

Onglet « Mes séances » : `GET /api/v1/s/{code}/history`, liste des 30 dernières séances avec le total de répétitions et une pastille par exercice fait ou passé.

## Ce que le patient ne peut pas faire

- Modifier son programme.
- Contacter le kiné depuis l'app.
- Voir ses courbes d'angle (réservées au dashboard kiné).
- Utiliser l'app sans lien actif : un code expiré affiche « Demande un nouveau lien à ton kiné ».
