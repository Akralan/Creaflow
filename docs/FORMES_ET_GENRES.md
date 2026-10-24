# SPEC — Genres d'événements et formes de posts

Statut : **implémentée le 2026-10-24** sur `feature/formes-et-genres` (tâches 1 à 8 du plan ; migration `0059` appliquée en base de dev ; banc MyKiné : 158 pointeurs, les 13 genres, 12 posts en 10 formes, 0 refus ; banc tellovo : 1 646 pointeurs, 12 posts, 6 leçons et 3 échecs ; relevés dans `docs/tests/pointeurs/mykine-genres/` et `docs/tests/pointeurs/creaflow/`). Ajouts décidés au banc : de vrais posts du relevé comme modèles de chaque forme, rendus par `read_form` ; budget de sortie de l'extracteur porté à 16 384 jetons. Deux règles restent ouvertes : durcir l'accroche, et « on comprend le projet par le fait » dans les formes techniques. Pas encore essayé dans l'app. Spec écrite le 2026-10-24 (réécrite le même jour sur la chaîne pointeur, voir le journal des décisions en fin de document). Se pose **par-dessus `SPEC_EVENEMENT_POINTEUR.md`**, qui reste l'état du lecteur et du rédacteur : cette spec leur ajoute un champ et une règle, rien d'autre. Remplace `SPEC_FIL_NARRATIF.md` sur tout ce qui concerne les types de posts (ce doc-là reste pour l'historique de la réflexion). Les décisions produit sont prises ; ce qui est hors périmètre est dit comme tel.

Plan d'implémentation : `docs/superpowers/plans/2026-10-24-formes-et-genres.md` (branche `feature/formes-et-genres`).

Base de preuve : `TYPOLOGIE_BUILD_IN_PUBLIC.md` (les quinze types, leurs parts et leur engagement relatif) et `CATALOGUE_POSTS_LINKEDIN.md` (les 274 posts, un par ligne, avec leurs chiffres et leurs liens).

## Ce qui change, en une page

**Le problème.** Le rédacteur n'écrit qu'une forme de post : l'épisode. Au run A du banc pointeurs (aucune règle de forme), 12 posts sur 12 faisaient quatre paragraphes et finissaient sur une leçon. Un build in public qui marche a quinze types de posts (relevé de 274 posts). Les faits qui produisent ces types existent déjà dans les sources des auteurs ; la chaîne ne les distinguait pas.

**Le principe.** Trois responsabilités, trois endroits, aucune inférence en double :

