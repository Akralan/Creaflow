# MyKiné — Vision produit

Dernière mise à jour : octobre 2026

## Le problème

Un kiné prescrit des exercices à faire à la maison entre deux séances. C'est là que se joue une bonne partie de la rééducation : une séance au cabinet par semaine ne suffit pas, le travail quotidien fait la différence.

Environ 6 patients sur 10 ne font pas ces exercices, ou pas correctement. Le kiné ne le sait pas. Il le devine à la séance suivante, quand le genou n'a pas progressé, et il n'a aucun moyen de distinguer un patient qui n'a rien fait d'un patient qui a fait les exercices de travers.

Les outils existants sont des fiches PDF, des vidéos YouTube, ou des applications qui demandent au patient de cocher « fait ». Aucun ne vérifie le mouvement.

## La solution

MyKiné ferme la boucle entre le cabinet et le domicile :

- le kiné compose un programme en quelques minutes depuis un dashboard, à partir d'un catalogue d'exercices ;
- le patient reçoit un lien par SMS, pose son téléphone, et fait ses exercices devant la caméra ;
- l'application compte les répétitions, mesure l'amplitude et vérifie l'alignement en direct, avec un feedback couleur sur le membre concerné ;
- le kiné reçoit un compte-rendu par séance et un taux d'adhésion par patient.

Tout le traitement d'image se fait sur le téléphone. Aucune vidéo n'est envoyée, nulle part.

## Pour qui

**Utilisateur payant : le kiné libéral**, en priorité le kiné du sport et le kiné orthopédique, parce que leurs patients sont motivés par un retour à la pratique et que leurs protocoles sont standardisés (genou, épaule, hanche, cheville).

**Utilisateur final : le patient**, de 16 à 70 ans, avec un smartphone. Il n'installe rien si possible, ne crée pas de compte, et n'a qu'une chose à faire : poser son téléphone et suivre l'écran.

Hors cible pour le moment : patients sans smartphone, rééducation neurologique, exercices au sol, cabinets qui veulent une intégration à leur logiciel métier.

## Ce qui fait la différence

1. **La vérification du mouvement**, pas seulement la case cochée. L'amplitude atteinte et les partielles disent au kiné ce qui s'est réellement passé.
2. **Zéro friction patient** : un SMS, un lien, pas de compte.
3. **Le respect de la vie privée par construction** : pose estimation sur l'appareil, serveur sans nom ni image.
4. **Un catalogue restreint mais fiable** : 14 exercices qui marchent, plutôt que 200 exercices approximatifs.

## Modèle économique

Abonnement par kiné : **29 € HT par mois**, patients illimités, sans engagement. Pas de facturation au patient, pas de commission sur les séances.

Hypothèses à vérifier :

- un kiné libéral avec 15 à 25 patients en rééducation active accepte 29 € par mois si l'outil lui fait gagner une séance de « re-explication » par semaine ;
- la moitié des kinés approchés préfèrent que la fonction soit intégrée à leur logiciel de cabinet plutôt qu'un abonnement séparé ; à terme, un partenariat avec un éditeur de logiciel métier est une voie de distribution ;
- le bouche-à-oreille entre kinés d'un même cabinet est le premier canal d'acquisition.

## État

Version 0.4. 8 kinés actifs, 31 patients, 412 séances enregistrées, 12 kinés en liste d'attente. Un seul développeur.

## Ce que MyKiné ne sera pas

- Un outil de télé-consultation : pas de visio, pas de messagerie.
- Un outil de diagnostic : l'app ne dit jamais au patient si son genou va bien, elle dit s'il a fait le mouvement demandé.
- Une application grand public de fitness : pas de programme sans kiné, pas d'inscription libre.

## Prochains paliers

1. Première facturation réelle, 10 kinés payants.
2. Exercices d'épaule complets (rotations, élévations sous toutes les variantes).
3. Vue cabinet (plusieurs kinés sur les mêmes patients).
4. Hébergement certifié HDS quand le volume le justifie.
5. Partenariat avec un éditeur de logiciel de cabinet.
