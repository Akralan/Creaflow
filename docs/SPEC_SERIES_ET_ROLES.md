# SPEC — SÉRIES & RÔLES ÉDITORIAUX (rétrogradation des catégories)

> **Statut : implémenté (Lots 0 à 4), migration de données appliquée en dev le 2026-08-26. Non testé avec une vraie clé LLM.** Ce document ne modifie pas les specs précédentes ; il recadre l'UX au-dessus d'un modèle de données qui reste en place.
>
> **Objectif.** Constat en usage réel : « catégories de contenu » et « séries » sont perçues comme la même chose, et manipuler les deux est moins lisible que n'en manipuler une. Le diagnostic n'est pas que le modèle est faux — une catégorie est un *rôle* dans le mix (axe d'allocation, comme l'angle), une série est un *format* avec une identité et une continuité — mais que l'UI expose les deux comme des objets jumeaux (même champs, même geste, mêmes écrans). Ce chantier garde le modèle, et fait de la **série le seul objet éditorial que l'utilisateur manipule** ; la catégorie devient un **rôle**, propriété d'une série ou d'un créneau libre, et rejoint l'angle dans la famille des mécanismes que le produit gère à la place de l'utilisateur.
>
> **Conventions.** Les noms de symboles existants font foi (`contentCategories`, `contentSeries`, `contentSeriesCategories`…). Le code garde le vocable `category` partout ; seul le vocable **affiché** change (« rôle »), sur le même précédent que `products` → « sujets » (`docs/SPEC_MATIERE_EDITEUR.md` §3.3).

---

## 1. Décisions tranchées (récapitulatif)

