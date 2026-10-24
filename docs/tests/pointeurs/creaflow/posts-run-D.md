# creaflow — posts du banc pointeurs

Modèle : gpt-6-luna. Ligne de temps : 581 pointeurs, 350 datés.
Le rédacteur choisit lui-même ses pointeurs ; il reçoit la liste des posts précédents et peut les relire.

---

# Run D — variation de forme + accroche + aucun post mort + porte d'entrée

12 posts · paragraphes : 4, 4, 3, 4, 4, 4, 4, 4, 4, 3, 4, 4 · longueur moyenne 822 caractères (640–967) · 28 pointeurs utilisés, 1 repris par deux posts

## Post 1

*42 s · 5 tours · 8 read_file · 0 read_post · 758 caractères*

Pointeurs : 2026-10-21 · docs/DEVLOG.md:97

Deux jours pour comprendre pourquoi mes posts générés ressemblaient à des inventaires.

Chaque règle ajoutée pour les améliorer ressortait comme une nouvelle rubrique. Pourtant, la matière était bien réelle : des événements tirés d’un devlog. Le problème n’était pas le manque d’idées. C’était de transformer le travail documenté en quelque chose qu’on a envie de publier.

Je construis CreaFlow pour les développeurs indépendants et les fondateurs qui ont déjà des notes, des specs, des décisions et un journal de chantier — mais pas envie de passer leurs soirées à en faire des posts. CreaFlow part de cette matière et n’invente pas les faits qui manquent.

Je commence à partager le chantier ici pour publier ce que je construis sans y passer mes soirées.

## Post 2

*14 s · 4 tours · 3 read_file · 1 read_post · 888 caractères*

Pointeurs : 2026-10-21 · docs/DEVLOG.md:165

47 fichiers de documentation, et pas une seule raison de publier.

Sur un dépôt essayé dans CreaFlow, les commits donnaient huit jours d’activité, mais rien d’assez parlant pour devenir un événement. La documentation, elle, contenait 112 réglages sans date. Beaucoup de matière — mais pas la réponse à « pourquoi partager le chantier ? »

J’ai testé une origine à partir de la seule fiche produit. Résultat : deux phrases qui répétaient le problème et la description. Une machine peut lire ce que tu construis ; elle ne peut pas deviner pourquoi tu veux le montrer.

C’est pour ça que CreaFlow, l’outil qui transforme les notes, specs et devlogs des développeurs indépendants en posts, demande aussi cette raison directement à la personne qui construit. Le but n’est pas de fabriquer une histoire à ta place, mais de rendre publiable celle que tes documents ne peuvent pas raconter seuls.

## Post 3

*18 s · 4 tours · 3 read_file · 2 read_post · 811 caractères*

Pointeurs : 2026-10-21 · docs/DEVLOG.md:118 — 2026-10-21 · docs/DEVLOG.md:155

54 événements sur 69 n’avaient rien dans la case « enjeu ».

Cette case devait expliquer ce qui était en jeu. Mais quand elle était remplie, elle contenait souvent une interprétation au lieu d’un détail réel. Dans un exemple, la source disait que des images d’une personne en caleçon étaient stockées sur un VPS — un serveur privé en ligne. Le résumé de l’événement disait seulement que des images étaient stockées sur le serveur. Le fait était là ; ce qui le rendait racontable avait disparu.

J’ai supprimé cette couche de résumé. CreaFlow transforme les notes, specs et devlogs des développeurs indépendants en posts, mais il doit raconter la matière qu’on lui donne, pas lisser les détails ni inventer une explication à leur place. La fidélité, parfois, tient à quelques mots qu’un résumé juge dispensables.

## Post 4

*17 s · 4 tours · 8 read_file · 3 read_post · 845 caractères*

Pointeurs : 2026-10-21 · docs/SPEC_EVENEMENTS_PAR_CIBLE.md:7

« Le serveur ne reçoit que des degrés » : le même fait ne raconte pas la même chose à un développeur et à un kiné.

Dans la documentation de MyKiné, il est écrit que rien de ce que filme le téléphone n’en sort, et que le serveur ne reçoit que des degrés. Pour un développeur, c’est une décision technique. Pour un kiné, le point concret est que les images du patient restent sur le téléphone.

Le fait ne change pas. Ce qui change, c’est la personne à qui on le raconte.

C’est le principe que je construis dans CreaFlow : transformer les notes, specs et devlogs d’un indépendant en posts qui parlent à son lecteur. Les faits restent dans une seule ligne de temps ; chaque événement n’est retenu pour une série que s’il change quelque chose pour son public. Pas besoin d’inventer un angle : il faut trouver celui qui existe déjà dans la matière.