1. **Le lecteur (l'extracteur de pointeurs, `src/lib/llm/pointerExtractor.ts`) pose un `genre` sur chaque événement.** Un champ fermé, treize valeurs, conditions minimales et règles en Partie 1. C'est la seule inférence nouvelle demandée au modèle, au moment où il lit déjà la ligne. C'est aussi la **seule exception** à la règle « un événement n'a aucun champ » de `SPEC_EVENEMENT_POINTEUR.md` §2 : un genre est une classification fermée, pas un résumé ni un titre qu'on réinvente ; rien de ce qui a été retiré (titre, résumé, conséquence, public) ne revient.
2. **Le rédacteur (`src/lib/llm/pointerPostWriter.ts`) prend la forme du genre de l'événement qu'il a choisi.** Il voit le genre de chaque pointeur dans la ligne de temps. Il choisit son événement comme aujourd'hui, puis lit la forme qui va avec ce genre et l'écrit. Table un pour un, aucune autre règle : pas de garde-fou de fréquence, pas de quota par forme, pas de « pas deux fois d'affilée ». La matière décide. Il déclare la forme dans `publish_post`.
3. **La forme remplace, pour ce post, la règle de forme du prompt** (la quatrième phrase, « aucun post mort et variation de forme »). Les trois autres phrases du prompt (build in public pour ce lecteur, l'origine, l'accroche) ne bougent pas, ni les outils, les plafonds, la langue et les règles de plateforme.

Pourquoi c'est le rédacteur et non le calendrier qui porte la forme : sur `main`, un créneau n'a pas d'événement avant l'écriture. Et c'est voulu : si l'auteur n'aime pas le sujet d'un post, il utilise « autre idée », qui existe déjà, et le rédacteur repart sur une autre matière, donc éventuellement une autre forme. Une forme figée sur le créneau empêcherait ça.

**L'origine** reste ce qu'elle est dans le prompt actuel : le premier post d'un sujet sans post publié. Le genre `déclencheur` lui donne sa matière quand il existe ; sinon elle s'écrit comme aujourd'hui, depuis la matière et les mots de l'auteur.

**Ce que l'auteur voit.** Rien de nouveau à décider. Chaque post porte une étiquette non éditable, le nom de la forme en langage d'auteur (« Launch », « Promise kept », « What I learned »…), sur la carte de la semaine et en tête du post. L'épisode simple n'a pas d'étiquette. S'il ne veut pas du post, il le supprime ou demande une autre idée.

**Données.** `material_events.genre` (enum des treize genres, défaut `livraison`), `material_events.disponible` (bool, défaut false), `material_events.tient` (id d'événement, nullable : l'engagement, l'annonce ou la décision que cet événement réalise ou sur laquelle il revient, posé par le lecteur). `scripts.form` (enum des formes, nullable : l'épisode n'en a pas). Rien d'autre ; pas de colonne sur les créneaux, `promisesMade` et `promiseHonored` restent inutilisés.

**Hors périmètre de cette livraison.** Vision et point d'étape (position à décider plus tard ; leurs formes restent dans le doc pour mémoire). Le texte des prompts : il se rédige sur le banc à partir des règles et des formes ci-dessous, pas dans la spec. Les critères de lecture (Partie 3) sont les critères d'acceptation, un par forme.

**Table genre → forme.**

| Genre de l'événement choisi | Forme | Étiquette (app, en anglais) |
|---|---|---|
| `livraison` | Épisode | (aucune) |
| `livraison` + `disponible` | Lancement | Launch |
| `annonce` | Teaser | Coming soon |
| `chiffre` | Chiffre | Number |
| `échec` | Échec | Failure |
| `leçon` | Ce que j'ai appris | What I learned |
| `retour_utilisateur` | Preuve | User story |
| `engagement` | Promesse | Promise |
| événement avec `tient` → un `engagement` | Promesse tenue | Promise kept |
| événement avec `tient` → une `décision` | Promesse tenue (verdict sur la décision) | Looking back |
| événement avec `tient` → une `annonce` | Lancement | Launch |
| `offre` | Offre | Offer |
| `question` | Question | Question |
| `coulisse` | Coulisses | Behind the scenes |
| `réaction` | Curation | Reading |
| `déclencheur` | Origine (premier post) | Origin |
| `décision` | Épisode | (aucune) |
| — (plus tard) | Point d'étape, Vision | — |

Une `décision` seule s'écrit comme un épisode ; elle n'a de forme propre qu'en entrée de la vision, hors périmètre. Elle compte quand même : un événement ultérieur peut la « tenir » (revenir dessus), et c'est là que la décision rapporte.

---

## Partie 1 — Les genres d'événements (lecteur)

Un seul champ ajouté à l'événement : `genre`, valeur fermée parmi treize. Un événement = un genre. Le lecteur ne décide pas de la forme du post, il dit ce qu'est le fait. Chaque genre a une condition minimale : sans elle, ce n'est pas ce genre. Le lecteur lit toujours une ligne dans son document : la condition minimale doit être remplie **dans la ligne ou son voisinage immédiat**, pas déduite du reste du dépôt.

### Genres sur le produit

| Genre | Définition | Condition minimale | Exemples du corpus |
|---|---|---|---|
| `livraison` | Quelque chose fonctionne ou existe qui ne fonctionnait pas avant | Un état avant et un état après, dans la source | Ofili « Day 14, PIN qui marche sans réseau » ; Jaspar « quiz produit avec chaque AE » |
| `livraison` + `disponible: true` | La livraison est utilisable par d'autres que l'auteur | La source dit où / pour qui / comment y accéder | Jaspar « base de 130 M de commerces, live dans Artisan » ; Tibo « Outrank héberge les blogs gratuitement » |
| `annonce` | Une livraison dont la date de disponibilité est fixée mais pas atteinte | Une date ou un délai précis dans la source ; la chose n'est pas encore accessible | Robinson « lancement physique à SF la semaine prochaine » ; Gambatto « Tomorrow » la veille de la sortie de stealth |
| `décision` | Un choix entre au moins deux options, dont une retenue | L'option retenue et au moins une écartée sont nommées | Jaspar « on a testé tous les fournisseurs de signaux, on a construit les nôtres » ; Ofili « repo recommencé de zéro » |
| `question` | Un choix que l'auteur n'a pas encore fait et sur lequel il demande | Les options sont nommées et la source dit que l'auteur hésite ou demande | Robinson « je vais à SF, qui rencontrer » ; Gambatto « je prépare un défi, on me dit de le filmer, j'hésite » |
| `chiffre` | Un nombre qui situe le projet (pas le marché) | Le nombre porte sur le projet de l'auteur, avec sa date | Simon « churn sous 5 %, plage habituelle 6-9 % » ; Jaspar « 2 000 utilisateurs une semaine après le self-serve » |
| `échec` | Ce qui était attendu ne s'est pas produit | L'attente et l'écart sont tous deux dans la source | Jaspar « envoyer tout le monde en self-serve était une erreur » ; Tibo « des vendeurs ont attendu leur paiement trop longtemps » |
| `leçon` | L'auteur formule une règle à partir d'un fait | La règle est écrite par l'auteur, pas déduite par le lecteur | Jaspar « félicitations pour la levée performe 3× moins » (20 M de mails) ; Simon « on ne laisse plus les agents noter leur propre travail » |
| `engagement` | L'auteur s'engage sur un fait futur | Première personne + verbe au futur + une échéance ou un nombre | Tibo « 1 M de vues d'ici le 31 déc. » ; Robinson « 24 M$ d'ARR dans 2 ans avec moins de 5 employés » |
| `offre` | L'auteur propose quelque chose à des personnes précises contre une action | Ce qui est proposé, à qui, et l'action attendue sont dans la source | Tibo « je paie double en octobre les blogs qui rejoignent, répondez avec votre blog » ; Jaspar « Ava 2.0 gratuite, 300 $ de crédits » ; Pat Walls « je cherche un producteur » |
| `retour_utilisateur` | Une personne hors de l'équipe a fait ou dit quelque chose avec le produit | La personne est identifiable (prénom, rôle ou entreprise) et le fait est le sien | Tibo « Erika a facturé 45 000 $ en installant mon produit » ; Jaspar « un client a résilié 4 contrats après Ava » |
| `déclencheur` | Le fait qui a lancé le projet | Antérieur à toute livraison ; raconte un problème, pas une solution | Ofili « deux identités qui ne se parlaient pas » ; Jaspar « j'ai écrit à des centaines de fondateurs avant Artisan » |

### Genres sur l'auteur et son environnement

| Genre | Définition | Condition minimale | Exemples du corpus |
|---|---|---|---|
| `coulisse` | Un fait sur l'auteur qui ne concerne pas le produit | Le fait est daté et vécu par l'auteur ; le produit n'y est pas le sujet | Simon « trois déménagements de pays » ; Lieberman « ce que je consomme ce week-end » ; Tibo « j'ai donné mon sang » |
| `réaction` | L'auteur a commenté un contenu qui n'est pas à lui | Le contenu tiers est identifié (titre, auteur ou lien) et l'auteur a écrit au moins une phrase dessus | Simon « citation de Karpathy, je le vois dans mon business » ; Pat Walls « le meilleur cold email jamais reçu » ; Tibo « vidéo d'un chercheur Anthropic » |

### Règles à finir d'écrire dans le prompt du lecteur

1. **Un genre par événement.** Si une ligne contient une livraison et un chiffre, c'est deux événements, pas un événement à deux genres.
2. **Ordre de départage** quand un fait hésite : `engagement` > `échec` > `retour_utilisateur` > `offre` > `annonce` > `question` > `chiffre` > `décision` > `leçon` > `réaction` > `coulisse` > `livraison`. Les genres rares et précieux gagnent sur le genre par défaut.
3. **`livraison` est le défaut** pour tout fait qui concerne le produit ; `coulisse` est le défaut pour tout fait qui ne le concerne pas. Le champ n'est jamais vide.
4. **`engagement` est le genre à ne pas inventer.** « On va bientôt… », « on réfléchit à… », « j'aimerais… » ne sont pas des engagements. Il faut l'échéance ou le nombre dans la source. Dans le doute, `décision`.
5. **`annonce` n'est pas `engagement`.** L'annonce porte sur une livraison datée (« disponible le 3 novembre ») ; l'engagement porte sur un résultat (« 1 M de vues d'ici le 31 »). Une annonce sans date n'est rien : `livraison` non disponible, pas encore un événement.
6. **`offre` exige l'action attendue.** « On lance une promo » sans ce que la personne doit faire est une `livraison` disponible.
7. **`question` exige l'hésitation explicite.** Une décision prise n'est jamais une question ; une liste d'options sans phrase de doute non plus.
8. **`chiffre` exclut les données de marché.** « Les vidéos IA font 2,1× plus de vues sur TikTok » est une leçon, pas un chiffre du projet.
9. **`leçon` exige la phrase de règle dans la source.** Si le lecteur doit la formuler lui-même, c'est une `livraison` ou un `échec`.
10. **`retour_utilisateur` exige une personne.** « Les utilisateurs adorent » n'en est pas un.
11. **`réaction` exige la phrase de l'auteur.** Un lien enregistré sans commentaire n'est pas un événement.
12. **`coulisse` exige que le fait soit celui de l'auteur**, pas d'un proche ni d'un tiers, et qu'il soit daté. Un trait de caractère n'est pas un événement.
13. **`déclencheur` : un seul par sujet**, le plus ancien qui remplit la condition. L'extracteur travaille document par document et ne peut pas le garantir seul : il pose `déclencheur` quand la condition est remplie, et **le code ne garde que le plus ancien** du sujet (les autres repassent en `livraison`). Si aucun n'est identifiable, l'origine s'écrit sans lui, comme aujourd'hui.
14. **Appariement.** À chaque passe sur un document, le lecteur reçoit, pour le sujet, les `engagement` et `annonce` ouverts et les `décision` posées (id + texte de la ligne + date). Il indique `tient: <id>` sur un nouvel événement seulement si celui-ci réalise ce qui était promis ou annoncé, ou **revient explicitement sur cette décision** (la ligne dit qu'on la maintient, qu'on l'annule, ou ce qu'elle a donné), sans interprétation. Un engagement tenu partiellement n'est pas tenu. Un `tient` pointe toujours vers un événement antérieur.
15. **Le genre ne change jamais après coup.** Une matière qui contredit un événement produit un nouvel événement (souvent un `échec`, ou un événement qui `tient` la décision contredite).

### Ce que les sources doivent contenir (pour l'onboarding du Tellovo Engine)

Chaque genre a une source naturelle. C'est ce qu'on apprend aux gens à alimenter si on veut tous les types de posts.

| Genre | Où ça vit chez un auteur bien outillé |
|---|---|
| `livraison`, `décision`, `échec` | commits, PR, changelog, notes de travail |
| `chiffre` | une page Notion de métriques, un export, un mail d'outil (Stripe, analytics) |
| `leçon`, `question` | notes de réflexion, journal de bord, une page « ce que j'ai appris » |
| `engagement`, `annonce` | roadmap datée, page d'objectifs, mail d'annonce |
| `offre` | page de pricing ou de promo, fiche de poste, mail de lancement |
| `retour_utilisateur` | mails et messages clients, tickets support, avis |
| `déclencheur` | la première note du projet, un mail ou une conversation d'origine |
| `coulisse` | journal perso, agenda, notes datées hors projet |
| `réaction` | articles enregistrés avec un commentaire, favoris annotés |

---

## Partie 2 — Les formes (rédacteur)

Chaque forme remplace, pour le post concerné, la règle de forme du prompt du rédacteur. Format fixe : ce que le post lit, comment il s'ouvre, ce que porte le corps, sur quoi il s'arrête, ce qu'il ne fait pas. Les motifs d'ouverture sont ceux observés sur les 274 posts ; les chutes sont lues sur les posts courts et les quinze plus forts, à confirmer sur le banc. Les posts cités sont dans `CATALOGUE_POSTS_LINKEDIN.md` ; les chiffres entre parenthèses sont des réactions, et les multiplicateurs sont relatifs à la médiane de l'auteur. **Ces chiffres sont des exemples, pas des preuves** : plusieurs formes reposent sur moins de cinq posts (promesse 3, question 2, teaser 1).

### Comment la forme arrive au rédacteur

Le rédacteur ne reçoit pas les seize formes dans son prompt : seize blocs de règles nommées, c'est exactement ce que la loi du `DEVLOG.md` du 2026-10-21 interdit (tout élément nommé ressort dans le texte). Il reçoit la ligne de temps avec le genre de chaque pointeur (`DEVLOG.md:165 (2026-09-12) [échec]`), la table genre → forme en une ligne par genre, et un outil `read_form(genre)` qui lui rend le texte de la forme. Il choisit son événement, lit sa forme, écrit. Pour la promesse tenue, la ligne de temps lui montre `[tient → <id>]` et il va lire l'événement d'origine avec `read_file`, comme n'importe quel pointeur. S'il publie sans avoir lu la forme de son genre, `publish_post` refuse (même mécanique que les enregistrements refusés de l'extracteur).

