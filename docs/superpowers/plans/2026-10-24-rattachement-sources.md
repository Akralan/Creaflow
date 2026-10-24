# Plan — Rattacher une source à un projet existant depuis Business context

Spec : `docs/SPEC_RATTACHEMENT_SOURCES.md` (validée sur maquette le 2026-10-24). Maquette : `docs/tests/notion-rattachement-mockup/index.html`. Branche : `feature/rattachement-sources`, partie de `main` après le merge de `feature/formes-et-genres`.

Ce que le plan ne touche pas : l'onboarding (sujet par candidat puis regroupement), Settings › Catalogue (gardé un temps), la lecture des bases Notion (chantier séparé), la création d'un projet.

## Ce qui existe et qu'on réutilise

- `GET/POST /api/connectors/:provider/candidates` (`src/app/api/connectors/[provider]/candidates/route.ts`) : générique, GitHub compris (`TYPE_BY_PROVIDER`). Le panneau n'utilise que cette route, pour les trois fournisseurs.
- `createSourcesFromCandidates(userId, type, candidates)` (`src/lib/services/sourceConnectorService.ts`) : insère un sujet par candidat, puis `syncSource`, qui appelle `scheduleEventReading`.
- `handleOAuthStart(provider, returnTo)` (`src/lib/oauth/handlers.ts`) : `returnTo` est un chemin interne vérifié par `safeReturnPath`, relu au retour.
- `GET /api/profile` rend `connectedProviders` : les comptes OAuth liés. `GET /api/products`, `GET /api/material-sources?productId`.
- `countUnreadDocuments(userId, productId)` (`materialEventService.ts`) et la lecture en fond déclenchée par l'ingestion.
- Le design `.ap` : `card`, `src-row`, `src-ic`, `src-txt`, `conn`, `status`, `btn btn-ink btn-sm`, `k`, `sub`, `logo`.

## Tâche 1 — Le service accepte un projet par candidat

`src/lib/services/sourceConnectorService.ts`

1. `ConnectorCandidate` reçoit un champ optionnel `productId?: string | null` dans la forme que le service accepte (pas dans `src/lib/connectors/types.ts`, qui décrit ce que le connecteur produit : on enveloppe, `candidates: Array<ConnectorCandidate & { productId?: string | null }>`).
2. Dans la boucle : si `productId` est donné, vérifier qu'il appartient à l'utilisateur (`requireOwnedProduct` existe dans `materialEventService.ts` ; le déplacer dans `productsService.ts` ou le réexporter), ne pas insérer de sujet, créer la source sur ce projet. Sans `productId` : comportement actuel, inchangé.
3. La limite (`MAX_PRODUCTS` / `MAX_ONBOARDING_SOURCES`) ne compte que les candidats **sans** `productId`.
4. `CreatedSourceResult` garde `productId` : c'est celui du projet rejoint.

Test : `sourceConnectorService.test.ts` ne couvre que les fonctions pures ; ajouter `countNewSubjects(candidates)` en pure et le tester (candidats avec et sans projet). Le reste s'essaie en réel.

Commit : `feat(sources): une source peut rejoindre un projet existant`.

## Tâche 2 — La route dit où un candidat est déjà branché, et accepte le projet cible

`src/app/api/connectors/[provider]/candidates/route.ts`, `src/lib/services/sourceConnectorService.ts`, `src/lib/apiClient.ts`

1. `listConnectedExternalIds` devient `listConnectedSources(userId, type)` → `Map<externalId, { productId, productName }>` (jointure `material_sources` → `products`). Garder l'ancien nom comme enveloppe si le route GitHub l'utilise encore.
2. GET : chaque candidat rend `connectedTo: { productId, productName } | null` en plus de `alreadyConnected` (gardé pour `SourcePicker`).
3. POST : `connectSchema` accepte `productId: z.uuid().optional()` par candidat et le passe au service.
4. `apiClient.ts` : `SourceCandidate.connectedTo`, et `connectSources(provider, candidates)` envoie `productId` quand il est présent sur le candidat.

Test : la validation zod du POST (un candidat avec `productId` non UUID → 400) si une route est déjà testée de cette façon dans le dépôt ; sinon rien d'automatisé.

Commit : `feat(sources): la liste des candidats dit le projet qui les lit, et le POST accepte un projet cible`.

## Tâche 3 — L'état de lecture d'une source

`src/lib/services/materialEventService.ts`, `src/app/api/material-sources/[id]/status/route.ts`, `src/lib/apiClient.ts`

1. `sourceReadingStatus(userId, sourceId)` → `{ documents, unread, events }` : documents de la source, ceux dont `eventsReadAt` est null, et le nombre de `material_events` dont le document appartient à la source.
2. Route `GET /api/material-sources/:id/status` qui le rend. Pas la liste des événements : `GET /api/events` rend tous les pointeurs du sujet, trop lourd pour un sondage.
3. `apiClient.getMaterialSourceStatus(id)`.

Test : la fonction prend des lignes et compte ; en extraire la partie pure (`summarizeReading(docs, eventCounts)`) et la tester.

Commit : `feat(sources): l'état de lecture d'une source (documents, non lus, événements)`.

## Tâche 4 — Le panneau dans Business context