## Post 5

*22 s · 4 tours · 8 read_file · 4 read_post · 967 caractères*

Pointeurs : 2026-10-21 · docs/DEVLOG.md:97 — non daté · docs/DEVLOG.md:129 — non daté · docs/DEVLOG.md:137

Même brief, mêmes 3 événements : le modèle a gardé 2 détails humains sur 10, puis 6 sur 10.

Je comparais deux moteurs d’IA sur les mêmes passages du devlog — le journal de chantier d’un projet — sans toucher au reste. Dans une phrase, le détail était le mot « quand même » : « il a quand même fait 20 squats dans son salon ». Il n’est sorti d’aucun des six essais avec le premier modèle, puis dès le premier essai avec l’autre.

Les paragraphes qui sonnaient comme des rubriques sont aussi passés de 6 sur 17 à zéro sur 12. Mais ce test ne prouve pas qu’un modèle est meilleur partout. Il m’a surtout rappelé qu’ajouter des consignes n’est pas toujours la bonne réponse à un post qui sonne faux.

CreaFlow transforme les notes, specs et devlogs des développeurs indépendants en posts. Le modèle aide à raconter la matière ; il ne choisit pas à lui seul quels moments méritent d’être publiés. Cette sélection, elle aussi, doit partir de ce qui s’est réellement passé.

## Post 6

*39 s · 6 tours · 15 read_file · 5 read_post · 784 caractères*

Pointeurs : 2026-10-19 · docs/DEVLOG.md:76 — 2026-10-19 · docs/SPEC_PERFORMANCE.md:2 — 2026-10-19 · docs/SPEC_PERFORMANCE.md:189

Lundi, à 00 h 58, mon écran affichait −100 %.

Ce n’était pas une chute des performances : la nouvelle semaine venait de commencer et aucun chiffre n’était encore arrivé. Le tableau comparait quand même ce zéro provisoire à la semaine précédente — et transformait une absence de données en mauvaise nouvelle.

J’ai changé la règle : pas de pourcentage tant que la semaine n’a aucun chiffre. Et si le post le plus récent a moins de trois jours, l’écran indique combien de temps attendre avant de comparer.

Je construis CreaFlow pour les développeurs indépendants qui veulent transformer leurs notes, specs et devlogs en posts sans y passer leurs soirées. Le suivi doit être aussi honnête que l’écriture : si les vues ne sont pas encore là, mieux vaut le dire que faire parler un zéro.

## Post 7

*21 s · 6 tours · 8 read_file · 6 read_post · 640 caractères*

Pointeurs : non daté · docs/DEVLOG.md:11 — non daté · docs/DEVLOG.md:16

Un robot peut utiliser ton lien de connexion avant toi.

Quand un service mail vérifie les liens d’un message, il peut ouvrir celui qui sert à se connecter. Si cette simple ouverture consomme le lien à usage unique, le vrai destinataire arrive trop tard.

Pour CreaFlow, l’outil que je construis pour transformer les dépôts GitHub publics des développeurs indépendants en posts, j’envoie le premier post par e-mail avec un lien de connexion. J’ai fait en sorte que le lien ne soit consommé qu’après l’ouverture de la page et la confirmation, pas quand le service mail vérifie le message.

Le robot peut regarder. Le lien reste au fondateur.

## Post 8

*18 s · 3 tours · 3 read_file · 3 read_post · 883 caractères*

Pointeurs : 2026-10-21 · commit-log.txt:1 — 2026-10-21 · docs/SPEC_FIL_NARRATIF.md:8 — non daté · docs/DEVLOG.md:171 — non daté · docs/DEVLOG.md:173

47 fichiers de documentation. Zéro événement racontable.

J’ai testé CreaFlow en lui donnant le dépôt d’un projet. Il a bien lu le journal des commits, mais les changements décrivaient des titres et des liens — rien qui dise ce qui était en jeu. En fouillant ensuite les documents, il a trouvé 112 réglages sans date. Beaucoup de matière, mais pas de quoi prétendre qu’un moment important s’était produit.

Et quand j’ai fait écrire le post d’origine à partir de la seule fiche produit, il a simplement reformulé le problème et la description. Une plaquette, pas une raison de construire en public.

CreaFlow transforme les dépôts GitHub, notes et devlogs des développeurs indépendants en posts. Mais il ne peut pas deviner pourquoi quelqu’un publie : cette réponse doit venir de la personne. La mienne tient en une phrase : « Publier ce que je construis sans y passer mes soirées. »

## Post 9

*23 s · 5 tours · 7 read_file · 8 read_post · 946 caractères*