| Sujet | Décision |
| :--- | :--- |
| Modèle de données | **Pas de fusion.** `contentCategories` reste la table des rôles (poids normalisé, `materialHungry`, cible du rééquilibrage par métriques). `contentSeries` reste la table des formats. Fusionner ferait perdre le rééquilibrage (qui a besoin d'un petit nombre de rôles stables) et l'aiguillage matière×catégorie. |
| Cardinalité | **Une série a exactement un rôle.** Une série à deux rôles est le symptôme de deux séries. La jonction `contentSeriesCategories` est conservée physiquement (pas de migration de colonne) mais l'invariant « une ligne par série » est imposé par le service. Migration de données : pour une série multi-rôles, garder le rôle de plus fort poids, archiver le lien des autres (journalisé). |
| Vocabulaire affiché | « **Rôle** » (ou « rôle éditorial ») partout dans l'UI, jamais « catégorie ». Exemples de rôles : Expertise, Coulisses, Preuve sociale, Opinion. |
| Objet de premier rang | **La série.** C'est le seul objet que l'utilisateur crée, nomme, décrit, pondère, cible par réseau, rattache à un sujet. Le rôle est un champ obligatoire de la série (sélection unique parmi les rôles actifs). |
| Créneau libre | Un créneau sans série est un **post libre** : il porte un rôle, jamais un format. `calendarEntries.contentCategoryId` reste NOT NULL. Affichage : « Post libre · Expertise ». |
| Ordre de choix | Sur toutes les portes de génération (créneau, génération libre, import), l'utilisateur choisit **d'abord la série** (ou « post libre »), le rôle en découle. En post libre uniquement, il choisit le rôle. C'est l'inverse de l'existant. |
| Poids des rôles | **Sort du parcours principal.** Le mix des rôles reste calculé et appliqué (calendrier), mais l'utilisateur ne le pondère plus à la main dans Direction ni dans l'onboarding. Il évolue par (a) génération IA initiale, (b) propositions de rééquilibrage à partir des métriques, (c) l'assistant chat. Un onglet **Avancé** dans Paramètres garde l'édition complète des rôles (libellé, description, `materialHungry`, poids) pour qui veut ouvrir le capot. |
| Onboarding | Les rôles sont générés silencieusement (comme les angles). L'écran ne montre que les séries proposées, chacune avec son rôle. `CategoryLabelsPanel` disparaît de l'onboarding. |
| Direction | Un seul type d'objet (séries). Ajout d'un bandeau **Mix éditorial** en lecture seule : la part de chaque rôle sur le calendrier (séries + posts libres), avec un lien vers l'onglet Avancé. |
| Modes de série | Inchangés (`feuilleton` / `rendez_vous`). Pas de mode `libre` : une série `rendez_vous` sans état narratif joue déjà ce rôle, et un post sans format est un post libre, pas une série. |
| Rééquilibrage, angle LRU, aiguillage matière | **Inchangés** : ils travaillent sur le rôle du créneau/script, qui existe toujours. Seul le texte des propositions passe au vocable « rôle ». |
| Prompts de génération de script | **Inchangés** : `categoryLabel` et `seriesLabel/description` restent injectés à l'identique. Le contrat du rédacteur ne bouge pas. |
| Suggestion de séries par IA | `suggestContentSeries` renvoie **un** `categoryLabel` par série (au lieu d'une liste). Une série dont le label ne résout vers aucun rôle actif est écartée, comme aujourd'hui. |
| Assistant chat | Les propositions `series_create` / `series_update` portent un seul rôle. `category_create` / `category_update` restent possibles (l'assistant est l'une des deux voies légitimes de modification des rôles) mais le prompt lui demande de privilégier les propositions de séries et de ne toucher aux rôles que sur demande explicite ou rééquilibrage. |
| API | Rupture assumée (mono-utilisateur, branche feature) : `categoryIds: string[]` → `categoryId: string` sur `POST /api/series` ; `categories: [{id,label}]` → `category: {id,label}` en réponse. Pas de double lecture. |

---

## 2. Modèle mental cible

```
Rôle (contentCategories)        — POURQUOI ce post existe. 4-7 par utilisateur, stables,
                                  pondérés par le produit (IA, métriques, assistant).
   │
   ├── Série (contentSeries)     — À QUOI il ressemble et OÙ ON EN EST. Nommée, décrite,
   │     rôle unique, mode, sujet, réseaux, poids absolu. L'objet que l'utilisateur manipule.
   │
   └── Post libre                — un créneau avec un rôle et sans format.

Angle (contentAngles)           — COMMENT il accroche. Imposé par LRU dans le rôle. Invisible.
```

Le calendrier se remplit toujours en deux temps (inchangé) : répartition des créneaux entre rôles selon le mix, puis promotion d'une partie des créneaux en séries selon leur poids absolu. La seule différence : une série promue impose son rôle unique au créneau (plus de round-robin).

---

## 3. Modèle de données & invariants

Aucune migration de schéma. Un script de migration de données (Lot 0) :

```
Pour chaque série active ayant > 1 ligne dans contentSeriesCategories :
  garder la ligne dont la catégorie a le poids le plus élevé (égalité : label ASC)
  supprimer les autres lignes (journaliser seriesId + categoryIds retirés)
```

Invariants imposés par les services (pas par la DB) :

- `upsertSeriesItem` / `saveContentSeriesForUser` : **exactement un** `categoryId`, actif, sinon 400.
- `resolveCategoryLabelsToIds` → `resolveCategoryLabelToId(label): string | null`.
- `listActiveSeriesForUser` renvoie `category: { id, label }` (singulier). Toute lecture de `s.categories` disparaît du code.
- `calendarEntries.contentCategoryId` : reste NOT NULL. Quand `seriesId` est posé, `contentCategoryId` **doit** égaler le rôle de la série — vérifié dans `PATCH /api/calendar/[id]` et dans le générateur (aujourd'hui non vérifié, cf. repérage).
- `scripts.contentCategoryId` : même règle à la génération (`buildGenerationContext` dérive le rôle de la série si `seriesId` est fourni, et ignore un `contentCategoryId` contradictoire).

---

## 4. Logique serveur

### 4.1 Calendrier (`calendarService.ts`)

- `SeriesWeight.categoryIds: string[]` → `categoryId: string`.
- `seriesWeightsFromSeries` : filtre les séries sans `categoryId` (au lieu de `categoryIds.length === 0`).
- `distributeSeriesOverrides` : supprime le curseur round-robin ; `categoryId` est celui de la série. Le reste (couverture jamais forcée, plafond à la baisse) est inchangé.
- `POST /api/calendar/generate` : inchangé dans sa logique ; adapte la forme des séries passées.

### 4.2 Génération de script (`scriptService.ts`)

- `buildGenerationContext` : si `seriesId` est fourni, le rôle est **dérivé de la série** ; `contentCategoryId` devient optionnel dans les payloads quand `seriesId` est présent. Sans série, `contentCategoryId` reste obligatoire (post libre).
- Routes concernées : `/api/scripts/generate`, `/api/scripts/import`, `/api/scripts/[id]/regenerate`, `/api/scripts/[id]/new-idea`, `/api/series/from-material` — même règle de résolution, centralisée dans un helper `resolveCategoryForGeneration({ seriesId, contentCategoryId })`.

### 4.3 Suggestion IA (`seriesLabels.ts`, `categoryLabels.ts`)

- `suggestContentSeries` : schéma de sortie `categoryLabel: string` (unique). Prompt ajusté : « chaque série sert **un** rôle éditorial ; si tu hésites entre deux rôles, ce sont deux séries ».
- `suggestContentCategories` : inchangé (génère les rôles). Le prompt peut renommer « catégorie » en « rôle éditorial » dans ses consignes pour rester cohérent avec ce que l'utilisateur lira dans les propositions d'assistant — sans changer le schéma.

### 4.4 Assistant (`assistantService.ts`, prompt assistant)

- `series_create` / `series_update` : `categoryLabel` unique. `resolveProposal` appelle `upsertSeriesItem` avec un seul id.
- Prompt système : ajouter la règle de priorité (séries d'abord, rôles seulement sur demande explicite ou rééquilibrage) et le vocabulaire « rôle éditorial » dans les textes visibles par l'utilisateur.
- `category_*` : conservés tels quels.

### 4.5 Rééquilibrage (`categoryReweightService.ts`)

- Logique intacte. Seul le texte de la proposition (`AssistantProposalsPanel`) affiche « rôle ».

### 4.6 Onboarding (`onboardingService.ts`)

- `finalizeOnboarding` : inchangé (rôles puis séries). Le changement est uniquement côté écran.

---

## 5. UI

### 5.1 Direction (`direction/page.tsx`, `SeriesPanel.tsx`)

- `SeriesPanel` : les pastilles multi-sélection de catégories deviennent un **sélecteur unique de rôle** (obligatoire). Validation : « Chaque série doit avoir un rôle ». Le reste du formulaire (label, description, poids, réseaux) est inchangé ; mode et sujet restent gérés par `NarrativeArcSection`.
- Bibliothèque : une seule pastille de rôle par série.
- Nouveau bandeau **Mix éditorial** (composant `EditorialMixStrip`), lecture seule, placé sous le titre :
  - une barre segmentée : part de chaque rôle (poids normalisé, filtré par réseau si un filtre réseau existe ; sinon global) ;
  - sous-texte : « Les posts libres sont répartis entre ces rôles. Ce mix évolue à partir de tes performances. » + lien « Régler manuellement » → Paramètres › Avancé.
- Texte d'intro de la page : « Tes séries — les formats récurrents qui donnent une identité à ton contenu — et le rôle que chacune joue dans ton mix. »

### 5.2 Onboarding (`onboarding/page.tsx`)

- Retirer `CategoryLabelsPanel`. Les rôles sont générés à la finalisation sans étape visible.
- `SeriesPanel` reste, avec le sélecteur de rôle unique.

### 5.3 Paramètres (`settings/page.tsx`, `CategoryLabelsPanel.tsx`)

- Onglet « Catégories » → onglet **« Avancé »** (ou sous-section « Rôles éditoriaux » dans un onglet Avancé). `CategoryLabelsPanel` conservé intégralement (libellé, description, poids, `materialHungry`, réseaux, régénération IA), précédé d'un avertissement : « Les rôles structurent ton calendrier et sont ajustés automatiquement à partir de tes performances. Modifie-les seulement si tu sais ce que tu fais. »

### 5.4 Calendrier (`calendar/page.tsx`)

- Chip de créneau : `série.label` si série, sinon « Post libre · {rôle} ». La couleur reste celle du rôle (`resolveCategoryMeta`), pour que le mix reste lisible d'un coup d'œil.
- Modale d'édition de créneau : **inversion**. Premier choix = liste des séries disponibles sur ce réseau + « Post libre ». Si série : rôle affiché en lecture seule. Si post libre : sélecteur de rôle. Suppression du filtrage « séries compatibles avec la catégorie choisie ».
- Placement d'un script existant sur un créneau : inchangé (le script porte déjà les deux).

### 5.5 Génération & import (`GenerateForm.tsx`, `ImportScriptForm.tsx`, `scripts/new/page.tsx`)

- Même inversion que 5.4 : série d'abord (avec « Post libre »), rôle ensuite seulement si post libre.
- Le payload envoie `seriesId` seul quand une série est choisie (le serveur dérive le rôle), `contentCategoryId` seul en post libre.

### 5.6 Propositions d'assistant (`AssistantProposalsPanel.tsx`)

- Rendu des propositions `series_*` : un rôle. Rendu des `category_*` et du rééquilibrage : vocable « rôle ».

### 5.7 Textes & vocabulaire

Tout libellé visible passe de « catégorie (de contenu) » à « rôle (éditorial) » : Direction, calendrier, formulaires, Paramètres, propositions, messages d'erreur. Le code, les routes, les types TypeScript et les prompts internes gardent `category`.

---

## 6. Ce qui ne change pas (à ne pas toucher)

- Schéma Drizzle et migrations SQL.
- Prompts de génération de script (`SCRIPT_SYSTEM_PROMPT`, `buildScriptUserMessage`) et leur baseline.
- Rédacteur en chef (`narrativeDirector.ts`, `NarrativeState`) : il est indexé par série/sujet, pas par rôle.
- Angle LRU, aiguillage `materialHungry`, rééquilibrage par métriques, quota.
- Écrans Performance et scripts.

---

## 7. Risques & garde-fous

| Risque | Garde-fou |
| :--- | :--- |
| Migration de données retire un rôle légitime d'une série multi-rôles | Journal explicite ; la série reste utilisable ; l'utilisateur peut recréer une seconde série. Mono-utilisateur à date. |
| Le mix des rôles devient invisible et l'utilisateur ne comprend plus pourquoi tel post libre a tel rôle | Bandeau Mix éditorial en lecture seule sur Direction + chip « Post libre · Rôle » sur chaque créneau. |
| L'assistant continue de proposer des `category_create` à tout-va | Règle de priorité explicite dans le prompt ; vérifiée par test mocké. |
| Un appel API envoie `seriesId` + un `contentCategoryId` contradictoire | `resolveCategoryForGeneration` ignore le second et journalise ; `PATCH /calendar/[id]` renvoie 400. |
| Un rôle archivé alors qu'une série l'utilise encore | `saveCategoriesForUser` refuse l'archivage d'un rôle porté par une série active (400 avec la liste des séries). Aujourd'hui non vérifié. |

---

## 8. Plan d'implémentation par lots

Chaque lot est livrable seul, tests verts, sans casser le lot précédent. Ordre imposé : le serveur d'abord (Lot 0), les prompts ensuite (Lot 1), puis l'UI (Lots 2-3), puis la doc (Lot 4).

### Lot 0 — Invariant « un rôle par série » côté serveur

Fichiers : `seriesService.ts`, `calendarService.ts` (+ test), `scriptService.ts`, `api/series/route.ts`, `api/series/[id]/route.ts`, `api/calendar/generate/route.ts`, `api/calendar/[id]/route.ts`, routes de génération/import/regenerate/new-idea/from-material, `categoryLabelsService.ts`, `apiClient.ts` (types), script `scripts/migrate-series-single-role.ts`.

1. `seriesService` : `categoryIds` → `categoryId` (saisie et lecture) ; `resolveCategoryLabelToId` ; `listActiveSeriesForUser` renvoie `category`.
2. `calendarService` : `SeriesWeight.categoryId`, `distributeSeriesOverrides` sans round-robin ; mettre à jour `calendarService.test.ts`.
3. Helper `resolveCategoryForGeneration` dans `scriptService`, branché sur toutes les routes de génération ; `contentCategoryId` optionnel si `seriesId`.
4. `PATCH /api/calendar/[id]` : cohérence série↔rôle (400).
5. `categoryLabelsService.saveCategoriesForUser` : refus d'archiver un rôle porté par une série active.
6. Script de migration de données (idempotent, journalisé), exécuté une fois en dev.
7. Types `apiClient.ts` : `ContentSeries.category`, payloads.

Critère de sortie : `npm run test` vert ; le front compile encore (les composants lisant `s.categories` sont adaptés a minima ici, la refonte UX est aux Lots 2-3).

### Lot 1 — Prompts & assistant

Fichiers : `seriesLabels.ts`, `categoryLabels.ts`, prompt assistant, `assistantService.ts` (+ tests mockés).

1. `suggestContentSeries` : `categoryLabel` unique + consigne « un rôle par série ».
2. Assistant : `series_*` avec un rôle ; règle de priorité séries > rôles ; vocable « rôle éditorial » dans les textes destinés à l'utilisateur.
3. Tests mockés : une réponse LLM avec deux labels est rejetée par le schéma ; une proposition `series_create` accepte et persiste un seul rôle.

### Lot 2 — Direction & onboarding & paramètres

Fichiers : `SeriesPanel.tsx`, `direction/page.tsx`, nouveau `EditorialMixStrip.tsx`, `onboarding/page.tsx`, `settings/page.tsx`, `CategoryLabelsPanel.tsx`.

1. `SeriesPanel` : sélecteur unique de rôle, validation, une pastille.
2. `EditorialMixStrip` (lecture seule) sur Direction.
3. Onboarding sans `CategoryLabelsPanel`.
4. Paramètres : onglet Avancé + avertissement.
5. Passe de vocabulaire sur ces écrans.

### Lot 3 — Calendrier & portes de génération

Fichiers : `calendar/page.tsx`, `GenerateForm.tsx`, `ImportScriptForm.tsx`, `scripts/new/page.tsx`, `AssistantProposalsPanel.tsx`.

1. Chip « Post libre · Rôle » ; couleur par rôle conservée.
2. Modale d'édition de créneau inversée (série d'abord).
3. `GenerateForm` / `ImportScriptForm` inversés ; payloads `seriesId` seul ou `contentCategoryId` seul.
4. Propositions : vocable « rôle ».
5. Passe de vocabulaire sur ces écrans.

### Lot 4 — Documentation

`docs/PRODUCT.md` (Modules D et E, §3 schéma), `docs/TECH.md` (endpoints séries, contrat `category`), ce document passé en statut « implémenté ».

### Validation de fin de chantier (usage réel)

Sur le compte du fondateur, après migration : (1) Direction ne montre qu'un type d'objet et le mix reste lisible ; (2) créer une série ne demande qu'un rôle ; (3) générer depuis un créneau de série ne demande aucun choix de rôle ; (4) un post libre affiche son rôle sur le calendrier ; (5) le rééquilibrage continue de produire des propositions sur les rôles.
