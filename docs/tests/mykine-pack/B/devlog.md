# Devlog MyKiné

Notes pour moi. Une entrée quand il se passe quelque chose, pas tous les jours.

## 2025-11-09

Bière avec Julien. Il dit qu'environ 6 patients sur 10 ne font pas leurs exercices à la maison, et qu'il n'a aucun moyen de le savoir à part leur demander, et qu'ils mentent. Il a 40 patients en cours. Il me demande si « ton truc de caméra » (le proto de pose estimation du Lab) pourrait compter les squats.

## 2025-11-16

Page web, MediaPipe Pose en JS, un compteur de squats basé sur l'angle hanche-genou-cheville sous 100°. Ça marche sur mon laptop. Sur l'iPhone 11 de Julien : 6 fps, le compteur rate une répétition sur trois. Il a quand même fait 20 squats dans son salon pour tester.

## 2025-11-23

Testé l'envoi des frames au serveur pour faire tourner le modèle là-bas. 300 à 600 ms de latence sur sa 4G. Et je me suis rendu compte que je stockais des images de lui en caleçon sur mon VPS. Décision : tout sur le téléphone. Voir decisions.md.

## 2025-12-06

Angle de flexion du genou calculé correctement (produit scalaire hanche→genou, cheville→genou). Seuils : haut > 160°, bas < 100°. Problème : quand on tremble en bas, l'angle passe trois fois autour de 100° et ça compte trois. Pas corrigé.

## 2025-12-20

Julien m'envoie une liste de 9 exercices qu'il prescrit le plus. 4 sont debout, 5 au sol. Je ne sais pas faire les exercices au sol pour l'instant, je commence par les 4 debout.

## 2026-01-11

Passage à Expo. Premier build Android sur mon Pixel 7 avec TFLite et le modèle BlazePose lite : 24 fps. Sur le vieux Pixel 4a que j'ai racheté 60 € pour ça : 15 fps. L'iPhone de Julien, je n'ai pas encore de build iOS.

## 2026-01-18

Julien dit que la moitié de ses patients post-opératoires ont plus de 70 ans et pas de smartphone. Commandé un Raspberry Pi 5, une Camera Module 3 et un écran 7". 94 € en tout. Idée : une boîte à poser sur un meuble.

## 2026-02-01

FastAPI + Postgres. Tables kines, patients, programs, program_exercises, exercises, sessions, session_exercises. Le kiné crée un programme, choisit des exercises avec un nombre de séries et de répétitions.

## 2026-02-07

Pas de compte patient. Un SMS avec un lien et un code à 6 lettres. Le lien ouvre l'app si elle est installée, sinon une page web qui dit d'installer l'app (pas de pose dans le navigateur mobile, trop lent).

## 2026-02-15

Julien a créé son premier programme sur le dashboard (version moche) en 11 minutes, dont 6 à chercher comment mettre 3 séries. Il m'a envoyé un SMS à lui-même et a fait la séance. 12 squats comptés sur 12. Il était content. Sur le Pixel 7.

## 2026-02-22

Le Pi 5 tient 11 fps avec le modèle lite. L'écran 7" est trop petit pour voir le squelette à 2 mètres. Je me demande qui va configurer le wifi chez une dame de 78 ans.

## 2026-03-07

Démo au cabinet, Julien et Marion, entre deux patients. Marion se met de profil, comme on fait un squat en cabinet, et le squelette saute : le genou arrière est caché par le genou avant, le modèle le place n'importe où, l'angle part à 40°, le compteur compte une répétition qui n'existe pas. Elle a arrêté au bout de 40 secondes : « je ne peux pas donner ça à un patient ». Julien a trouvé l'app lente (c'est le Pixel 4a que j'avais apporté). Ils ont tous les deux dit non au boîtier avant même que je le sorte du sac : « je ne vais pas prêter une boîte à un patient », « qui la récupère ».

Je suis rentré en vélo sans musique.

## 2026-03-14

Deux décisions. Le boîtier est abandonné. La caméra à 45° est obligatoire : avant la séance, l'app demande de se placer de trois quarts et vérifie que les 4 points hanches/genoux sont visibles avec une confiance > 0,6 pendant 2 secondes. Testé sur moi : ça marche, c'est chiant les trois premières fois, après on sait où poser le téléphone.

## 2026-03-21

Le modèle lite vibre de ± 6° en bas du squat. C'est lui qui fait compter double, pas seulement le tremblement. Essayé le modèle full : stable, mais 9 fps sur le Pixel 4a.

## 2026-04-05

Modèle full partout, et on saute une image sur deux quand on passe sous 12 fps. Ajouté une hystérésis de 8° sur les seuils : on ne passe en « bas » qu'à 92°, et on ne repasse en « montée » qu'à 108°. Fini le compte double sur mes propres squats.

## 2026-04-12