### La personne qui parle

Le post est écrit par l'auteur, pas sur lui. La règle est simple et elle vient de la matière, jamais d'un réglage : **« je » quand les notes disent « je », « on » quand les notes disent « on » ou nomment une équipe**, et le rédacteur garde la personne des notes qu'il a lues pour ce post. Un auteur seul qui écrit « on » dans son devlog garde son « on ». Trois formes exigent la première personne du singulier quel que soit le reste, parce que c'est l'auteur qui s'expose : Promesse, Échec et Coulisses. Aucune forme n'autorise le « nous » institutionnel (« nous sommes ravis d'annoncer ») ni la troisième personne sur le produit comme sujet de phrase quand l'auteur a agi (« Tellovo permet désormais » là où les notes disent « j'ai branché »).

### Épisode (genre `livraison`, ou `décision` seule)

- **Lit** : un événement.
- **S'ouvre** sur le fait, au passé, sans préambule. Si la source contient un avant, l'avant vient juste après le fait (« avant c'était un onglet Chrome, maintenant c'est une icône »).
- **Corps** : la raison, quand elle existe, vient en seconde position et vient de quelqu'un (« les médecins m'ont dit qu'ils travaillent avec des gants »). Un seul fait ; les détails techniques sont des conséquences visibles, pas des noms de librairies.
- **S'arrête** sur ce que ça change pour la personne qui l'utilise, ou sur le prochain fait déjà en cours. Jamais sur une morale.
- **Ne fait pas** : liste de fonctionnalités, promesse, question au lecteur.
- Observé : Ofili Day 16 (597), Jaspar dîner à 6 k$ (92). C'est la forme que le rédacteur produit déjà.

