# creaflow — posts du banc pointeurs

Modèle : gpt-6-luna. Ligne de temps : 581 pointeurs, 350 datés.
Le rédacteur choisit lui-même ses pointeurs ; il reçoit la liste des posts précédents et peut les relire.

---

# A — aucune règle de forme

12 posts · paragraphes : 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4 · longueur moyenne 714 caractères (624–858) · 25 pointeurs utilisés, 1 repris par deux posts

## Post 1

*21 s · 3 tours · 4 read_file · 0 read_post · 659 caractères*

Pointeurs : 2026-10-16 · docs/PRODUCT.md:25 — 2026-10-19 · docs/DEVLOG.md:76

Si tu es développeur indépendant, tu connais peut-être le décalage : tu avances sur ton produit, tu prends des notes, tu prends des décisions… puis la semaine passe et rien ne se retrouve en ligne.

Je construis CreaFlow pour partir de cette matière-là — notes, specs, devlog, décisions — et la transformer en posts. Pas besoin de demander à une IA d’imaginer ce qui s’est passé : CreaFlow écrit à partir de ce qu’on lui a réellement donné, sans inventer les faits manquants.

Mon cap tient en une phrase : « Publier ce que je construis sans y passer mes soirées. »

Je commence à partager ici le chantier de CreaFlow, et ce que j’apprends en le construisant.

## Post 2

*14 s · 4 tours · 1 read_file · 1 read_post · 684 caractères*

Pointeurs : 2026-10-21 · docs/DEVLOG.md:97

En construisant CreaFlow, j’ai passé deux jours à resserrer un prompt parce que les posts générés ressemblaient à des rapports à rubriques.

J’ai comparé six versions sur les mêmes trois événements. Le brief donnait déjà une histoire prémâchée en champs — et le modèle la transformait en formulaire. Puis j’ai changé une seule variable : le modèle.

Sur ce banc d’essai, les paragraphes étiquetés sont passés de 6 sur 17 à 0 sur 12. Les détails humains conservés, de 2 sur 10 à 6 sur 10.

La leçon pour moi : quand un résultat ne va pas, ajouter des règles au prompt n’est pas forcément la bonne réponse. Il faut aussi regarder ce qu’on donne au modèle — et tester le modèle lui-même.

## Post 3

*18 s · 4 tours · 4 read_file · 2 read_post · 815 caractères*

Pointeurs : non daté · docs/DEVLOG.md:107 — non daté · docs/DEVLOG.md:108 — non daté · docs/DEVLOG.md:109 — 2026-10-21 · docs/DEVLOG.md:118

Dans mon dernier post, je parlais du modèle. En regardant les essais de plus près, j’ai trouvé un autre problème, juste avant lui : le brief faisait déjà le travail du rédacteur.

Il recevait cinq éléments pré-rédigés pour un événement. Il avait aussi le document source sous les yeux — et pourtant, il traduisait le résumé. Cinq champs finissaient par donner cinq paragraphes, parfois avec leur étiquette.

J’ai donc raccourci le brief et remplacé les exemples fictifs du prompt par de vrais posts de l’auteur. Sur trois posts, les paragraphes étiquetés sont passés de 9 à 1.

Ça m’a rappelé une chose en construisant CreaFlow : si on veut partir de la matière vécue, il faut éviter de la prémâcher jusqu’à ce qu’elle ressemble déjà à un formulaire. Sinon, l’IA ne raconte pas le chantier — elle remplit les cases.

## Post 4

*16 s · 4 tours · 5 read_file · 3 read_post · 664 caractères*

Pointeurs : 2026-10-21 · docs/DEVLOG.md:165

J’ai changé une règle de CreaFlow : le premier post n’a pas besoin d’être accroché à un événement du dépôt.

Pour un développeur indépendant, commencer à publier peut aussi vouloir dire expliquer pourquoi on choisit de montrer son chantier — pas seulement annoncer une fonctionnalité livrée.

Mais cette raison ne se déduit pas d’un README. J’ai testé une origine générée sans cette information : elle a simplement recopié le problème et la description du produit. Une plaquette, pas une voix.

Alors CreaFlow demande maintenant pourquoi tu veux construire en public. Le dépôt peut raconter ce que tu fais ; le « pourquoi je le partage », c’est à toi de le donner.

## Post 5