Samedi au cabinet avec Julien, fermé. On a filmé 120 répétitions (squat, fente, élévation latérale) avec le téléphone posé à 45°, lui et moi, en comptant à la main. Avant hystérésis : 22 répétitions comptées en trop sur 120, 18 %. Après : 5, 4 %. Les 5 restantes sont toutes sur la fente, quand le genou arrière touche presque le sol et remonte à moitié.

## 2026-04-26

Dashboard kiné : liste des patients, programme, dernière séance. Toujours moche. Julien s'en fiche de moche.

## 2026-05-12

Pilote 1. Julien a donné le lien à 5 patients, tous entre 30 et 55 ans, tous avec un smartphone Android (j'ai toujours pas de build iOS).

## 2026-05-26

Bilan deux semaines : 3 patients sur 5 ont fait au moins une séance. 2 n'ont jamais ouvert le lien. Un des 3 a fait 6 séances. Julien a demandé à une patiente ce qu'elle en pensait : « je ne sais pas si je le fais bien ». Elle voyait le compteur monter, c'est tout.

## 2026-06-02

J'ai voulu enregistrer des vidéos de séance en opt-in pour comprendre les faux positifs. Julien : « je n'aurai jamais le temps de les regarder ». Et moi je n'ai pas envie d'avoir des vidéos de gens chez eux sur un serveur. Décision : jamais de vidéo. On garde les angles à 10 Hz. Pour déboguer, je me filme moi.

## 2026-06-15

Plein temps sur MyKiné depuis le 1er. Première semaine : j'ai refait le dashboard. Deuxième : j'ai lu de la doc RGPD. Je n'ai rien produit d'utile pour un patient.

## 2026-06-21

Feedback couleur : la cuisse est dessinée en vert dans la cible, orange proche, rouge hors cible. Pas de chiffre à l'écran. Testé sur Julien : il a tout de suite corrigé son squat sans que je dise rien.

## 2026-06-28

Julien me transfère un message d'un patient du pilote : « c'est la première fois que je fais mes exercices toute la semaine ». Il a fait 7 séances en 7 jours. Il a 52 ans, prothèse de genou en avril.

## 2026-07-06

Taux d'adhésion par patient sur le dashboard : séances faites / séances prescrites. Julien dit que c'est le seul chiffre qu'il regarde.

## 2026-07-13

Marion a rejoint le pilote. Deux kinés du groupe Facebook « Kinés du sport France » aussi, après que Julien a posté une capture. Pilote 2 : 4 kinés, 19 patients au total.

## 2026-07-20

Prix testé en vrai : 29 € HT par mois par kiné, patients illimités. Julien et un des deux du groupe : oui. Marion : « ça devrait être dans mon logiciel » (elle utilise Vega). Le quatrième : « je paie déjà trop d'abonnements ». 2 sur 4.

## 2026-08-03

Juillet calme : les kinés sont en vacances, les patients aussi. 11 séances en deux semaines sur 19 patients.

## 2026-08-17

Élévation latérale de l'épaule : quand le bras monte, il passe devant le tronc et le coude disparaît. Le modèle le devine, mal. Déplacé le point de mesure sur le poignet plutôt que le coude, et demandé de se mettre un peu plus de face (30° au lieu de 45°) pour cet exercice. Ça tient.

## 2026-08-30

Trois semaines sur les exercices au sol (pont fessier, gainage, relevé de jambe). Dès que le dos touche le sol, le modèle perd le bassin et place les hanches derrière la cuisse. Essayé : caméra posée au sol, recadrage, modèle heavy (4 fps). Rien de fiable. Les 3 exercices sortent de la v0.4. Marion garde ses lombalgies sur papier.

## 2026-09-08

Posté moi-même dans « Kinés du sport France » : une vidéo de 20 secondes de Julien qui fait un squat avec la cuisse qui passe au vert. 12 kinés ont demandé un accès en 4 jours. Je n'ai pas de quoi les onboarder, j'ai mis une liste d'attente.

## 2026-09-14

iOS. TFLite via un dev client Expo. Trois jours. Le modèle charge, la caméra ne donne pas les frames dans le bon format, j'ai fini par convertir en CPU, 7 fps sur l'iPhone 11 de Julien. Pas livrable. Encore Android seulement.

## 2026-09-21

Mise à jour Expo SDK pour essayer de régler iOS : la caméra Android ne rend plus rien, écran noir. Retour arrière, une journée perdue.

## 2026-10-03

Devis HDS : entre 150 et 400 € par mois. Je fais 232 € de revenu mensuel. Décision : anonymiser. Pas de nom côté serveur, un pseudonyme par patient choisi par le kiné, numéro de téléphone haché après l'envoi du SMS. Julien a appelé sa première patiente « Lapin bleu ».

## 2026-10-10

v0.4. 8 kinés actifs, 31 patients, 412 séances enregistrées depuis mai. 12 en liste d'attente. Toujours pas d'iOS. Toujours 14 exercices, tous debout.