### Lancement (genre `livraison` + `disponible`, ou événement qui `tient` une `annonce`)

- **Lit** : un événement, plus l'`annonce` qu'il réalise s'il y en a une.
- **S'ouvre** sur l'annonce au présent, avec le nom de la chose et un chiffre d'échelle ou de prix dans la première phrase (« base de 130 M de commerces, live aujourd'hui » ; « 27 $/mois »).
- **Corps** : pour qui, dit comme une situation (« si vous vendez à des restaurants, des salons… ») ; puis pourquoi ça n'existait pas avant, en deux phrases maximum ; puis ce que ça remplace.
- **S'arrête** sur l'accès : où, comment, à quelles conditions.
- **Ne fait pas** : liste de fonctionnalités de plus de trois items, superlatifs sans chiffre.
- Observé : Robinson MoltSets (842), Jaspar commerces locaux (292). Les lancements qui expliquent le « pourquoi » avant le « quoi » (Jaspar personnalisation agentique, 59) font trois fois moins.

### Teaser (genre `annonce`)

- **Lit** : un événement.
- **S'ouvre** sur la date ou le délai (« la semaine prochaine, la veille de l'événement X » ; « demain »).
- **Corps** : ce qu'on peut dire, en deux lignes : pour qui et à quelle échelle. Ce qu'on ne dit pas est dit comme tel (« je ne peux pas encore donner les détails »), une fois.
- **S'arrête** sur la date ou le lieu, répété.
- **Ne fait pas** : « stay tuned » sans date, plus d'un teaser par livraison, description déguisée du produit.
- Observé : Robinson SF (135, x0,9), Gambatto « Tomorrow » (168). Un teaser nu ne marche qu'avec une audience existante ; sans elle, il faut la ligne « pour qui ».