*29 s · 7 tours · 9 read_file · 4 read_post · 698 caractères*

Pointeurs : 2026-10-18 · commit-log.txt:48 — 2026-10-18 · docs/SPEC_ANIMATION_HTML_LIBRE.md:3 — 2026-10-18 · docs/SPEC_ANIMATION_HTML_LIBRE.md:105

Une animation générée peut avoir une bonne idée et être illisible : texte qui se chevauche, contraste raté, premier écran presque vide.

En construisant CreaFlow, j’ai testé deux façons de repérer ces défauts. Le modèle qui regarde ses propres images en corrigeait peu. Un essai de rendu dans le navigateur, lui, relevait les problèmes avec leurs coordonnées — assez précis pour demander une correction au bon endroit.

Mais une correction peut en créer une autre. Dans l’application, je limite donc les reprises à deux et je garde la page la moins mauvaise plutôt que de ne rien livrer.

Ma leçon : pour vérifier un résultat généré, « regarde si c’est bon » ne remplace pas une mesure exploitable.

## Post 6

*21 s · 4 tours · 5 read_file · 2 read_post · 627 caractères*

Pointeurs : 2026-10-21 · docs/DEVLOG.md:165

Un post LinkedIn et sa version X peuvent avoir des formats différents. Mais ils devraient raconter la même histoire.

En testant le parcours `/start` de CreaFlow, j’ai repéré un défaut : le premier post est écrit sans plan narratif. Le plan est calculé ensuite pour le second réseau. Résultat possible : deux versions qui ne racontent pas la même chose.

Ce n’est pas corrigé pour l’instant. Mais ça m’a rappelé qu’adapter un post à un réseau ne devrait pas vouloir dire changer son fil conducteur.

C’est un détail de génération qui compte : quand tu publies sur plusieurs réseaux, tu veux adapter la forme, pas perdre le fil.

## Post 7

*24 s · 6 tours · 8 read_file · 6 read_post · 748 caractères*

Pointeurs : 2026-10-17 · docs/SPEC_RYTHME_DES_SERIES.md:3 — 2026-10-17 · docs/SPEC_RYTHME_DES_SERIES.md:5

J’ai créé une deuxième série pour mon devlog, avec un poids de 50 %. Elle n’a obtenu aucun créneau.

Le calendrier se remplissait une fois par mois : les séries se partageaient les jours disponibles au prorata, et en créer une nouvelle ne changeait pas le mois déjà planifié. Le « 50 % » était aussi une abstraction peu utile : je pense plutôt « le devlog, le mercredi ».

J’ai donc remplacé les poids par un rythme propre à chaque série : ses jours, chaque semaine ou une semaine sur deux. Le calendrier se met à jour en continu sur 28 jours, et chaque série a sa propre ligne.

Quand tu alternes plusieurs sujets — produit, devlog, autre projet — la cadence devrait être lisible et choisie série par série, pas calculée à partir d’un pourcentage.

## Post 8

*33 s · 5 tours · 7 read_file · 7 read_post · 858 caractères*

Pointeurs : 2026-08-16 · commit-log.txt:228 — 2026-08-16 · commit-log.txt:230 — non daté · docs/SPEC_EVENEMENTS_PAR_CIBLE.md:15 — non daté · docs/SPEC_EVENEMENTS_PAR_CIBLE.md:41 — non daté · docs/SPEC_EVENEMENTS_PAR_CIBLE.md:42

Lors d’un essai de CreaFlow pour un public de kinés, les premiers posts parlaient d’API, de mesures à 10 Hz et de JWT.

Les faits étaient bien dans les documents. Mais ils avaient été triés pour ce public après leur extraction — sans se demander ce qu’ils changeaient pour lui. Résultat : des détails techniques, pas des posts utiles à cette série.

J’ai changé la logique : CreaFlow garde le fait une seule fois, puis cherche, dès la lecture, ce qu’il signifie pour chaque public. Un fait qui ne compte pour personne ne part dans aucune série. Et un document technique n’est pas écarté d’office : il peut contenir une conséquence très concrète pour le lecteur.

Quand tu construis pour plusieurs publics, le défi n’est pas de trouver une idée différente pour chacun. C’est de raconter le même chantier dans les mots et avec les enjeux qui comptent pour eux.

## Post 9

*30 s · 7 tours · 11 read_file · 8 read_post · 624 caractères*

