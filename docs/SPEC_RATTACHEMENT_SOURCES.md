# SPEC — Rattacher une source à un projet existant depuis Business context

Statut : **implémenté le 2026-10-24** sur `feature/rattachement-sources` (tâches 1 à 5 du plan `docs/superpowers/plans/2026-10-24-rattachement-sources.md`, 665 tests verts, lint propre), **pas encore essayé en réel** : les six essais listés en fin de spec sont à faire avec une intégration Notion configurée (`NOTION_CLIENT_ID`/`NOTION_CLIENT_SECRET` absents du `.env` de dev). Fonctionnement validé sur maquette le même jour. Maquette cliquable : `docs/tests/notion-rattachement-mockup/index.html` (CSS de l'app copié tel quel, six étapes). Se pose par-dessus `SPEC_CONNECTEURS_ET_SUJETS.md` (ce qu'est un candidat chez chaque fournisseur) et `SPEC_APP_DESIGN_TELLOVO.md` (l'écran Business context). Journal des décisions en fin de document.

## Le problème

Un projet est nourri par son dépôt GitHub. Les décisions, les choix, les clients potentiels sont ailleurs, souvent dans Notion. Aujourd'hui, brancher Notion après l'onboarding crée **un sujet par page cochée** (`createSourcesFromCandidates`), sans option : les événements de Notion tombent dans une autre ligne de temps que ceux du dépôt, et les séries n'en voient qu'une. Le seul endroit du code qui déplace une source vers un sujet est le regroupement de l'onboarding ; après, la porte est fermée. Le branchement vit en plus dans Settings › Catalogue, un écran de l'ancien design.

## Ce qu'on fait

Depuis **Business context**, brancher une source **ajoute toujours à un projet existant**. On ne crée pas de projet ici : créer un projet sera un parcours à part (nouveau dépôt GitHub d'abord, puis Notion et le reste), à spécifier plus tard.

### Le parcours

1. Dans la carte **Sources** de Business context, « Connect » sur Notion lance l'autorisation OAuth avec `returnTo=/context`. Au retour, l'écran s'ouvre avec le panneau du point 2. Linear suit le même chemin ; GitHub aussi, pour ajouter un second dépôt au même projet.
2. Un panneau **« Pages shared with Tellovo »** s'ouvre **dans l'écran**, au-dessus de la grille, pas dans Settings. Une ligne par candidat (page racine ou base partagée), avec dessous ce qu'il y a en dessous (« 38 subpages · 4 databases », « Database · 23 rows »). Un candidat déjà branché est grisé, avec le nom du projet qui le lit (« in MyKiné »).
3. **Cocher une ligne fait apparaître tout de suite, sous elle, les projets existants** sous forme de blocs, celui de l'écran déjà sélectionné. Cliquer un autre bloc change la destination ; ne rien faire la laisse. Décocher referme. À droite de la ligne, la destination reste lisible (« → CreaFlow »). Avec un seul projet dans le compte, il n'y a pas de blocs : la ligne dit sa destination et c'est tout.
4. Un seul bouton en bas, qui dit où tout part : « Add to CreaFlow », ou « Add to 2 projects » si les destinations diffèrent. Il ingère et lance la lecture des événements ; le reste de l'écran reste utilisable.
5. Pendant la lecture, chaque ligne cochée porte le même état d'attente que les posts en écriture (« Reading… », puis « Waiting » pour les suivantes). Fini, le panneau se replie en une ligne : « 3 pages added to CreaFlow. 111 events found. Your next posts can tell them. », avec « Add more pages ». Dans Sources, Notion passe à « Connected · 3 pages · CreaFlow » ; le moteur compte une source de plus.

### Règles

- Les événements d'une source rejoignent la ligne de temps du projet choisi : `source_materials.product_id` et `material_events.product_id` portent ce projet. Rien d'autre ne distingue une page Notion d'un fichier du dépôt en aval : même extracteur, mêmes genres, même rédacteur.
- Pas de « New subject » dans ce panneau. La limite de cinq sujets ne joue donc pas ici.
- Un candidat ne se branche qu'une fois par compte (unicité de `material_sources`) : grisé s'il l'est déjà, quel que soit le projet.
- Tout ce qui est sous une page cochée vient avec elle : sous-pages, et bases avec leurs lignes (voir « Ce qui reste à faire côté connecteur »).

### Ce qui change dans le code

- `createSourcesFromCandidates` reçoit un **`productId` par candidat** et n'insère plus de sujet ; la route `POST /api/connectors/:provider/candidates` l'accepte dans chaque candidat. L'onboarding garde son chemin (sujet par candidat puis regroupement) : c'est le seul endroit où un sujet naît d'une source.
- `GET /api/connectors/:provider/candidates` rend, pour un candidat déjà branché, **le nom du projet** qui le lit, pas seulement `alreadyConnected`.
- Le panneau est un composant de `ContextScreen` (design `.ap`), monté quand l'URL revient de l'OAuth ou au clic sur « Connect » d'un fournisseur déjà autorisé. Les classes de la maquette (`pk-row`, `pk-check`, `pk-menu`, `pk-cube`, `pk-to`) vont dans `app-extra.css`.
- Après l'ingestion, `scheduleEventReading(userId, productId)` comme pour toute matière ; le panneau lit l'avancement par `countUnreadDocuments` et le nombre d'événements du projet.
- Settings › Topics **est retiré** (décision du soir du 2026-10-24, qui annule celle de l'après-midi) : onglet et composants supprimés (`ProductCatalogue`, `MaterialPanel`, `MaterialInterviewChat`, `ConnectedSources`, `InspirationsPanel`), routes gardées, `ReaderPortraitPanel` et `EventTimeline` conservés dans le code. Créer un projet, coller des notes, déposer des fichiers, l'interview, resynchroniser ou délier une source n'ont plus d'écran : ils reviendront ailleurs, petit à petit.

### Ce qui reste à faire côté connecteur

Le lecteur Notion suit les sous-pages (`child_page`, 3 niveaux, 2 000 blocs) mais **pas les bases** : un bloc `child_database` n'est pas suivi, et une base partagée à la racine n'est pas lue ligne à ligne. Pour tenir « tout ce qui est dessous », chaque ligne d'une base devient une page à lire, dans le même budget de blocs. C'est un chantier séparé du panneau, à chiffrer sur un vrai espace.

### Hors périmètre

- Créer un projet depuis l'app (parcours à spécifier : GitHub d'abord, puis les autres sources).
- Déplacer une source déjà branchée d'un projet à un autre.
- Business context avec plusieurs projets : l'écran charge aujourd'hui le premier produit du compte. Un sélecteur de projet en haut de l'écran sera nécessaire au moment du parcours « nouveau projet » ; d'ici là, le projet par défaut du panneau est celui que l'écran affiche.

### Essais

- Compte à un projet, Notion : deux pages cochées, pas de blocs, « Add to CreaFlow », les événements apparaissent dans la ligne de temps du projet, le prochain post de la série peut les raconter.
- Compte à deux projets : une page vers l'un, une vers l'autre, « Add to 2 projects », chaque ligne de temps reçoit les siens.
- Candidat déjà branché : grisé avec le nom du projet, non cochable.
- Échec d'ingestion sur une page : la ligne porte l'erreur, les autres passent, la source reste resynchronisable.

## Journal des décisions

- **2026-10-24 — Rattacher à un projet existant plutôt que créer un sujet par page.** Le besoin est de compléter un dépôt avec ce que Notion sait (décisions, clients) ; une ligne de temps séparée rend ces événements invisibles aux séries du projet.
- **2026-10-24 — Le panneau vit dans Business context, pas dans Settings.** C'est l'écran qui dit ce que Tellovo sait du projet ; brancher une source en fait partie, et Settings › Catalogue est l'ancien design.
- **2026-10-24 — La destination apparaît en cochant, sous la ligne, le projet de l'écran déjà choisi.** Première version : une puce à droite qui ouvrait un menu. L'utilisateur a demandé que cocher suffise et que le bouton du bas fasse tout ; les blocs en ligne tiennent aussi sur téléphone.
- **2026-10-24 — Pas de « New subject » depuis Business context.** Créer un projet est un autre parcours, qui commence par un dépôt GitHub et demande d'autres choses à la personne. Ici on ne peut qu'ajouter à l'existant.
- **2026-10-24 — Lire les bases Notion est un chantier séparé.** Le panneau ne dépend pas de ce que le connecteur sait lire ; la promesse « tout ce qui est dessous » le demande, mais se chiffre à part.
- **2026-10-24 — Settings › Topics est retiré le soir même**, après inventaire de ce qu'il seul affichait. L'utilisateur a tranché : tout ce qui n'a pas d'autre écran reviendra ailleurs petit à petit, la liste des documents et la veille ne reviennent pas, le portrait des lecteurs et la ligne de temps gardent leur code.