### Chiffre (genre `chiffre`)

- **Lit** : un événement, plus le chiffre précédent du même indicateur s'il existe dans la ligne de temps.
- **S'ouvre** sur le nombre et son contexte dans la même phrase (« RB2B fait 10 M$ d'ARR avec 1 salarié » ; « 2 000 utilisateurs une semaine après le self-serve »).
- **Corps** : le point de comparaison (avant, plage habituelle, objectif), puis comment, en créditant qui a fait quoi.
- **S'arrête** sur une phrase courte qui dit ce que ce nombre permet ou ne permet pas encore. Pas de projection chiffrée.
- **Ne fait pas** : plusieurs nombres sans lien, pourcentage sans base, nombre du marché.
- Observé : Robinson 10 M$ / 1 FTE (336), Simon churn < 5 % (28). Seul, ce type est sous la médiane ; relié à un avant, il double.

### Échec (genre `échec`)

- **Lit** : un événement.
- **S'ouvre** sur ce qui était attendu, puis l'écart, en deux phrases sèches (« L'IA devait nous faire travailler moins. Jamais été aussi fatigué. » ; « Envoyer tout le monde en self-serve. C'était une erreur. »).
- **Corps** : les faits de ce qui s'est passé, dans l'ordre, avec les chiffres s'il y en a. Pas de cause unique assignée, pas de coupable.
- **S'arrête** sur l'état actuel, non résolu si c'est le cas. Pas de « mais on a appris que », pas de promesse de faire mieux.
- **Ne fait pas** : leçon, excuse, retournement positif en dernière phrase.
- Observé : Tibo fatigue (24, 6× sa médiane), Jaspar self-serve (31). Les coups de gueule adressés à un tiers (« Dear LinkedIn ») ne sont pas cette forme : ils visent quelqu'un, pas le projet.

### Ce que j'ai appris (genre `leçon`)

- **Lit** : un événement.
- **S'ouvre** sur le fait qui donne le droit de parler : ce qui a été fait ou mesuré, avec son volume (« 20 M de mails analysés » ; « 6 000 tweets depuis 2020, puis j'ai regardé mes données »).
- **Corps** : la règle, en une phrase, puis ce qui l'appuie. Si la source contient plusieurs règles, une liste numérotée courte ; sinon une seule règle développée.
- **S'arrête** sur la règle, reformulée en une ligne. Pas d'offre, pas de lien.
- **Ne fait pas** : conseil général sans fait, liste de plus de sept items, deuxième personne injonctive sur toute la longueur.
- Observé : Jaspar « félicitations pour la levée » (80), Robinson « 25 choses à 45 ans » (449). Les listes ancrées sur un fait propre tiennent ; les listes de principes flottants ressemblent à tout le monde.