Pointeurs : non daté · docs/SPEC_ENTREE_PAR_LE_REPO.md:107

Un lien de connexion par email peut être consommé avant que la personne clique.

En construisant le démarrage de CreaFlow, j’ai prévu que le lien ne soit pas brûlé par un scanner qui vérifie les URL des emails. Si le simple chargement de la page consommait le jeton, la personne pourrait arriver trop tard sur son propre lien.

J’ai séparé les deux gestes : le GET affiche la page, puis une requête POST déclenchée à son ouverture consomme le jeton et connecte la personne.

Petit détail d’auth, gros effet sur la première impression : un lien magique doit fonctionner pour l’humain, pas seulement être valide dans un email.

## Post 10

*22 s · 5 tours · 7 read_file · 9 read_post · 756 caractères*

Pointeurs : 2026-10-21 · docs/DEVLOG.md:155

Un bout de code peut être inutile au produit et pourtant encore servir ailleurs.

En faisant le ménage dans CreaFlow, j’ai supprimé des champs et des fonctions qui n’étaient plus utilisés pour écrire les posts. Mais j’ai gardé une table qui semblait morte : l’export RGPD la lit encore.

J’ai aussi laissé certaines colonnes en place parce que la convention du projet est de les marquer comme retirées, pas de les migrer, et conservé une ancienne valeur d’enum encore présente sur des posts enregistrés.

La leçon pour moi : avant de supprimer du code, chercher ses usages au-delà du parcours principal — exports, données existantes, conventions de migration. « Plus utilisé par la fonctionnalité » ne veut pas toujours dire « sans conséquence à retirer ».

## Post 11

*22 s · 4 tours · 7 read_file · 3 read_post · 802 caractères*

Pointeurs : non daté · docs/DEVLOG.md:169 — non daté · docs/DEVLOG.md:171 — non daté · docs/DEVLOG.md:173

Un dépôt Git peut contenir des dizaines de fichiers sans répondre à la question : pourquoi veux-tu raconter ce que tu construis ?

J’ai essayé CreaFlow sur un dépôt avec 47 fichiers de documentation, mais sans devlog. Les commits étaient datés, mais leurs messages décrivaient des changements d’interface sans enjeu : aucun événement à raconter. En fouillant la doc, le système a trouvé 112 réglages — beaucoup de matière, pas forcément une histoire.

Et quand j’ai généré le post d’origine avec seulement la fiche produit, le résultat en reprenait le problème et la description. Une brochure, pas la raison personnelle de se lancer en public.

Alors j’ai ajouté cette question à /start. Le dépôt peut aider à raconter ce qui a changé. Il ne peut pas répondre à ta place à pourquoi tu veux le partager.

## Post 12

*29 s · 7 tours · 12 read_file · 11 read_post · 635 caractères*

Pointeurs : 2026-10-19 · docs/SPEC_PERFORMANCE.md:56 — 2026-10-19 · docs/SPEC_PERFORMANCE.md:132

Lundi à 00:58, l’écran Performance de CreaFlow affichait 0 et −100 %.

La semaine venait juste de commencer. Ce n’était pas une chute d’audience : les chiffres du post le plus récent n’étaient pas encore arrivés.

J’ai changé le comportement : sans chiffres récupérés, pas de pourcentage ni de faux zéro. Et si un post a moins de trois jours, l’écran indique que les vues continuent d’arriver au lieu de conclure que la semaine est mauvaise.

Quand tu construis un tableau de bord pour ton produit, afficher une donnée trop tôt peut être pire que ne rien afficher. Un chiffre n’aide que si on sait s’il est déjà assez mûr pour être lu.

---

# B — + variation de forme

12 posts · paragraphes : 3, 3, 3, 3, 3, 4, 3, 3, 4, 4, 3, 4 · longueur moyenne 624 caractères (537–746) · 22 pointeurs utilisés, 0 repris par deux posts

## Post 1

*39 s · 4 tours · 5 read_file · 0 read_post · 554 caractères*

Pointeurs : 2026-10-21 · docs/DEVLOG.md:97 — 2026-10-21 · docs/DEVLOG.md:165 — 2026-10-21 · docs/SPEC_FIL_NARRATIF.md:8

If you’re an indie developer, you probably already have material worth sharing: project notes, specs, decisions, a devlog. The hard part is turning it into posts without losing an evening—or asking a blank-page generator to make things up.

