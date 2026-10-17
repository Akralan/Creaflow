# 03 - Raconter un événement vécu en post court

Recherche du 2026-10-17. Environ 28 pages ouvertes, une vingtaine lues avec succès (les autres : 403 ou délai dépassé, listées en section 5). Les chiffres d'engagement viennent presque tous d'éditeurs d'outils LinkedIn : indicatifs seulement.

Limite honnête : je n'ai trouvé AUCUN corpus de posts réels annotés (build in public, praticiens) avec méthode. Les "exemples" de la section 2 sont donc soit des récits publics réels résumés (marqués [réel]), soit des illustrations que j'ai écrites pour montrer le mécanisme (marquées [illustration], à ne pas citer comme preuve).

## 1. Principes solides

**P1. Le détail précis fait la crédibilité.** Noms, chiffres, outils, dates, mots exacts. Un récit vague se lit comme une performance ; un détail vérifiable sonne vrai.
- Copyblogger : plus les détails sont précis, plus le récit est crédible. https://copyblogger.com/concrete-details/ (blog de marketing, solide sur ce point, pas de preuve chiffrée)
- Heath, Made to Stick (via résumé) : concret + crédible, le témoin vécu bat l'expert en blouse. https://www.ybrikman.com/blog/2015/01/18/made-to-stick/ (résumé de lecture)
- Bubble / MagicPost / dev.to convergent : dates, numéros de version, composants nommés, vraies pannes. https://bubble.io/blog/case-for-building-in-public/ ; https://dev.to/xundao2006/building-in-public-is-terrifying-and-thats-why-it-works-10n6
- Orwell (concret plutôt qu'abstrait, mot le plus court) : résumé secondaire, https://public.websites.umich.edu/~sanders/214/other/paper/orwell.html (403 à la lecture, vu seulement via recherche).
- Un détail faux détruit tout (Writer's Magazine via recherche) : pertinent pour nous, on ne doit jamais inventer.

**P2. Un récit = un moment de bascule, pas une chronologie.** Dicks (Storyworthy) : un moment de 5 secondes (réalisation ou transformation), tout le reste le sert ; commencer au plus près de la fin. Vonnegut règle 5 : commencer le plus près possible de la fin ; règle 4 : chaque phrase révèle ou fait avancer. https://www.themarginalian.org/2012/04/03/kurt-vonnegut-on-writing-stories/ (lu) ; https://lennysnewsletter.com/p/how-to-tell-better-stories-matthew (page de présentation, détail limité). Résumés de Storyworthy seulement : à confirmer dans le livre.

**P3. Il faut un enjeu et un mouvement.** Action sans enjeu = bruit (https://www.novlr.org/the-reading-room/what-does-in-medias-res-mean, lu). Dicks : les récits ennuyeux manquent d'enjeu. Glass (via Kapp, blog 2011) : l'anecdote pose une question dès le début ("appât") ; https://karlkapp.com/?p=2313. Les posts de devs qui échouent n'ont pas de "raison de s'intéresser" dans les premières lignes (https://xor01.substack.com/p/building-isnt-enough-a-developers, témoignage individuel, lu).

**P4. Raconter dans la scène, laisser conclure le lecteur.** The Moth (via notes de lecteur) : rester dans l'action, ne pas dire quoi penser, éviter les "et là j'ai compris". Orlean : arrêter avant de résumer ce qu'on vient de dire, le lecteur "tombe vers l'avant". https://niemanstoryboard.org/?p=16612 (lu). MagicPost : pas de morale en tête, la leçon vient à la fin "si elle vient". https://magicpost.in/fr/blog/linkedin-personal-story-post (vendeur, lu).

**P5. Pas d'autopromo déguisée.** Sezer, Gino, Norton (JPSP 2018) : le humblebrag est jugé moins sympathique et moins sincère que le vantardise franche ET que la plainte franche. https://www.library.hbs.edu/working-knowledge/humblebragging-is-a-bad-strategy-especially-in-a-job-interview (HBS, lu ; le nombre d'études varie selon les sources : 5, 7 ou 9). Admettre une vraie erreur paie. Conséquence : un fait neutre énoncé sans emballage vaut mieux qu'un "échec" qui cache un succès.

**P6. La défaite concrète est utile quand elle change la décision suivante.** Éviter l'échec "décoratif". https://www.wayline.io/blog/devlogs-struggle-succeed et https://www.wayline.io/blog/top-earning-indie-games-problem-solution-devlogs (blog marketing d'un outil de journal : exemples chiffrés probablement fictifs, ne pas s'y fier pour les chiffres ; le schéma problème / hypothèse fausse / essais / résultat est cohérent avec les autres sources).

**P7. Le premier trait compte, court et concret.** Analyse MagicPost de 1,18 M de posts LinkedIn : accroches avec un chiffre 35 likes médians vs 26 ; question en ouverture 19 vs 29 ; très courtes meilleures. https://magicpost.in/blog/linkedin-hooks (données propriétaires, hypothèses causales non mesurées).

## 2. Exemples courts, par type d'événement

**Échec**
- [réel] Julia Evans, bug Redis : requête invalide, relecture, collègues disent "ça a l'air bon", puis elle capture le trafic d'une machine qui marche, copie la requête valide, "ça a tout expliqué". Pourquoi ça marche : symptôme précis, outil nommé, tournant daté, pas de morale dans la scène. https://jvns.ca/blog/2015/11/22/how-i-got-better-at-debugging/ (mais elle énonce ensuite des leçons : récit + conseil).
- [réel] Factorio FFF-346 : part d'une ligne de patch note et des questions de la communauté, nomme le drapeau de masque de collision, avoue un test oublié avec humour, finit sur un proverbe tchèque et passe à autre chose. Pourquoi : aveu concret, fin sobre. https://cf-www.factorio.com/blog/post/fff-346

**Découverte / déclic**
- [illustration] « Mardi, 23h. Les 40 appels de /sync prenaient 2,1 s chacun. J'ai ouvert le log : même requête, 40 fois. » Pourquoi : la découverte est le fait observé, pas "j'ai réalisé que l'optimisation est importante".

**Retour d'un utilisateur / patient / client**
- [illustration] « Mme R. a posé son téléphone sur la table et dit : "Je croyais que c'était l'épaule." C'était le cou. » (anonymiser, voir P3 de la section 3). Pourquoi : la phrase exacte du client porte l'événement. Aucune source trouvée ne donne d'exemple réel annoté de ce type ; les guides de témoignages (https://functioningmedia.substack.com/p/writing-testimonials-and-case-studies, vendeur) disent seulement : précis, chiffré, avant/après, nommé.
- Médecine narrative : écrire à la première personne, changer nom et détails identifiants (modèle de récit clinique, via recherche : https://river.svhealthcare.org/cms/ncap/nursing-clinical-advancement-program-cap-documents/clinical%20narrative.pdf, non ouvert).

**Jalon**
- [réel, condensé] DHH, sortie du cloud : six mois, six services, budget cloud 2022 de 3,2 M$, matériel d'environ un demi-million, économie annoncée d'au moins 1,5 M$/an. Pourquoi : chiffres vérifiables. Mais le texte finit par une thèse et un "fais tes calculs" : c'est un essai, pas un micro-récit. https://world.hey.com/dhh/we-have-left-the-cloud-251760fb

**Décision**
- [illustration] « J'ai supprimé le mode hors-ligne. Trois semaines de travail, utilisé par 2 comptes sur 310. » Pourquoi : le coût est dit, pas de justification solennelle.

## 3. Ce qui fait échouer

- **Formule LinkedIn "broetry"** : deux lignes inspirantes, anecdote banale, leçon de biscuit chinois, question finale. Perçu comme fabriqué pour le flux ; son propre promoteur dit qu'il "donne aux gens ce qu'ils veulent" et que certains posts sont écrits par des nègres. https://www.buzzfeednews.com/article/ryanmac/why-are-these-posts-taking-over-your-linkedin-feed-because (2017, presse, lu, ancien).
- **Arc prévisible** épreuve / larme / leçon / appel à l'action, désormais repérable comme écrit par IA ; fausse humilité ; "déballage" brut sans structure. MagicPost (vendeur).
- **Journal de travail** ("authentification faite", "bug de sync corrigé") : zéro réaction, aucun problème posé, aucun lecteur visé. https://xor01.substack.com/p/building-isnt-enough-a-developers (une personne, sans chiffres).
- **Flex de revenus et posture** : jugés théâtraux par les praticiens (fils Indie Hackers, 403 à la lecture, vu via résumé de recherche). Saturation du "build in public" : "si tout le monde le fait, personne ne le fait".
- **Humblebrag / vulnérabilité de façade** (P5). dev.to : "public ne veut pas dire sans limites" ; ne pas publier données d'utilisateurs ni drames internes.
- **Jargon et malédiction du savoir** : l'expert sous-explique ou noie (Heath). Dans le devlog, le code pur éloigne les non-programmeurs (Wayline, chiffres douteux).
- **Détail faux ou arrondi à l'envie** : détruit la crédibilité, et pour un patient/client : risque éthique et légal.

## 4. Confronter nos règles actuelles

| Règle | Verdict | Ce que disent les sources |
|---|---|---|
| Commencer dans l'événement, pas de contexte ni d'annonce | **Confirme, avec nuance** | Vonnegut, Dicks, Ambassify ("start with a moment"), MagicPost : oui. MAIS novlr (lu) : "action sans enjeu est du bruit", on perd le lecteur si rien ne l'oriente ; Clare (Goodreads, lu) : commencer dans l'action baisse l'enjeu si on ne tient pas aux personnages. Un seul élément de contexte (qui, quoi, pourquoi ça compte) dans les 1-2 premières phrases est défendable ; pas un paragraphe. Pour un lecteur qui ne connaît pas le produit, nommer la chose en passant est nécessaire. |
| Raconter ce qui s'est passé puis ce que ça a changé, avec détails vrais | **Confirme** | Cœur de Dicks (changement), Glass (anecdote + réflexion), Labov (action, résultat), Heath, Copyblogger. Précaution : le "ce que ça a changé" doit être un fait (avant/après), pas une opinion. |
| Ne pas expliquer le produit | **Confirme en gros, nuance** | Wayline/Bubble : relier au bénéfice du lecteur ; les jalons ont besoin de leur "histoire derrière". Mais les posts qui expliquent le produit sont ceux que le lecteur flaire comme pub. Une demi-phrase d'explication quand elle est indispensable pour comprendre l'événement. |
| Finir quand l'histoire est finie (pas de morale, pas de liste de features) | **Confirme, mais conflit entre sources** | Pour : Orlean, The Moth, MagicPost, BuzzFeed (morale = tic). Contre : Ambassify ("termine par la leçon"), Glass ("le moment de réflexion est le point de l'histoire"), Labov (évaluation + coda), Julia Evans et DHH énoncent leurs leçons. **Ils ont raison quand** le fait ne dit pas seul pourquoi il compte pour le lecteur : alors UNE phrase de réflexion, personnelle, au présent, sans généralité ("je ne fais plus X sans Y") vaut mieux que le vide. Ils ont tort sur la question finale automatique : MagicPost sur 1,18 M de posts, question en ouverture = moins de réactions (pas mesuré pour la fin). |
| Pas de call to action | **Plutôt confirme, nuance** | Seuls vendeurs/guides de conversion le demandent (Ambassify, Wayline, Functioning Media pour des études de cas B2B). Aucune étude trouvée sur un CTA dans un récit personnel. Un CTA a du sens pour une étude de cas de vente, pas pour un post d'événement. |
| Ne pas ressembler au post précédent | **Non couvert** | Aucune source trouvée. Seulement : l'arc répété (hardship / leçon / question) est repérable et vieillit mal (MagicPost) ; la régularité est valorisée (Wayline), ce qui n'est pas la même chose. |

Règle à ajouter, soutenue par plusieurs sources : **un seul moment de bascule par post** (Dicks, Vonnegut), **jamais d'invention de détail** (Writer's Magazine, Heath), **pas de façon de se mettre en valeur déguisée** (Sezer/Gino).

## 5. Sources consultées et jugement

Lues en entier ou en grande partie :
- https://copyblogger.com/concrete-details/ : moyen, marketing, utile pour la concision.
- https://www.library.hbs.edu/working-knowledge/humblebragging-is-a-bad-strategy-especially-in-a-job-interview : **bon** (résumé de recherche académique, 2018).
- https://www.themarginalian.org/2012/04/03/kurt-vonnegut-on-writing-stories/ : bon, primaire (règles) mais pour la fiction.
- https://niemanstoryboard.org/?p=16612 : bon, praticiens du journalisme narratif, sur les fins.
- https://www.novlr.org/the-reading-room/what-does-in-medias-res-mean : moyen, fiction.
- https://www.goodreads.com/author_blog_posts/18378162-beginning-close-to-the-action : faible, avis d'une romancière.
- https://jvns.ca/blog/2015/11/22/how-i-got-better-at-debugging/ et https://jvns.ca/blog/2022/12/08/a-debugging-manifesto/ : bon, source primaire d'une vraie praticienne.
- https://cf-www.factorio.com/blog/post/fff-346 : bon, devlog réel.
- https://world.hey.com/dhh/we-have-left-the-cloud-251760fb : bon comme texte, mais c'est un essai à thèse.
- https://www.buzzfeednews.com/article/ryanmac/why-are-these-posts-taking-over-your-linkedin-feed-because : moyen, presse 2017, montre le tic.
- https://magicpost.in/blog/linkedin-hooks et https://magicpost.in/fr/blog/linkedin-personal-story-post : données propriétaires d'un vendeur, indicatives.
- https://blog.ambassify.com/blog/how-to-write-a-linkedin-post : faible (vendeur, statistiques non sourcées) ; sert de contre-point.
- https://bubble.io/blog/case-for-building-in-public/ et https://zenvault.beehiiv.com/p/issue-004 : faibles/moyens, marketing de plateforme et newsletter, convergents.
- https://dev.to/xundao2006/building-in-public-is-terrifying-and-thats-why-it-works-10n6 et https://xor01.substack.com/p/building-isnt-enough-a-developers : témoignages individuels, sans chiffres vérifiés.
- https://www.wayline.io/blog/* (4 pages) : faibles, blog d'outil, chiffres douteux.
- https://functioningmedia.substack.com/p/writing-testimonials-and-case-studies : faible, vendeur.
- https://www.ybrikman.com/blog/2015/01/18/made-to-stick/ : résumé d'un livre connu, moyen.
- https://karlkapp.com/?p=2313 et https://lennysnewsletter.com/p/how-to-tell-better-stories-matthew : résumés très courts de Glass et Dicks ; à compléter par les sources originales.

Non lues (403 / délai) : Indie Hackers (3 pages), CMAJ, NPR transcript, Orwell Michigan. Leur contenu ici vient des extraits de recherche seulement.

## Trous
- Aucun corpus d'exemples réels annotés avec mesure d'engagement.
- Rien de spécifique au récit de praticien de santé ou d'artisan sur réseau social (seulement la médecine narrative : confidentialité).
- Rien sur "ne pas ressembler au post précédent".
- Pas de test d'un CTA dans un récit personnel.
- Labov est cité de seconde main (cours, fiches) ; Orwell, Dicks, Glass, The Moth aussi.