### Preuve (genre `retour_utilisateur`)

- **Lit** : un événement.
- **S'ouvre** sur la personne et son résultat dans la première phrase (« une de mes utilisatrices a facturé 45 000 $… » ; « notre meilleur commercial a signé cinq deals en un jour »).
- **Corps** : qui elle est, en une ou deux lignes concrètes (« pas programmeuse, gère deux entreprises seule depuis le Tennessee ») ; ce qu'elle a fait, dans l'ordre ; le produit nommé une fois, au moment où il intervient.
- **S'arrête** sur ses mots ou son chiffre, pas sur ceux de l'auteur.
- **Ne fait pas** : adjectif sur le produit, « témoignage » annoncé comme tel, conclusion de l'auteur.
- Observé : Tibo Erika (10, 2,5× sa médiane), Jaspar 4 contrats résiliés (78). La variante « utilisateur anonyme + workflow à copier » (Tibo, 0 réaction) ne marche pas : il faut la personne.

### Promesse (genre `engagement`)

- **Lit** : un événement.
- **S'ouvre** sur l'échéance et le nombre, à la première personne (« d'ici le 31 décembre, 1 M de vues » ; « dans deux ans, 24 M$ d'ARR avec moins de cinq personnes »).
- **Corps** : ce qui a déclenché l'engagement (un fait récent), puis le chemin en deux ou trois étapes, puis le point de départ chiffré aujourd'hui.
- **S'arrête** sur le point de départ. C'est ce qui permet au post de retour de citer « j'avais dit X, je partais de Y ».
- **Ne fait pas** : conditionnel, « j'espère », engagement sans date.
- Observé : Tibo YouTube (11, 2,8× sa médiane), Robinson 24 M$ (193). Les deux auteurs ont tenu le post de retour quelques semaines plus tard.

### Promesse tenue (événement qui `tient` un `engagement` ou une `décision`)