I’m building CreaFlow to turn the material you’ve actually made into posts, and to stick to what it was given. No invented milestones or plausible-sounding details.

My reason for building in public is simple: “Publish what I’m building without spending my evenings on it.” That’s the problem I’m working on, too.

## Post 2

*19 s · 4 tours · 5 read_file · 1 read_post · 600 caractères*

Pointeurs : non daté · docs/DEVLOG.md:169 — non daté · docs/DEVLOG.md:171 — non daté · docs/DEVLOG.md:173

A repo can tell CreaFlow what you built. It can’t tell it why you want to build in public.

I tested the first part on a project with 47 documentation files and no devlog. The commit log gave us zero events worth turning into posts; mining the docs found 112 undated settings instead. And when I generated an origin post without the author’s reason for publishing, it came out as two sentences repeating the product description and problem.

So /start now asks for that reason directly. Your project material can supply the evidence. The reason you’re putting the work out there has to come from you.

## Post 3

*25 s · 5 tours · 8 read_file · 2 read_post · 647 caractères*

Pointeurs : 2026-10-20 · docs/SPEC_FIL_NARRATIF.md:229

A build-in-public calendar can turn into a little factory: ship an update because it’s Friday, even when nothing meaningful changed.

I’m building CreaFlow not to create that pressure, but to help indie developers publish the material they already have. So a progress post in a series isn’t triggered by a weekly quota. It waits for actual substance: several events with something changed, and enough ordinary episodes in between. If the work hasn’t reached that point, there’s no progress post to force.

The rule came from a simple decision: a milestone post should happen when there’s a milestone worth telling—not because the schedule says so.

## Post 4

*30 s · 5 tours · 5 read_file · 3 read_post · 600 caractères*

Pointeurs : 2026-10-21 · docs/SPEC_FIL_NARRATIF.md:6

I removed a post type from CreaFlow instead of trying to improve its prompt.

The “vision” post was meant to explain where a project was headed. But its prompt had already written the backbone from the product description; real project events were only there to keep it from reading like a brochure. And a sorting bug meant it was picking undated decisions while missing the dated ones.

The useful insight: a real turning point doesn’t need a special “vision” format. It can be told as an episode, grounded in the event that actually changed the direction. So I deleted the type—and the bug with it.

## Post 5

*39 s · 4 tours · 7 read_file · 4 read_post · 537 caractères*

Pointeurs : non daté · docs/DEVLOG.md:175

Two versions of one origin post should not end up telling two different stories.

I found that the `/start` flow wrote the first network’s post without a narrative plan. Only afterwards did it calculate one for the other network. So the LinkedIn and X versions could be grounded in different story choices, even though they came from the same project and author.

That’s still an open defect in this flow. The fix isn’t to force identical copy onto both platforms; it’s to make the narrative decision once, before writing either version.

## Post 6

*24 s · 3 tours · 3 read_file · 5 read_post · 691 caractères*

Pointeurs : 2026-10-21 · docs/DEVLOG.md:118

I spent four days trimming rules from CreaFlow’s writing prompt. Then I ran the same test again, changing only the model.

Same three events, same brief. With `gpt-5-mini`, 6 of 17 paragraphs were labeled and 2 of 10 human details survived. With `gpt-6-luna`, it was 0 of 12 labeled and 6 of 10 details retained. Average length dropped from 1,044 characters to 671.

The prompt work helped: the number of rubric-like headings fell from 9 to 1. But the gap between “unacceptable” and “good” was mostly the model, not another rule I could add.

One thing the model still can’t decide for us: which moments in a founder’s material are worth turning into a post. That selection happens upstream.

## Post 7

*18 s · 4 tours · 3 read_file · 3 read_post · 612 caractères*

Pointeurs : 2026-10-21 · docs/DEVLOG.md:155

While cleaning up CreaFlow, I deleted `angleFor()` and the `angle` field from the briefs. They were calculated in two services, then never printed anywhere.

I kept `audience_angles`—but not as copy to show the model. The question behind it (“what does this fact change for this audience?”) helps decide whether an event matters at all. The audiences derived from that work also determine which series can tell it.

That’s a useful distinction for anyone building a writing tool: context doesn’t always belong in the draft. Sometimes its job is to help decide whether there’s a real post here in the first place.

## Post 8

