# CreaFlow / tellovo — 12 posts d'affilée

Banc pointeurs, gpt-6-luna, 2026-10-22. Ligne de temps : 581 pointeurs (43 documents, 966 688 caractères), 350 datés.
Le rédacteur choisit lui-même ses pointeurs ; chaque post reçoit la liste des posts précédents et peut les relire.

---

## Post 1

*21 s · 3 tours · 4 read_file · 0 read_post · 659 caractères*

Pointeurs : 2026-10-16 · docs/PRODUCT.md:25 — 2026-10-19 · docs/DEVLOG.md:76

Si tu es développeur indépendant, tu connais peut-être le décalage : tu avances sur ton produit, tu prends des notes, tu prends des décisions… puis la semaine passe et rien ne se retrouve en ligne.

Je construis CreaFlow pour partir de cette matière-là — notes, specs, devlog, décisions — et la transformer en posts. Pas besoin de demander à une IA d’imaginer ce qui s’est passé : CreaFlow écrit à partir de ce qu’on lui a réellement donné, sans inventer les faits manquants.

Mon cap tient en une phrase : « Publier ce que je construis sans y passer mes soirées. »

Je commence à partager ici le chantier de CreaFlow, et ce que j’apprends en le construisant.

---

## Post 2

*14 s · 4 tours · 1 read_file · 1 read_post · 684 caractères*

Pointeurs : 2026-10-21 · docs/DEVLOG.md:97

En construisant CreaFlow, j’ai passé deux jours à resserrer un prompt parce que les posts générés ressemblaient à des rapports à rubriques.

J’ai comparé six versions sur les mêmes trois événements. Le brief donnait déjà une histoire prémâchée en champs — et le modèle la transformait en formulaire. Puis j’ai changé une seule variable : le modèle.

Sur ce banc d’essai, les paragraphes étiquetés sont passés de 6 sur 17 à 0 sur 12. Les détails humains conservés, de 2 sur 10 à 6 sur 10.

La leçon pour moi : quand un résultat ne va pas, ajouter des règles au prompt n’est pas forcément la bonne réponse. Il faut aussi regarder ce qu’on donne au modèle — et tester le modèle lui-même.

---

## Post 3

*18 s · 4 tours · 4 read_file · 2 read_post · 815 caractères*

Pointeurs : non daté · docs/DEVLOG.md:107 — non daté · docs/DEVLOG.md:108 — non daté · docs/DEVLOG.md:109 — 2026-10-21 · docs/DEVLOG.md:118

Dans mon dernier post, je parlais du modèle. En regardant les essais de plus près, j’ai trouvé un autre problème, juste avant lui : le brief faisait déjà le travail du rédacteur.

Il recevait cinq éléments pré-rédigés pour un événement. Il avait aussi le document source sous les yeux — et pourtant, il traduisait le résumé. Cinq champs finissaient par donner cinq paragraphes, parfois avec leur étiquette.

J’ai donc raccourci le brief et remplacé les exemples fictifs du prompt par de vrais posts de l’auteur. Sur trois posts, les paragraphes étiquetés sont passés de 9 à 1.

Ça m’a rappelé une chose en construisant CreaFlow : si on veut partir de la matière vécue, il faut éviter de la prémâcher jusqu’à ce qu’elle ressemble déjà à un formulaire. Sinon, l’IA ne raconte pas le chantier — elle remplit les cases.

---

## Post 4

*16 s · 4 tours · 5 read_file · 3 read_post · 664 caractères*

Pointeurs : 2026-10-21 · docs/DEVLOG.md:165

J’ai changé une règle de CreaFlow : le premier post n’a pas besoin d’être accroché à un événement du dépôt.

Pour un développeur indépendant, commencer à publier peut aussi vouloir dire expliquer pourquoi on choisit de montrer son chantier — pas seulement annoncer une fonctionnalité livrée.

Mais cette raison ne se déduit pas d’un README. J’ai testé une origine générée sans cette information : elle a simplement recopié le problème et la description du produit. Une plaquette, pas une voix.