`src/components/app/SourcePanel.tsx` (nouveau), `src/components/app/ContextScreen.tsx`, `src/components/app/app-extra.css`

1. **Ouverture.** Dans la carte Sources, le bouton d'un fournisseur (GitHub, Notion, Linear) remplace le lien vers Settings :
   - fournisseur dans `connectedProviders` → ouvre le panneau pour ce fournisseur ;
   - sinon → `/api/auth/oauth/<provider>/start?returnTo=/context?connect=<provider>`.
   Au montage, `useSearchParams().get("connect")` ouvre le panneau du fournisseur nommé. Le lien « Markdown notes » ne change pas.
2. **Chargement.** `api.getProducts()` (tous les projets, pour les blocs) et `api.getSourceCandidates(provider)`. Le projet par défaut est celui que l'écran affiche (`product`).
3. **Liste.** Une ligne par candidat : case (`pk-check`), icône, `subjectName` en titre, `hint` en sous-titre (c'est le connecteur qui compose « 38 subpages · 4 databases » ; Notion le dit déjà pour les pages, le compléter pour les bases dans `notion.ts › candidateHint` si besoin). Candidat `connectedTo` → ligne grisée, texte « in <projet> », non cochable.
4. **Cocher.** Ajoute le candidat à la sélection avec `productId = product.id`, et ouvre sous la ligne les blocs (`pk-menu` / `pk-cube`) des projets **seulement si `products.length > 1`**. Cliquer un bloc change `productId` et ferme. Décocher ferme. À droite, `pk-to` affiche la destination (statique, non cliquable : c'est la case qui ouvre).
5. **Bouton.** « Add to <projet> », ou « Add to N projects » quand les destinations diffèrent ; désactivé sans sélection. Au clic : `api.connectSources(provider, chosen)` ; les lignes cochées passent en `status writing` « Reading… ». Puis sondage de `getMaterialSourceStatus` pour chaque source rendue, toutes les 3 s, jusqu'à `unread === 0` ; la ligne affiche « <events> events found ». Une source en erreur (`result.error`) affiche l'erreur sur sa ligne, les autres continuent.
6. **Fin.** Quand toutes les sources sont lues, le panneau se replie en une ligne : « N pages added to <projet>. E events found. Your next posts can tell them. » avec « Add more pages » qui le rouvre. `ContextScreen` recharge `getMaterialSources(product.id)` : la ligne Notion passe à « Connected · N pages · <projet> », le moteur compte la source.
7. **CSS.** Reprendre de la maquette les classes `pick`, `pick-head`, `pk-list`, `pk-row`, `pk-check`, `pk-txt`, `pk-to`, `pk-static`, `pk-menu`, `pk-cube`, `pk-foot`, `pk-done`, `status.writing`, `status.done` dans `app-extra.css`. Sur téléphone, les blocs passent sous la ligne sans retrait (la maquette le fait à 640 px).
8. Le composant ne connaît pas le fournisseur : textes et compteurs viennent de la route (`displayName`, `emptyMessage`, `hint`), comme `SourcePicker`.

Test : les composants ne sont pas testés dans ce dépôt ; extraire en pur `destinationLabel(selection, products)` (« Add to CreaFlow » / « Add to 2 projects ») et `summarizePanel(results, statuses)` et les tester dans `SourcePanel.test.ts`.

Commit : `feat(context): brancher une source depuis Business context, vers un projet existant`.

## Tâche 5 — Documentation

1. `docs/SPEC_RATTACHEMENT_SOURCES.md` : statut « implémenté le … », ce que l'essai réel a changé.
2. `CLAUDE.md` : l'entrée passe à « implémenté », rappel que Settings › Catalogue reste.
3. `docs/TECH.md` : les deux routes (`connectedTo`, `productId` au POST ; `GET /api/material-sources/:id/status`).
4. `docs/DEVLOG.md` : entrée du jour, avec la raison du rattachement et la décision « pas de nouveau projet ici ».

Commit : `docs(sources): rattachement implémenté`.

## Essais en réel, dans l'ordre

1. Compte à un projet, Notion autorisé : « Connect » ouvre le panneau, deux pages cochées, pas de blocs, « Add to CreaFlow », lignes en lecture puis compte d'événements, repli, Notion « Connected » dans Sources. Vérifier en base que `source_materials.product_id` et `material_events.product_id` sont ceux du projet.
2. Même compte, Notion non autorisé : « Connect » part en OAuth et revient sur `/context?connect=notion` avec le panneau ouvert.
3. Compte à deux projets : une page vers chaque, « Add to 2 projects », chaque ligne de temps reçoit les siens.
4. Page déjà branchée : grisée avec le nom du projet.
5. GitHub : un second dépôt rejoint le projet ; le dépôt déjà branché est grisé.
6. L'onboarding et Settings › Catalogue font exactement ce qu'ils faisaient (sujet par candidat).

## Ce que la revue doit regarder

- `productId` d'un autre utilisateur au POST → 404, pas une source greffée sur un projet étranger.
- Aucun sujet créé quand `productId` est donné, même si la limite de sujets est atteinte.
- Le sondage s'arrête (toutes lues, ou erreur) et ne survit pas au démontage du composant.
- `safeReturnPath` accepte `/context?connect=notion` (il contient `?` et `=`).