*31 s · 6 tours · 11 read_file · 7 read_post · 651 caractères*

Pointeurs : 2026-10-18 · docs/SPEC_ANIMATION_HTML_LIBRE.md:3 — 2026-10-18 · docs/SPEC_ANIMATION_HTML_LIBRE.md:44 — 2026-10-18 · docs/SPEC_ANIMATION_HTML_LIBRE.md:105

CreaFlow’s animation editor had five effects: fade, slide, zoom, typewriter. The result looked like text slides moving around, so I replaced the fixed timeline with model-written HTML, CSS and SVG.

That freedom created a different problem: how do you export the same animation frame by frame without timing drift? The contract is `seek(ms)`: ask for the image at 3.4 seconds, get the same image every time. No timers, random numbers or wall-clock time.

The animation now plays in a sandboxed iframe, and the browser checks its start, middle and end. MP4 export is still unfinished. But making the output reproducible has to come before exporting it.

## Post 9

*43 s · 4 tours · 10 read_file · 8 read_post · 746 caractères*

Pointeurs : non daté · docs/SPEC_EVENEMENTS_PAR_CIBLE.md:10 — non daté · docs/SPEC_EVENEMENTS_PAR_CIBLE.md:41

Three CreaFlow posts in a row were about API sessions, angles sampled at 10 Hz, and 24-hour JWTs.

The intended reader was sports physiotherapists—not developers. Worse, all three posts came from one architecture document. The devlog and decisions file hadn’t even been read yet when those drafts were written.

The writer wasn’t the first problem. CreaFlow had extracted facts before it knew what those facts changed for a particular reader. I changed the reading step: dated journals and decisions come first, the reading budget accounts for the events they contain, and each event is qualified for its audience while the source is still in view.

A true fact isn’t automatically a useful post. The reader has to matter before the draft begins.

## Post 10

*31 s · 5 tours · 8 read_file · 9 read_post · 674 caractères*

Pointeurs : 2026-10-19 · docs/DEVLOG.md:76 — 2026-10-19 · docs/SPEC_PERFORMANCE.md:56

At 00:58 on a Monday, CreaFlow’s performance screen showed 0 and −100%.

Nothing had gone wrong: the new week had barely started, and there were no post metrics yet. But the comparison made an empty week look like a collapse.

I changed the screen to show dashes until the first numbers arrive, and to say “Numbers are still coming in” while a post is less than three days old. Views keep accumulating after publication, so an early verdict would be misleading.

The dashboard is built in dev; I haven’t verified its data providers against real LinkedIn and X accounts yet. Still, the display rule matters: a chart shouldn’t turn “not enough data” into “you’re doing worse.”

## Post 11

*23 s · 4 tours · 5 read_file · 10 read_post · 611 caractères*

Pointeurs : 2026-10-18 · docs/SPEC_LANGUE_DES_POSTS.md:3

The notes were in French. The profile was set to English. CreaFlow still produced 3 out of 3 posts in English.

That’s the language rule I’m building: use the creator’s chosen language when they’ve set one; otherwise, use the language of the notes. It applies to the hook, slides, body and title—not just the main paragraph—and code checks the draft and sends it back if the language is wrong.

There’s still a gap: hashtags are too short to check reliably. In the French MyKiné test pack, one post out of three kept English hashtags. So the rule is enforced across the post, but not every tiny piece of it yet.

## Post 12

*38 s · 6 tours · 7 read_file · 11 read_post · 566 caractères*

Pointeurs : non daté · docs/SPEC_ENTREE_PAR_LE_REPO.md:42 — non daté · docs/SPEC_ENTREE_PAR_LE_REPO.md:43 — non daté · docs/SPEC_ENTREE_PAR_LE_REPO.md:44

I made CreaFlow’s repo-to-post onboarding generate one post first, not a whole week.

Someone shares a public GitHub repo, checks the details CreaFlow found, and leaves an email. The first post goes in that email. The other two start generating only when they click to see them.

The reason is practical: don’t spend generation cost on people who never open the email, and get the first post to them sooner. The calendar shows the other posts loading when they ask for them.

“Generate my content” doesn’t have to mean “generate everything before I’ve seen a thing.”

---

# C — + accroche impactante + aucun post mort