Alors CreaFlow demande maintenant pourquoi tu veux construire en public. Le dépôt peut raconter ce que tu fais ; le « pourquoi je le partage », c’est à toi de le donner.

---

## Post 5

*29 s · 7 tours · 9 read_file · 4 read_post · 698 caractères*

Pointeurs : 2026-10-18 · commit-log.txt:48 — 2026-10-18 · docs/SPEC_ANIMATION_HTML_LIBRE.md:3 — 2026-10-18 · docs/SPEC_ANIMATION_HTML_LIBRE.md:105

Une animation générée peut avoir une bonne idée et être illisible : texte qui se chevauche, contraste raté, premier écran presque vide.

En construisant CreaFlow, j’ai testé deux façons de repérer ces défauts. Le modèle qui regarde ses propres images en corrigeait peu. Un essai de rendu dans le navigateur, lui, relevait les problèmes avec leurs coordonnées — assez précis pour demander une correction au bon endroit.

Mais une correction peut en créer une autre. Dans l’application, je limite donc les reprises à deux et je garde la page la moins mauvaise plutôt que de ne rien livrer.

Ma leçon : pour vérifier un résultat généré, « regarde si c’est bon » ne remplace pas une mesure exploitable.

---

## Post 6

*21 s · 4 tours · 5 read_file · 2 read_post · 627 caractères*

Pointeurs : 2026-10-21 · docs/DEVLOG.md:165

Un post LinkedIn et sa version X peuvent avoir des formats différents. Mais ils devraient raconter la même histoire.

En testant le parcours `/start` de CreaFlow, j’ai repéré un défaut : le premier post est écrit sans plan narratif. Le plan est calculé ensuite pour le second réseau. Résultat possible : deux versions qui ne racontent pas la même chose.

Ce n’est pas corrigé pour l’instant. Mais ça m’a rappelé qu’adapter un post à un réseau ne devrait pas vouloir dire changer son fil conducteur.

C’est un détail de génération qui compte : quand tu publies sur plusieurs réseaux, tu veux adapter la forme, pas perdre le fil.

---

## Post 7

*24 s · 6 tours · 8 read_file · 6 read_post · 748 caractères*

Pointeurs : 2026-10-17 · docs/SPEC_RYTHME_DES_SERIES.md:3 — 2026-10-17 · docs/SPEC_RYTHME_DES_SERIES.md:5

J’ai créé une deuxième série pour mon devlog, avec un poids de 50 %. Elle n’a obtenu aucun créneau.

Le calendrier se remplissait une fois par mois : les séries se partageaient les jours disponibles au prorata, et en créer une nouvelle ne changeait pas le mois déjà planifié. Le « 50 % » était aussi une abstraction peu utile : je pense plutôt « le devlog, le mercredi ».

J’ai donc remplacé les poids par un rythme propre à chaque série : ses jours, chaque semaine ou une semaine sur deux. Le calendrier se met à jour en continu sur 28 jours, et chaque série a sa propre ligne.

Quand tu alternes plusieurs sujets — produit, devlog, autre projet — la cadence devrait être lisible et choisie série par série, pas calculée à partir d’un pourcentage.

---

## Post 8

*33 s · 5 tours · 7 read_file · 7 read_post · 858 caractères*

Pointeurs : 2026-08-16 · commit-log.txt:228 — 2026-08-16 · commit-log.txt:230 — non daté · docs/SPEC_EVENEMENTS_PAR_CIBLE.md:15 — non daté · docs/SPEC_EVENEMENTS_PAR_CIBLE.md:41 — non daté · docs/SPEC_EVENEMENTS_PAR_CIBLE.md:42

Lors d’un essai de CreaFlow pour un public de kinés, les premiers posts parlaient d’API, de mesures à 10 Hz et de JWT.

Les faits étaient bien dans les documents. Mais ils avaient été triés pour ce public après leur extraction — sans se demander ce qu’ils changeaient pour lui. Résultat : des détails techniques, pas des posts utiles à cette série.

J’ai changé la logique : CreaFlow garde le fait une seule fois, puis cherche, dès la lecture, ce qu’il signifie pour chaque public. Un fait qui ne compte pour personne ne part dans aucune série. Et un document technique n’est pas écarté d’office : il peut contenir une conséquence très concrète pour le lecteur.

