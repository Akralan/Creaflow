# Devlog MyKiné — octobre 2026 (suite)

Notes pour moi. Même règle que le devlog : une entrée quand il se passe quelque chose.

## 2026-10-11

Lu l'article de Simon Willison sur les agents qui notent leur propre travail. Il dit qu'un modèle qui s'évalue lui-même trouve toujours que c'est bien. C'est exactement ce que je fais avec le compteur : je filme, je compte à la main, je compare. Le modèle ne se juge jamais seul. Je garde ça comme règle pour le détecteur d'alignement aussi.

## 2026-10-12

Vélo jusqu'à Saint-Étienne et retour, 118 km, 6 h 40. Première fois que je ne pense pas à MyKiné pendant une journée entière depuis juin. Le serveur n'a rien remarqué.

## 2026-10-13

Julien me montre un message de Mme Rouvière, 71 ans, prothèse de genou en août : « Avant je faisais mes exercices quand j'y pensais, maintenant le téléphone me dit si je descends assez. J'ai fait les 5 séances cette semaine. » Elle est la première patiente au-dessus de 70 ans. Elle utilise l'app sur un Samsung A12, 11 fps, et ça lui suffit.

## 2026-10-14

Je m'engage : 50 kinés actifs au 31 janvier 2027. On est à 8 aujourd'hui, 12 en liste d'attente. Le chemin : vider la liste d'attente avant le 15 novembre, ouvrir aux kinés du groupe Facebook en décembre, un partenariat avec une école de kiné en janvier. Je l'écris ici pour ne pas pouvoir faire semblant de ne pas l'avoir dit.

## 2026-10-15

Export CSV des séances par patient, demandé par Marion depuis juillet. Fait en une soirée. Elle l'a utilisé le lendemain pour un bilan de fin de rééducation. Dispo pour tous les kinés dans le dashboard, onglet Patients, bouton « Exporter ».

## 2026-10-16

Retour sur la décision du 30 août (retirer les exercices au sol). Six semaines après : aucun kiné n'a réclamé les exercices au sol. Deux m'ont dit qu'ils préféraient 14 exercices qui marchent à 20 dont 6 douteux. La décision tient. Je ne les remets pas au catalogue avant d'avoir un modèle qui tient le bassin au sol.

## 2026-10-17

J'ai mesuré : 17 % des séances démarrées sont abandonnées avant le premier exercice. Sur 412 séances, 70. Presque toutes sur le contrôle de l'angle caméra à 45° : le patient n'arrive pas à se placer et quitte. En septembre c'était 21 %. Ça baisse depuis que le message dit « reculez d'un pas » au lieu de « placez-vous de trois quarts ».

## 2026-10-18

Promis à Julien que le compte-rendu de séance arriverait par mail le soir même, pas le lendemain. J'ai dit vendredi. Vendredi soir, les mails sont partis à 23 h 40 au lieu de 20 h : le cron tournait en UTC et je l'avais écrit en heure de Paris. Quatre kinés ont reçu un compte-rendu au milieu de la nuit. Pas grave, mais pas ce que j'avais dit.

## 2026-10-19

Le dashboard kiné version 2 sort le lundi 3 novembre. Nouveau tableau d'adhésion par patient, filtre par programme, export CSV intégré. Les 8 kinés actifs le verront le matin même, les 12 en liste d'attente recevront leur accès le même jour. Je ne peux pas encore montrer les écrans, Marion veut valider les couleurs des taux d'adhésion.

## 2026-10-20

Je ne sais pas si je dois facturer les kinés en liste d'attente dès l'ouverture ou leur donner un mois gratuit. Pour : 2 kinés sur 4 ont déjà dit qu'ils paieraient 29 €. Contre : les 12 ne m'ont jamais vu, et un mois gratuit c'est 348 € que je ne touche pas. J'hésite depuis trois jours. Je vais demander aux 4 du pilote 2 ce qu'ils auraient préféré.

## 2026-10-21

Aux kinés du groupe « Kinés du sport France » : les 10 premiers qui m'écrivent avec le nom de leur cabinet ont trois mois à 15 € HT au lieu de 29 €, et je viens installer l'app avec leur premier patient, en visio. Jusqu'au 15 novembre. Je veux 10 cabinets qui tournent avant d'ouvrir à tous.

## 2026-10-22

Ce que les 412 séances m'ont appris : un patient qui fait sa première séance dans les 48 h après la prescription en fait en moyenne 4,1 par semaine ; celui qui attend plus de 48 h en fait 1,3. Le délai avant la première séance prédit tout le reste. Donc le SMS doit partir du cabinet, pendant la consultation, pas le soir depuis le dashboard.

## 2026-10-23

Quatre kinés en liste d'attente ont reçu leur accès ce matin, les 8 autres demain. Ça fait 12 actifs ce soir. Le chemin vers les 50 du 31 janvier commence là : il en reste 38 en 100 jours.

## 2026-10-24

Démonstration à l'école de kiné de Lyon, promo de 3e année, 42 étudiants. Trois squats de profil exprès pour montrer le squelette qui saute, puis à 45°. Une étudiante m'a demandé si l'app marchait pour les épaules. J'ai dit « pas encore bien ». Six m'ont laissé leur mail.