12 posts · paragraphes : 5, 4, 4, 4, 5, 5, 4, 5, 4, 4, 4, 4 · longueur moyenne 816 caractères (664–1104) · 25 pointeurs utilisés, 1 repris par deux posts

## Post 1

*24 s · 3 tours · 5 read_file · 0 read_post · 1041 caractères*

Pointeurs : 2026-10-21 · docs/DEVLOG.md:97 — 2026-10-21 · docs/DEVLOG.md:165 — non daté · docs/PRODUCT.md:90

Deux jours à comprendre pourquoi mes posts ressemblaient à des inventaires.

Je testais CreaFlow, l’outil que je construis pour les devs solo qui ont des notes, des décisions et des bouts de devlog plein les dossiers — mais pas leurs soirées à transformer tout ça en posts.

J’ai comparé six versions du même brief sur les mêmes événements. Une découverte gênante : ajouter des règles au prompt ajoutait souvent des rubriques au post. Et changer de modèle a fait passer les paragraphes étiquetés de 6 sur 17 à zéro sur 12. Le texte ne s’améliore pas juste parce qu’on lui crie « raconte une histoire » plus fort.

CreaFlow doit partir de ce que tu as vraiment construit, pas d’une description générique qui laisse le générateur broder. Les faits viennent de ta matière ; s’ils n’y sont pas, ils ne devraient pas apparaître dans le post.

Je commence à partager le chantier pour une raison simple : publier ce que je construis sans y passer mes soirées. Si tu construis en public toi aussi, c’est exactement le temps que j’aimerais te rendre.

## Post 2

*26 s · 5 tours · 6 read_file · 1 read_post · 762 caractères*

Pointeurs : 2026-10-21 · docs/DEVLOG.md:155

47 fichiers de documentation, 8 jours datés dans l’historique Git, et zéro événement racontable.

C’est ce qu’a donné un essai de CreaFlow sur un dépôt sans devlog. Les commits étaient bien réels — par exemple, « titres de section simples, liens en dessous » — mais ils ne disaient pas ce qui comptait pour la personne qui construisait. En fouillant les documents, l’outil a trouvé 112 réglages, tous sans date.

Un dépôt peut montrer ce qui a changé sans pouvoir dire pourquoi tu as envie de le partager. Et quand il ne lui reste que la fiche produit, le premier post ressemble à une fiche produit.

J’ai donc ajouté une question à l’écran de démarrage : pourquoi veux-tu construire en public ? Le code peut fournir les faits. Cette raison-là doit venir de toi.

## Post 3

*22 s · 4 tours · 7 read_file · 2 read_post · 704 caractères*

Pointeurs : 2026-10-21 · docs/DEVLOG.md:165

Le premier post partait sans plan ; son jumeau pour l’autre réseau, lui, en avait un.

J’ai repéré ce décalage dans le parcours qui crée le premier post de CreaFlow : la version initiale est écrite comme un épisode, puis le système choisit un plan narratif — le rôle du post dans le fil — en préparant la version pour LinkedIn ou X.

Résultat possible : deux textes censés présenter le même projet ne racontent pas la même chose. Pour un dev solo qui veut publier sans transformer ça en deuxième boulot, le premier post est déjà assez important sans devoir réconcilier deux histoires.

Le défaut est relevé, pas encore corrigé. Le plan doit arriver avant l’écriture des deux versions, pas entre les deux.

## Post 4

*20 s · 4 tours · 9 read_file · 3 read_post · 723 caractères*

Pointeurs : non daté · docs/DEVLOG.md:143 — 2026-10-21 · docs/SPEC_FIL_NARRATIF.md:6 — 2026-10-21 · docs/SPEC_FIL_NARRATIF.md:8

0 décision datée sur 12 : mon post de vision racontait le mauvais chantier.

Je construis CreaFlow pour transformer les traces d’un projet en posts. J’avais donné à son « post de vision » — un résumé de la direction du projet — les 12 dernières décisions. Mais elles étaient triées des plus anciennes aux plus récentes, avec celles sans date à la fin : le système prenait donc les décisions sans date.

Il passait à côté de la décision récente qui comptait : anonymiser les données des patients, après un devis d’hébergement supérieur aux revenus.

J’ai fini par retirer le type de post au lieu de réparer son tri. Un vrai choix difficile se raconte mieux comme un épisode vécu que comme une vision générale plaquée dessus.

## Post 5