Pointeurs : 2026-10-19 · docs/SPEC_PERFORMANCE.md:75 — 2026-10-19 · docs/SPEC_PERFORMANCE.md:194

Un post mal rattaché peut fausser tes stats — et, dans cette version, le lien ne se défait pas.

CreaFlow compare la date et le texte d’un post publié avec les posts prévus dans son calendrier. J’ai choisi de ne pas laisser une simple « meilleure correspondance » décider : l’association se fait automatiquement seulement si le score est élevé, s’il dépasse nettement le deuxième candidat, et si la date comme le texte concordent. Sinon, CreaFlow demande confirmation.

Une fois le post correctement relié, son statut passe automatiquement à « Posted ». Pas besoin de revenir cocher une case. Mais comme il n’existe pas encore de bouton pour défaire une association, l’automatisation doit d’abord savoir quand s’arrêter.

CreaFlow aide les développeurs indépendants à transformer leurs notes, specs et devlogs en posts, puis à suivre ceux qu’ils publient. Pour moi, une statistique utile commence par le bon post — pas par une supposition rapide.

## Post 10

*42 s · 8 tours · 13 read_file · 9 read_post · 836 caractères*

Pointeurs : 2026-10-20 · commit-log.txt:11 — 2026-10-20 · commit-log.txt:13 — 2026-10-20 · commit-log.txt:14 — 2026-10-17 · docs/SPEC_REDACTEUR_PAR_EVENEMENTS.md:3

3 brouillons maximum : c’est la limite que j’ai donnée au relecteur de CreaFlow.

CreaFlow transforme les notes, specs et devlogs d’un développeur indépendant en posts. Mais un texte peut être correct et pourtant perdre la personne à qui il s’adresse. Alors, après le premier jet, un rôle de relecture distinct du rédacteur le juge comme ce lecteur : est-ce qu’il continue après la deuxième phrase ? Va-t-il jusqu’au bout ? Apprend-il quelque chose ? Est-ce que ça sonne comme l’auteur, ou comme un service marketing ?

Si le brouillon ne tient pas, le relecteur nomme le problème en une ligne et le rédacteur recommence. Pas une boucle infinie : trois essais au plus. Je veux que CreaFlow vérifie non seulement si un post respecte ses règles, mais aussi s’il mérite d’être lu — sans inventer de détails pour le rendre plus convaincant.

## Post 11

*19 s · 4 tours · 5 read_file · 5 read_post · 776 caractères*

Pointeurs : non daté · docs/SPEC_ENTREE_PAR_LE_REPO.md:42 — non daté · docs/SPEC_ENTREE_PAR_LE_REPO.md:43 — non daté · docs/SPEC_ENTREE_PAR_LE_REPO.md:44 — non daté · docs/SPEC_ENTREE_PAR_LE_REPO.md:157

1 min 20 mesurée en dev, entre l’adresse e-mail et le premier post prêt.

Le test portait sur un petit dépôt : 3 documents et 13 événements à raconter. Ce n’est pas une promesse de délai pour tous les projets, mais ça m’a permis de mesurer le parcours réel.

Avec CreaFlow, les développeurs indépendants peuvent partir de leur dépôt GitHub public pour transformer leurs notes et leur historique de construction en posts. Au lieu de remplir six écrans avant de voir le résultat, tu donnes ton e-mail et reçois le premier post quand il est prêt. En ouvrant le lien, les deux autres posts de la semaine se lancent dans l’application.

Je voulais que le premier contact avec CreaFlow soit déjà un brouillon concret — pas une nouvelle tâche de configuration à remettre à plus tard.

## Post 12

*41 s · 7 tours · 15 read_file · 11 read_post · 733 caractères*

Pointeurs : 2026-10-21 · docs/PROMPTS.md:1426 — 2026-10-21 · docs/PROMPTS.md:1460

J’ai retiré la poterie, le bateau et la ruche du prompt de CreaFlow.

C’étaient trois exemples fictifs pour montrer au modèle comment écrire. Trop courts, sans contexte ni étiquette, ils lui enseignaient surtout une forme répétitive — exactement celle que je cherchais à éviter.

Je les ai remplacés par trois vrais posts de l’auteur. La consigne : en tirer le niveau de précision et le rythme, sans reprendre leurs accroches, leur structure ni leurs tournures.

CreaFlow transforme les notes, specs et devlogs des développeurs indépendants en posts. Les exemples peuvent aider une IA à écrire, mais ils peuvent aussi lui donner un moule. Je veux qu’elle apprenne le soin, pas qu’elle serve le même post avec trois décors différents.