- **Lit** : deux événements : celui d'origine (l'engagement ou la décision, lu par le rédacteur avec `read_file` à l'adresse que `tient` lui donne) et celui qui y revient.
- **S'ouvre** en citant l'origine avec son ancrage temporel, mot pour mot (« il y a 9 mois je disais 100 recrutements en 12 mois » ; « on a dépensé 2 M$ à dire d'arrêter d'embaucher des humains » ; « il y a 16 semaines j'ai décidé de ne plus écrire une ligne de code »).
- **Corps** : le verdict en une phrase (« c'est une galère » ; « aujourd'hui on retire tout » ; « ça tient, et ça grandit encore ») ; puis ce qui s'est passé entre les deux, dans l'ordre, avec les chiffres ; puis la décision qui en sort.
- **S'arrête** sur le nouvel état concret, pas sur une leçon.
- **Ne fait pas** : excuse, justification de la promesse ou de la décision initiale, reformulation adoucie de ce qui avait été dit.
- Observé : Jaspar « we're taking it back » (454), Lieberman 100 recrutements (333), Robinson zéro ligne de code depuis 16 semaines (210), Tibo « on m'a traité de ferme à liens, on a construit l'inverse » (7, 1,75× sa médiane). Type le plus performant du relevé (x4 sur 5 posts, chez 3 auteurs) ; **trois des cinq reviennent sur une décision, pas sur une promesse chiffrée**, d'où `tient` vers une `décision`. La même forme vaut pour la promesse **non** tenue : seule la phrase de verdict change.

### Offre (genre `offre`)

- **Lit** : un événement.
- **S'ouvre** sur ce qui est proposé et à qui, dans la première phrase (« si vous tenez un blog finance ou santé, je paie double en octobre » ; « Ava 2.0 gratuite, 300 $ de crédits, sans carte »).
- **Corps** : pourquoi maintenant (un fait : « je n'ai pas assez de blogs pour mes acheteurs »), les conditions, ce que la personne obtient, dit en chiffres.
- **S'arrête** sur l'action précise et son délai (« répondez avec votre blog » ; « avant la fin du mois »).
- **Ne fait pas** : superlatif, plusieurs demandes, lien sans contexte, urgence fabriquée.
- Observé : Tibo blogs doublés (7), Lieberman sprints (133, x1,6). Dans le relevé, le type est sous la médiane (x0,77) : il vit sur la traction des autres posts.

### Question (genre `question`)

- **Lit** : un événement.
- **S'ouvre** sur la situation en une phrase (« je vais à San Francisco la semaine prochaine » ; « je prépare un défi d'ultra-endurance »).
- **Corps** : les options et ce que l'auteur sait déjà, sans trancher.
- **S'arrête** sur la question, une seule, précise, en dernière phrase.
- **Ne fait pas** : question rhétorique, plusieurs questions, « qu'en pensez-vous ? », réponse suggérée.
- Observé : Robinson SF (91 réactions, 31 commentaires), Gambatto défi (32 réactions, 46 commentaires). Ce type se juge aux commentaires, pas aux réactions.

### Coulisses (genre `coulisse`)

- **Lit** : un événement.
- **S'ouvre** sur le fait, brut, sans lien avec le produit (« j'ai déménagé de pays trois fois » ; « j'ai donné mon sang aujourd'hui »).
- **Corps** : court. Ce que ça change, ou ne change pas, pour le travail, en une phrase (« le portefeuille SaaS n'a rien remarqué »).
- **S'arrête** sur le fait, ou sur une seule phrase qui ouvre vers le lecteur (« allez donner votre sang »).
- **Ne fait pas** : morale, lien forcé avec le produit, apitoiement, longueur.
- Observé : Lieberman week-end (258, x3,1), Simon déménagements (72, x2,1), Gambatto marathon (402). Seul type de la famille « relation » au-dessus de la médiane.

### Curation (genre `réaction`)

- **Lit** : un événement.
- **S'ouvre** sur la phrase de l'auteur, son angle, pas sur le résumé du contenu (« le client n'est plus l'humain mais l'agent, et je le vois déjà dans mon business »).
- **Corps** : ce que ça change chez lui, avec un fait propre ; le contenu tiers est nommé et crédité, jamais résumé en entier.
- **S'arrête** sur le crédit ou le lien.
- **Ne fait pas** : résumé de l'article, recopie, « à lire absolument » sans phrase personnelle.
- Observé : Simon Karpathy (81, x2,3), Pat Walls cold email (380, une ligne et une image). La version sans phrase de l'auteur (Tibo, partages secs, 1 à 4 réactions) ne marche pas.

### Origine (premier post d'un sujet ; genre `déclencheur` quand il existe)

- **Lit** : l'événement déclencheur s'il existe, et `problem` du sujet ; sinon la matière et les mots de l'auteur, comme le prompt actuel le fait déjà.
- **S'ouvre** sur un moment daté et chiffré (« j'ai quitté un job à 125 k$, 10 k$ d'économies, un appart à 150 $ ») ou sur une ligne d'identité en tension (« étudiant en santé publique et dev full stack, deux identités qui ne se parlaient pas »).
- **Corps** : le problème vu de près, avec ce qui a été entendu ou observé ; l'écart entre deux mondes ; la première chose faite.
- **S'arrête** sur la première action, et le produit n'est nommé qu'à ce moment-là, ou pas du tout.
- **Ne fait pas** : fonctionnalité, vision, chiffre d'aujourd'hui, raison inventée pour coller au lecteur (la règle du run C de `SPEC_EVENEMENT_POINTEUR.md` reste).
- Observé : Ofili intro (124, 6,5× sa médiane), Pat Walls Thaïlande (481).

### Point d'étape — hors périmètre pour l'instant

- **Lit** : les événements racontés depuis le dernier post de récit.
- **S'ouvre** sur l'intervalle, en deux dates ou deux états (« mars 2025 : un post sur une nouvelle activité. Octobre 2026 : top 50 US. »).
- **Corps** : trois ou quatre changements, chacun avec son chiffre, dans l'ordre chronologique ; pas de re-récit d'un épisode.
- **S'arrête** sur l'état d'aujourd'hui, sans projection.
- **Ne fait pas** : « récap », « bilan », liste de tout ce qui a été fait, chiffre repris d'un épisode voisin.
- Observé : Lieberman mars → octobre (197), Robinson premier post (277). Les deux font x2,3 ; les chiffres isolés font x0,8.

### Vision — hors périmètre pour l'instant

- **Lit** : `problem`, `valueProposition`, et au moins un événement `décision`.
- **S'ouvre** sur une affirmation plate, sans « je pense que » (« le SaaS parfait est 100 % self-serve »).
- **Corps** : ce que l'auteur a fait qui prouve qu'il y croit (la décision), puis ce que ça exclut.
- **S'arrête** sur l'affirmation reformulée plus court.
- **Ne fait pas** : date, chiffre d'objectif, roadmap, prédiction sur le marché sans acte derrière.
- Observé : Simon self-serve (108), Lieberman « sans honte » (572). 12 % du corpus et x0,8 : le type le plus facile à produire et le moins payant sans acte derrière.

---

## Partie 3 — Critères de lecture au banc, par forme

Un critère par forme. **Ce sont des critères de lecture, pas des contrôles automatiques** : on les vérifie en relisant les posts du banc (`scripts/bench-pointeurs.ts`, relevés dans `docs/tests/pointeurs/`), pas dans `scriptChecks.ts`. Plusieurs ne sont pas vérifiables par du code de façon fiable (« aucune phrase au futur », « la règle apparaît deux fois ») ; les contrôles existants de `scriptChecks.ts` (langue, longueurs par plateforme, répétition d'accroche) restent les seuls automatiques. Le cas de banc est un sujet entier (pack MyKiné) contenant au moins un événement par genre, dont un `engagement` et l'événement qui le `tient`, et une `décision` et l'événement qui y revient.

| Forme | Critère |
|---|---|
| Épisode | aucune phrase au futur |
| Lancement | un lieu d'accès (URL ou nom d'espace) et un chiffre |
| Teaser | une date ou un délai dans la première phrase ; le nom du produit ≤ 1 fois |
| Chiffre | un seul indicateur, et le nombre est dans `usedExcerpts` |
| Échec | aucune phrase commençant par « mais » dans les deux dernières ; aucun verbe au futur |
| Ce que j'ai appris | la règle apparaît deux fois (début et fin) ; liste ≤ 7 items |
| Preuve | un prénom ou un rôle dans la première phrase ; le nom du produit ≤ 1 fois |
| Promesse | une date ou un nombre dans la première phrase ; un nombre de départ dans la dernière |
| Promesse tenue | la phrase d'origine citée est dans l'événement source, exacte ; le verdict tient en une phrase |
| Offre | un verbe d'action à l'impératif dans la dernière phrase, un seul ; une condition ou un délai |
| Question | exactement un « ? », en dernière phrase |
| Coulisses | le nom du produit n'apparaît pas ; ≤ 600 caractères |
| Curation | le contenu tiers est crédité (nom ou lien) ; la première phrase n'est pas dans la source tierce |
| Origine | le nom du produit n'apparaît pas avant la dernière phrase |
| Toutes | la personne (je / on) est celle des notes lues pour ce post |

**Relectures faites le 2026-10-24** : `docs/tests/pointeurs/mykine-genres/criteres-gpt-6-luna.md` (9 sur 12, 2 à moitié, 1 non) et `docs/tests/pointeurs/creaflow/criteres-gpt-6-luna.md` (10 sur 12).

Côté lecteur, trois critères **sont** vérifiables par le code et le seront : sur le pack, 100 % des événements ont un genre ; 0 `engagement` sans échéance ni nombre dans la ligne ; chaque `tient` pointe vers un `engagement`, une `annonce` ou une `décision` antérieur du même sujet.

---

## Journal des décisions

**2026-10-24, écriture.** Le relevé de 274 posts est fait le 23 ; la spec est écrite contre le lecteur d'événements (prompt 21) et le rédacteur par événement (prompt 23), avec la forme portée par le créneau du calendrier.

**2026-10-24, réécriture sur la chaîne pointeur.** Le même jour, `SPEC_EVENEMENT_POINTEUR.md` a remplacé les prompts 21, 23 et 28 par l'extracteur de pointeurs et le rédacteur à pointeurs, et retiré tous les champs des événements. Les rôles sont les mêmes (un lecteur qui pose les événements, un rédacteur qui écrit), la spec les désigne désormais par leurs fichiers. Trois décisions :

- **Le genre est un champ sur le pointeur**, assumé comme la seule exception à « aucun champ ». Raison : c'est une classification fermée faite au moment où le lecteur lit déjà la ligne ; ce qui a été retiré (titre, résumé, conséquence, public) était de l'invention en double, pas une classification.
- **La forme est prise par le rédacteur, pas par le calendrier.** Raison technique : sur `main`, le créneau n'a pas d'événement avant l'écriture. Raison produit, donnée par l'auteur du projet : si la personne n'aime pas du tout le sujet d'un post, elle utilise « autre idée », qui existe déjà, et le rédacteur repart sur une autre matière. Une forme figée sur le créneau empêcherait ce changement de matière.
- **`tient` peut pointer vers une `décision`**, avec la forme Promesse tenue et un verdict sur la décision. Raison : trois des cinq posts du type le plus performant du relevé (x4) reviennent sur une décision passée, pas sur une promesse chiffrée ; sans cette extension ils seraient des épisodes ordinaires.

Et trois précisions : les étiquettes sont en anglais parce que l'app l'est ; la Partie 3 devient des critères de lecture au banc, pas des contrôles de `scriptChecks` (plusieurs ne sont pas vérifiables par du code) ; et une section « la personne qui parle » fixe le « je » / « on » depuis les notes, parce que c'est ce genre de détail qui fait qu'un post sonne humain.