Quand tu construis pour plusieurs publics, le défi n’est pas de trouver une idée différente pour chacun. C’est de raconter le même chantier dans les mots et avec les enjeux qui comptent pour eux.

---

## Post 9

*30 s · 7 tours · 11 read_file · 8 read_post · 624 caractères*

Pointeurs : non daté · docs/SPEC_ENTREE_PAR_LE_REPO.md:107

Un lien de connexion par email peut être consommé avant que la personne clique.

En construisant le démarrage de CreaFlow, j’ai prévu que le lien ne soit pas brûlé par un scanner qui vérifie les URL des emails. Si le simple chargement de la page consommait le jeton, la personne pourrait arriver trop tard sur son propre lien.

J’ai séparé les deux gestes : le GET affiche la page, puis une requête POST déclenchée à son ouverture consomme le jeton et connecte la personne.

Petit détail d’auth, gros effet sur la première impression : un lien magique doit fonctionner pour l’humain, pas seulement être valide dans un email.

---

## Post 10

*22 s · 5 tours · 7 read_file · 9 read_post · 756 caractères*

Pointeurs : 2026-10-21 · docs/DEVLOG.md:155

Un bout de code peut être inutile au produit et pourtant encore servir ailleurs.

En faisant le ménage dans CreaFlow, j’ai supprimé des champs et des fonctions qui n’étaient plus utilisés pour écrire les posts. Mais j’ai gardé une table qui semblait morte : l’export RGPD la lit encore.

J’ai aussi laissé certaines colonnes en place parce que la convention du projet est de les marquer comme retirées, pas de les migrer, et conservé une ancienne valeur d’enum encore présente sur des posts enregistrés.

La leçon pour moi : avant de supprimer du code, chercher ses usages au-delà du parcours principal — exports, données existantes, conventions de migration. « Plus utilisé par la fonctionnalité » ne veut pas toujours dire « sans conséquence à retirer ».

---

## Post 11

*22 s · 4 tours · 7 read_file · 3 read_post · 802 caractères*

Pointeurs : non daté · docs/DEVLOG.md:169 — non daté · docs/DEVLOG.md:171 — non daté · docs/DEVLOG.md:173

Un dépôt Git peut contenir des dizaines de fichiers sans répondre à la question : pourquoi veux-tu raconter ce que tu construis ?

J’ai essayé CreaFlow sur un dépôt avec 47 fichiers de documentation, mais sans devlog. Les commits étaient datés, mais leurs messages décrivaient des changements d’interface sans enjeu : aucun événement à raconter. En fouillant la doc, le système a trouvé 112 réglages — beaucoup de matière, pas forcément une histoire.

Et quand j’ai généré le post d’origine avec seulement la fiche produit, le résultat en reprenait le problème et la description. Une brochure, pas la raison personnelle de se lancer en public.

Alors j’ai ajouté cette question à /start. Le dépôt peut aider à raconter ce qui a changé. Il ne peut pas répondre à ta place à pourquoi tu veux le partager.

---

## Post 12

*29 s · 7 tours · 12 read_file · 11 read_post · 635 caractères*

Pointeurs : 2026-10-19 · docs/SPEC_PERFORMANCE.md:56 — 2026-10-19 · docs/SPEC_PERFORMANCE.md:132

Lundi à 00:58, l’écran Performance de CreaFlow affichait 0 et −100 %.

La semaine venait juste de commencer. Ce n’était pas une chute d’audience : les chiffres du post le plus récent n’étaient pas encore arrivés.

J’ai changé le comportement : sans chiffres récupérés, pas de pourcentage ni de faux zéro. Et si un post a moins de trois jours, l’écran indique que les vues continuent d’arriver au lieu de conclure que la semaine est mauvaise.

Quand tu construis un tableau de bord pour ton produit, afficher une donnée trop tôt peut être pire que ne rien afficher. Un chiffre n’aide que si on sait s’il est déjà assez mûr pour être lu.

---