*20 s · 5 tours · 6 read_file · 4 read_post · 975 caractères*

Pointeurs : 2026-10-18 · docs/SPEC_ANIMATION_HTML_LIBRE.md:44 — 2026-10-18 · docs/SPEC_ANIMATION_HTML_LIBRE.md:105

Une animation inventée affichait « 13/20 ». Le post source ne disait jamais ça.

C’est l’un des ratés trouvés en testant les animations que CreaFlow peut créer à partir d’un post : un beau chiffre à l’écran peut avoir l’air crédible tout en étant faux. Pour quelqu’un qui partage son travail, ce n’est pas un détail graphique. C’est une fausse preuve.

J’ai aussi vu des textes se chevaucher, des visuels presque vides au début et du contenu caché par les boutons des réseaux. Demander au modèle de revoir ses propres images corrigeait peu. Le navigateur, lui, peut mesurer où le texte déborde et montrer précisément les images du début, du milieu et de la fin.

Alors CreaFlow renvoie ces constats au modèle pour correction — deux essais au maximum dans l’application. Et si le post ne donne aucun chiffre, l’animation doit montrer un schéma, pas en inventer un.

Un outil censé t’épargner la soirée ne devrait pas te laisser vérifier si ses jolies statistiques sont vraies.

## Post 6

*41 s · 9 tours · 13 read_file · 5 read_post · 1104 caractères*

Pointeurs : non daté · docs/SPEC_EVENEMENTS_PAR_CIBLE.md:15 — non daté · docs/SPEC_EVENEMENTS_PAR_CIBLE.md:37 — 2026-10-20 · commit-log.txt:20

Trois posts pour des kinés. Aucun ne parlait leur langue.

En testant CreaFlow, l’outil que je construis pour transformer la matière d’un projet en posts, j’ai vu les trois premiers textes parler d’une route d’API, de mesures prises dix fois par seconde et de jetons de connexion valables 24 heures. Le public choisi, lui, c’était des kinés libéraux du sport — pas des développeurs.

Le problème n’était pas que la documentation technique ne contenait rien à raconter. C’était quand le système décidait à qui un fait parlait : après la lecture, sans le document sous les yeux. Il avait même attribué des détails techniques à des kinés.

J’ai changé la logique : regarder chaque fait avec le public en tête, dès la lecture, et ne garder que ce qui change quelque chose pour lui. Une doc technique peut alors raconter un vrai choix : les vidéos de patients restent sur le téléphone ; le serveur ne reçoit que les angles mesurés.

Pour un solo dev, le même changement compte : un commit n’est pas un post parce qu’il est précis. Il le devient quand on peut dire pourquoi il importe à la personne qui le lit.

## Post 7

*25 s · 5 tours · 8 read_file · 4 read_post · 816 caractères*

Pointeurs : 2026-10-21 · commit-log.txt:1 — non daté · docs/DEVLOG.md:171 — non daté · docs/DEVLOG.md:173

47 fichiers de documentation n’ont pas répondu à la question qui compte pour un post d’origine.

Sur un dépôt de démo sans journal de développement, CreaFlow a bien repéré huit jours d’activité dans les commits — les notes de changements du code — mais aucun moment avec quelque chose en jeu. En fouillant les docs, il a trouvé 112 réglages, sans date. Beaucoup de matière ; pas encore une histoire.

Et sans les mots de l’auteur sur la raison de publier en public, le post d’origine a fait deux phrases : la description du produit, puis son problème. Une plaquette, pas une raison de suivre la construction.

J’ai donc ajouté cette question à la création du projet : pourquoi veux-tu le construire en public ? Le dépôt peut montrer ce que tu as fait. Il ne peut pas répondre à ta place pourquoi tu veux le raconter.

## Post 8

*27 s · 6 tours · 9 read_file · 7 read_post · 821 caractères*

Pointeurs : 2026-10-21 · docs/DEVLOG.md:118

J’avais ajouté un champ pour capter la tension. Il la faisait disparaître.

Dans un test de CreaFlow, le document source disait qu’un patient apparaissait en caleçon sur mon VPS. Le résumé de l’événement disait seulement que des images de Julien étaient stockées sur le serveur. Le détail qui rendait le problème humain avait été lissé en constat technique.

Le champ censé noter « ce qui est en jeu » n’aidait pas : il était vide dans 54 événements sur 69, et quand il était rempli, il contenait souvent de l’analyse plutôt que le détail concret.

Je l’ai retiré. Le rédacteur relit le document source en entier avant d’écrire, au lieu de dépendre d’un résumé qui peut aplatir l’histoire.

Pour un dev solo, le fait exact est souvent la partie la plus racontable — et la plus facile à perdre quand on le résume trop tôt.

## Post 9

*20 s · 5 tours · 4 read_file · 8 read_post · 716 caractères*

Pointeurs : non daté · docs/DEVLOG.md:11 — non daté · docs/DEVLOG.md:17 — non daté · docs/SPEC_ENTREE_PAR_LE_REPO.md:107

Un scanner d’email peut utiliser ton lien de connexion avant toi.

Quand un service vérifie automatiquement les liens d’un email, il peut ouvrir celui qui sert à se connecter. Si cette simple ouverture consomme le lien, le fondateur clique ensuite… et découvre qu’il est déjà utilisé.

Dans le parcours d’entrée de CreaFlow, le lien de connexion dure 24 heures et ne sert qu’une fois. J’ai donc séparé l’affichage de la page de son utilisation : la visite ordinaire ne consomme pas le jeton ; c’est la page, une fois chargée, qui envoie la requête de connexion.

Petit détail d’implémentation, gros effet sur la première impression : tu ne devrais pas devoir déboguer ta boîte mail avant de pouvoir essayer un outil.

## Post 10

*31 s · 7 tours · 9 read_file · 9 read_post · 664 caractères*

Pointeurs : 2026-10-20 · commit-log.txt:11 — 2026-10-20 · commit-log.txt:13 — 2026-10-20 · commit-log.txt:14

J’ai arrêté de laisser le rédacteur se noter lui-même.

Dans CreaFlow, l’outil que je construis pour transformer les traces d’un projet en posts, écrire et relire sont deux tâches distinctes. Le rédacteur compose le texte ; un relecteur le juge du point de vue du lecteur visé.

J’ai aussi limité le retour à deux reproches par tour. Le relecteur signale ce qui gêne, puis le rédacteur reprend la main — il ne se fait pas remplacer par une deuxième voix qui réécrit tout.

Quand tu transformes ton devlog en post après une journée de code, la relecture devrait t’aider à garder ton histoire lisible, pas à lui donner l’air d’avoir été écrite par quelqu’un d’autre.

## Post 11

*20 s · 6 tours · 6 read_file · 10 read_post · 774 caractères*

Pointeurs : non daté · docs/DEVLOG.md:78

Lundi, à 00:58, mon tableau de bord affichait 0 et −100 %.

La semaine venait de commencer. Ce zéro ne disait pas que les publications avaient moins bien marché : leurs vues n’étaient simplement pas encore arrivées. Comparer une semaine vide à la précédente transformait un délai de mesure en mauvaise nouvelle.

Dans CreaFlow, l’écran Performance suit les chiffres des posts LinkedIn et X. J’ai changé la règle : pas de pourcentage tant qu’aucun post de la semaine n’a de données, et un « Wait N days » quand le post le plus récent a moins de trois jours.

Si tu suis les résultats de ton produit ou de tes posts, un chiffre incomplet n’est pas une tendance. Parfois, le bon tableau de bord ne te donne pas une réponse — il t’évite de tirer la mauvaise conclusion trop tôt.

## Post 12

*31 s · 6 tours · 7 read_file · 11 read_post · 697 caractères*

Pointeurs : 2026-10-18 · commit-log.txt:54 — 2026-10-18 · docs/PRODUCT.md:132

J’ai failli compter deux fois la même semaine.

CreaFlow écrit un texte adapté à LinkedIn et un autre à X — deux réseaux sociaux — à partir du même moment du projet. Si le quota comptait les scripts, publier sur les deux aurait consommé deux fois plus vite l’essai qu’en n’en utilisant qu’un.

J’ai donc fait compter des semaines, pas des textes : l’essai gratuit donne une semaine de contenu, à vie. Elle est consommée à la première génération de la semaine ; les autres posts de cette semaine ne la consomment pas une seconde fois.

Pour un indie dev, l’unité qui compte, c’est la semaine où tu peux publier — pas le nombre de versions qu’il faut écrire pour adapter ton travail à chaque réseau.

---

# D — + porte d'entrée pour un inconnu

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
