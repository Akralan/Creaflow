# SPEC — RÉDACTEUR EN CHEF & MÉMOIRE NARRATIVE

> **Statut : à implémenter, en une fois.** Aucune décision ouverte — tout a été tranché en discussion (§1). Ce document est autonome : il ne modifie PAS les documents précédents (`SPEC_PROMPT_GENERATION*.md`), dont les mises à jour sont déjà implémentées et validées par baseline.
>
> **Objectif.** Le pipeline actuel est un bon *rédacteur* sans *rédacteur en chef* : chaque script naît orphelin, sans mémoire de ce que l'audience sait déjà ni plan de ce qui vient ensuite. Symptômes constatés en usage réel : sur un corpus de runs ML, le moteur « case » un maximum de matière ou pioche un moment au milieu, au lieu de dérouler « post 1 : présenter le projet et le créateur → post 2 : le jeu/l'outil → post 3 : ce qu'est PPO → puis les runs dans l'ordre → puis la décision ». Ce chantier ajoute l'étage qui manque : un cerveau **avec état** qui décide de l'histoire, au-dessus du rédacteur **sans état** qui l'exécute.
>
> **Conventions pour l'implémentation.** Les noms de fonctions/symboles existants font foi ; les chemins de fichiers sont indicatifs (à ajuster à l'arborescence réelle). Tous les textes de prompts sont fournis **verbatim en Annexe B** — à recopier tels quels ; seuls les `${placeholders}` et lignes conditionnelles sont du câblage. En cas d'écart entre le corps du document et l'annexe, l'annexe fait foi.

---

## 1. Décisions tranchées (récapitulatif)

| Sujet | Décision |
| :--- | :--- |
| Architecture | Deux cerveaux : le **rédacteur** (pipeline actuel, sans état) exécute ; le **rédacteur en chef** (nouveau, seul détenteur de mémoire) décide de l'histoire et ne rédige jamais. Le chef n'est **jamais bloquant** : pas d'état, erreur d'appel, ou flag désactivé → pipeline actuel inchangé. |
| Mémoire | `NarrativeState` par sujet (série > produit > marque). On stocke uniquement l'**indérivable** (arc, beats, promesses, callbacks, contrat de format) ; le publié et la matière consommée se dérivent de l'existant (`Script.concept` publiés, marquage `[déjà utilisé]`). |
| Lecture du corpus | Le chef ne lit **jamais** les documents bruts : chaque document est lu intégralement **une fois, à l'ingestion**, par un résumeur orienté potentiel narratif (`MaterialDocument.summary`, 1-2 phrases, éditable). Le rédacteur, lui, lit les `focusDocs` **en entier**. |
| Deux moments | Même cerveau, deux appels : **planification glissante** (bouton « Planifier la suite »/« Replanifier », + paresseuse quand l'état est `stale`) et **choix du jour** (interne, avant chaque génération quand un état existe). Jamais déclenché à l'upload (l'upload pose seulement `isStale`). |
| Modes de série | `ContentSeries.mode` : `feuilleton` (épisodes ordonnés, arc + beats — devlog, coulisses d'un projet) ou `rendez_vous` (épisodes autonomes partageant un format — news de la semaine). Inféré par le LLM à la création de série, éditable, **défaut `rendez_vous`** en cas de doute. Les promesses et callbacks vivent dans les deux modes. Un sujet hors série = arc léger (régime feuilleton). |
| Beats typés | Chaque beat porte un `kind` : `material` (focusDocs, régime factuel strict inchangé), `pedagogical` (zéro focusDoc, permission **scopée** : savoir général du domaine autorisé, faits sur le créateur toujours interdits), `personal` (source = profil + audience). La permission descend **du chef uniquement**, beat par beat — le rédacteur seul reste toujours strict. |
| Directive « mon idée » | Champ optionnel sur **toutes** les portes de génération (créneau, génération libre, nouvelle-idée). Une **graine à interpréter, jamais à copier** ; niveau 2 de la hiérarchie de priorités (à égalité série/angle), jamais au-dessus de la vérité factuelle. Quand le chef est actif, la directive passe par lui (détour d'arc assumé) ; sinon elle est injectée directement au rédacteur. |
| Select-all + commentaire | Sélection ≥ 80 % du texte du script + commentaire = geste d'intention, pas de réécriture → l'éditeur propose la bascule vers **nouvelle-idée** avec le commentaire pré-rempli en directive. |
| Anti-casage | Nouvelle règle de sélection dans le system prompt rédacteur : choisir UN moment, ignorer délibérément le reste — « ce que tu n'utilises pas servira aux prochains posts, le marquage le garantit ». |
| Concept du rédacteur | Le champ `concept` reste dans le schéma **partout** (un seul contrat d'outil, tous chemins). Quand une direction du chef existe, le bloc DIRECTION lui impose de la **décliner** au lieu de choisir ; c'est le concept exécuté qui reste stocké sur `Script`, la direction étant tracée via `Script.beatId`. |
| Épisodes de série existants | Le mécanisme one-shot « série depuis la matière » (`propose_series_episodes` / `episodeDirective`) est **remplacé** par la planification du chef : les episodeDirectives deviennent des beats, le plan devient glissant. |
| Mise à jour d'état | Quasi gratuite : à la génération, beat → `drafted` + `Script.beatId` ; au passage utilisateur en `published`, beat → `published` + les `promisesMade` du script rejoignent `openPromises`. `arcSummary` n'est rafraîchi qu'à la replanification (paresseuse). Un brouillon jamais publié ne fait pas avancer l'histoire. |
| Quota | Aucun appel du chef (résumés, planification, choix du jour) ne décompte le quota de scripts (`ScriptGenerationEvent`) : appels courts, coût système. |
| Gouvernance UI | L'état vit dans l'écran **Direction**, régime `styleProfile` : auto-maintenu, entièrement visible et éditable, boutons « Planifier la suite »/« Replanifier », badge quand `stale`. Pas d'`AssistantProposal` par post. |
| Déploiement | Flag d'environnement `NARRATIVE_DIRECTOR_ENABLED` (défaut `true`) + fallback naturel (absence d'état = pipeline actuel). |

---

## 2. Modèle de données

```
NarrativeState (nouveau)
- id, userId
- productId (nullable, FK Product ON DELETE CASCADE)
- seriesId  (nullable, FK ContentSeries ON DELETE CASCADE)
- arcSummary (text, nullable — où en est l'histoire racontée à l'audience)
- beats (jsonb, défaut [] — voir forme ci-dessous ; vide en mode rendez_vous)
- openPromises (jsonb, défaut [] — [{ text, scriptId, madeAt }])
- callbacks (jsonb, défaut [] — [string])
- formatContract (text, nullable — mode rendez_vous uniquement, ex: "3 news + 1 hot take")
- isStale (bool, défaut false — posé à l'ingestion de nouvelle matière sur le sujet)
- lastPlannedAt (timestamp, nullable)
- createdAt, updatedAt
- Unicité : index unique sur (userId, COALESCE(productId,'-'), COALESCE(seriesId,'-'))
  (ou UNIQUE NULLS NOT DISTINCT si PG ≥ 15)

Forme d'un beat (jsonb) :
{ id: string,            // court, stable — le chef conserve les ids existants
  title: string,          // un MOMENT, pas un thème ("La percée du run 31", pas "Les runs")
  kind: "material" | "pedagogical" | "personal",
  angleHint: string|null,
  focusDocIds: string[],  // 1-3 ids MaterialDocument si material, [] sinon
  status: "planned" | "drafted" | "published" | "skipped",
  scriptId: string|null,
  rationale: string }     // pourquoi ce beat à cette place, une ligne

ContentSeries (ajout)
- mode (text enum 'feuilleton' | 'rendez_vous', défaut 'rendez_vous')

MaterialDocument (ajout)
- summary (text, nullable — null = pas encore résumé ; généré à l'ingestion, éditable)

Script (ajouts)
- beatId (text, nullable — id du beat dans NarrativeState.beats, traçabilité)
- promisesMade (jsonb, défaut [] — promesses déclarées par le script lui-même, consolidées à la publication)
```

**Résolution de l'état à la génération** (`resolveNarrativeState`, dans le service chef) : si le contexte a une série → état de cette série (créé paresseusement à la première planification) ; sinon si produit → état du produit ; sinon état marque (`productId` et `seriesId` null). Jamais de création implicite au choix du jour : pas d'état = pas de chef.

---

## 3. Les trois appels LLM du chef

Nouveau module `src/lib/llm/narrativePrompts.ts` + service `src/lib/services/narrativeDirector.ts`. Tous via `callStructured` (mêmes retry/fallback que la génération). Textes verbatim en Annexe B.

### 3.1 Résumeur de document (ingestion)

- **Quand :** à l'ingestion de chaque `MaterialDocument` (même pattern `after()` que le captioning des `BrandAsset`) ; backfill paresseux : toute planification commence par résumer les docs du sujet dont `summary` est null (séquentiel, puis planification).
- **Entrée :** le texte intégral du document (un seul doc par appel — c'est la condition de lecture optimale).
- **Sortie :** tool `summarize_material` → `{ summary: string }` (Annexe B.1/B.5). Stockée sur `MaterialDocument.summary`.

### 3.2 Planification glissante (`update_narrative_plan`)

- **Quand :** bouton « Planifier la suite »/« Replanifier » (écran Direction) ; automatiquement avant un choix du jour si `isStale && mode=feuilleton` (paresseux). Jamais à l'upload. **Mode `rendez_vous` : pas de planification** — pas de beats à maintenir.
- **Entrée :** system prompt chef (B.2) + consignes planification (B.2a) + contexte : profil + audience, mode, état actuel complet, **résumés** de tous les docs du sujet (id + summary + createdAt + indicateur « déjà exploité » dérivé des annotations `[déjà utilisé]`), concepts des scripts publiés du sujet (dérivés), directive utilisateur éventuelle.
- **Sortie :** tool `update_narrative_plan` → `{ arcSummary, beats[], callbacks[] }` (B.5). Règles serveur : les beats `published` existants sont **conservés tels quels** même si le LLM les omet (merge côté serveur, jamais de rétrogradation) ; `openPromises` n'est **pas** modifiable par cet appel (géré système, §5) ; `isStale=false`, `lastPlannedAt=now()`.

### 3.3 Choix du jour (`choose_daily_direction`)

- **Quand :** interne au flux de génération (§4.1), jamais un endpoint public.
- **Entrée feuilleton :** system chef (B.2) + consignes choix (B.2b) + état complet + créneau (plateforme, catégorie, contentType) + directive éventuelle + `rejectedConcepts` (si nouvelle-idée) + résumés des focusDocs candidats.
- **Entrée rendez_vous :** idem, mais à la place des beats : `formatContract`, promesses/callbacks, résumés des **20 docs les plus récents** du sujet (tri `createdAt` desc — biais de fraîcheur), concepts publiés récents de la série (anti-répétition au niveau sujet).
- **Sortie :** tool `choose_daily_direction` → `{ beatId|null, concept, kind, focusDocIds[], callbackToUse|null, promiseToHonor|null, promiseToMake|null, angleHint|null }` (B.5).

---

## 4. Intégration au pipeline de génération

### 4.1 Flux (dans `buildGenerationContext` / le service de génération)

Pour `POST /api/scripts/generate` (créneau), `POST /api/scripts` (libre) et `POST /api/scripts/:id/new-idea` :

1. Construire le contexte comme aujourd'hui.
2. Si `NARRATIVE_DIRECTOR_ENABLED` : `resolveNarrativeState()`. Pas d'état → étape 5 (pipeline actuel).
3. Si état `feuilleton` et `isStale` → replanification (§3.2) d'abord.
4. Appel choix du jour (§3.3) → objet `direction`. **Toute erreur (LLM, parsing, timeout) → log + étape 5 sans direction** — non bloquant, silencieux pour l'utilisateur.
5. Assemblage du message rédacteur :
   - avec `direction` : `materialDocuments` **restreints aux `focusDocIds`** (texte intégral + annotations, mécanique inchangée) ; nouveau bloc `=== DIRECTION ÉDITORIALE ===` inséré **entre** `=== CONTEXTE MARQUE ===` et `=== MATIÈRE ===` (texte B.3, variantes par `kind` incluses) ; `direction.angleHint` remplace l'angle de `selectLeastRecentlyUsedAngle` (qui devient le fallback sans direction) ;
   - sans `direction` : assemblage actuel inchangé, + ligne directive utilisateur (B.4) dans `=== BRIEF ===` si fournie, + variante du bloc PRIORITÉS (B.4).
6. Après génération réussie : `Script.beatId = direction.beatId`, `Script.promisesMade` = champ du tool ; si beat → `status: "drafted"`, `scriptId` renseigné dans l'état.

### 4.2 Schéma d'outil du rédacteur (`scriptSchema.ts`)

Un seul ajout, sur les 3 tools de génération : champ **`promisesMade`**, `required`, array de strings, description verbatim en B.6. Le champ `concept` ne change pas (ni position ni description) — c'est le bloc DIRECTION qui, quand il existe, lui impose de décliner plutôt que choisir.

### 4.3 Nouvelle règle anti-casage (system prompt rédacteur)

Dans `SCRIPT_SYSTEM_PROMPT`, section « Règles de qualité », insérer la règle B.7 **immédiatement après** « Un script porte UNE seule idée… ». Aucune autre modification du system prompt.

### 4.4 Remplacement des épisodes one-shot

La création de « série depuis la matière » n'appelle plus `propose_series_episodes` : elle crée le `NarrativeState` de la série et lance une planification (§3.2). Le paramètre `episodeDirective` de `buildScriptUserMessage` est déprécié (le bloc DIRECTION le remplace) — retirer son émission, conserver le type le temps de la migration. `materialEpisodes.ts` est remplacé par `narrativeDirector.ts`.

### 4.5 Génération de séries (`angleLabels.ts` / générateur de séries)

Ajouter au prompt du générateur de séries l'instruction B.8 (inférence du `mode`), et `mode` à son schéma de sortie (enum `feuilleton|rendez_vous`).

---

## 5. Cycle de vie de l'état (règles serveur, sans LLM)

- **Ingestion d'un doc** sur un sujet → `isStale = true` sur le(s) état(s) du sujet (produit + séries liées). Rien d'autre.
- **Génération** → beat `drafted` (§4.1.6).
- **Passage utilisateur du script en `published`** (geste de statut existant) → beat `published` ; chaque entrée de `Script.promisesMade` ajoutée à `openPromises` (`{text, scriptId, madeAt: now}`) si absente.
- **Choix du jour avec `promiseToHonor`** + script publié → la promesse correspondante est retirée d'`openPromises` (match sur le texte exact).
- **Plafonds** (à l'écriture de l'état) : beats ≤ 20 (les `published` les plus anciens au-delà sont retirés du jsonb — l'historique reste sur `Script.beatId`) ; `openPromises` ≤ 10 ; `callbacks` ≤ 8 ; `summary` ≤ 300 caractères (tronqué).
- **Suppression** d'un produit/série → l'état part en cascade (FK).

---

## 6. API

- `POST /api/narrative/plan` — corps `{ productId?: string, seriesId?: string, directive?: string }`. Crée l'état s'il n'existe pas, exécute backfill des résumés manquants puis la planification (§3.2), renvoie l'état complet. 409 si la cible est une série `rendez_vous` (pas de planification dans ce mode).
- `PATCH /api/narrative/:id` — éditions utilisateur : `arcSummary`, `formatContract`, `beats` (réordonner, éditer `title`/`angleHint`/`kind`, passer `skipped` — jamais créer de `published`), fermer une promesse, éditer `callbacks`. Validation serveur de la forme des beats.
- `GET` : **pas de nouvel endpoint de lecture** — étendre l'endpoint agrégé existant de l'écran Direction pour inclure les `NarrativeState` (principe « une vue = un appel », `SPEC_POC.md` §2), et l'endpoint de l'espace matière pour inclure `summary`.
- `PUT /api/materials/:id` (ou équivalent existant) — accepte l'édition de `summary`.
- Portes de génération : `POST /api/scripts/generate`, `POST /api/scripts`, `POST /api/scripts/:id/new-idea` acceptent tous `{ directive?: string }` (≤ 500 caractères).
- Le choix du jour reste interne (aucun endpoint).

---

## 7. UI (style `UI_FONCTIONNALITES.md` : ce que chaque vue doit permettre)

**Écran Direction — nouvelle section « Arc narratif » par sujet/série :**
- Voir l'`arcSummary`, la liste des beats dans l'ordre avec pour chacun : titre, kind (pastille material/pédagogique/personnel), statut (à venir / brouillon / publié / passé), lien vers le script si lié.
- Réordonner les beats (drag ou flèches), éditer titre et angleHint, passer un beat en « passé » (skipped) — jamais éditer un beat publié.
- Voir et fermer manuellement les promesses ouvertes ; voir et éditer la liste des callbacks ; éditer le `formatContract` (séries rendez_vous).
- Bouton « **Planifier la suite** » si `beats` vide, « **Replanifier** » sinon ; état de chargement pendant l'appel ; badge « Nouvelle matière non planifiée » quand `isStale`.
- Sur la carte d'une série : le mode affiché (Feuilleton / Rendez-vous), basculable ; la bascule vers `rendez_vous` conserve les beats mais masque la planification.
- États : aucun état (bouton « Planifier la suite » seul), résumés en cours de backfill (progression), échec de planification (message + retry, l'état précédent reste intact).

**Espace matière :**
- Voir le résumé sous chaque document ; indicateur « résumé en cours… » tant que `summary` est null ; éditer le résumé (édition = source de vérité, jamais régénéré automatiquement ensuite).

**Éditeur de script (`/scripts/:id`) :**
- Si `Script.beatId` : bandeau discret en tête de brief — « Épisode de l'arc : ${beat.title} » avec lien vers Direction.
- Modale nouvelle-idée : champ texte optionnel « Une idée en tête ? (optionnel) » → `directive`.
- **Bascule select-all :** si une sélection couvre ≥ 80 % des caractères du contenu du script et qu'un commentaire est soumis, ne pas appeler `rewrite_selection` : ouvrir la confirmation nouvelle-idée avec le commentaire pré-rempli en directive (l'utilisateur peut annuler et revenir à la sélection). Sous 80 % : comportement actuel inchangé.

**Calendrier / génération libre :**
- Au lancement d'une génération (créneau ou libre) : champ optionnel « Une idée en tête ? (optionnel) » → `directive`. Aucun autre changement visuel.

---

## 8. Ordre d'implémentation & test d'acceptation

| Lot | Contenu | Vérification |
| :--- | :--- | :--- |
| **A — indépendant, livrable seul** | Règle anti-casage (B.7) ; `directive` sur les 3 portes + UI ; bascule select-all ≥ 80 %. | Rejouer les briefs baseline : la règle anti-casage ne dégrade rien ; une directive fournie est interprétée, pas copiée. |
| **B1** | `MaterialDocument.summary` + résumeur (B.1) + backfill paresseux + UI matière. | Résumés des docs de runs : chacun nomme l'événement/le chiffre, pas « ce document contient ». |
| **B2** | `NarrativeState`, `ContentSeries.mode`, `Script.beatId`/`promisesMade` ; endpoints §6 ; planification (B.2/B.2a/B.5) ; UI Direction. | **Test d'acceptation nommé « scénario PPO »** ci-dessous. |
| **B3** | Choix du jour (B.2b/B.5) ; intégration §4.1 (bloc DIRECTION B.3, focusDocs, kinds, angleHint, `promisesMade` B.6) ; bandeau éditeur ; nouvelle-idée via chef ; remplacement §4.4/§4.5. | Générer les 3 premiers posts du scénario PPO de bout en bout. |
| **B4** | Cycle de vie §5 (publish → promesses, plafonds) ; badge stale ; spécificités rendez_vous (formatContract, fraîcheur). | Scénario « news de la semaine » ci-dessous. |

**Test « scénario PPO »** (le cas fondateur de ce chantier) : profil personal branding, série feuilleton, ~30 docs de runs + docs projet, état vide → « Planifier la suite ». Attendu : les premiers beats sont, dans l'ordre, une présentation du créateur/projet (`personal`), le contexte du jeu/de l'outil (`material` ou `pedagogical`), une explication de PPO/du ML (`pedagogical`), **avant** tout beat de run ; les beats de runs suivent des *moments* (une percée, un mur, une décision), jamais « les runs 1 à 15 » ; chaque beat `material` porte 1-3 `focusDocIds` ; la génération du beat pédagogique explique PPO sans `[à compléter]` et sans inventer de fait sur le projet.

**Test « news de la semaine »** : création d'une série « Les news tech de la semaine » → `mode` inféré `rendez_vous` ; aucun beat créé ; le choix du jour privilégie les docs récents non couverts et respecte le `formatContract` ; une promesse « on en reparle la semaine prochaine » faite dans un épisode ressort en `promiseToHonor` la semaine suivante.

---

## 9. Impact documentaire

- `TECH.md` §3 — tables/colonnes du §2 ; §4 — endpoints du §6 + `directive` sur les portes de génération ; §5 — nouveau sous-chapitre « rédacteur en chef » (module, prompts, flux §4.1), dépréciation `episodeDirective`/`propose_series_episodes` ; §2 — flag `NARRATIVE_DIRECTOR_ENABLED`.
- `PRODUCT.md` §3 Module B — la sélection remplace la couverture ; Module Direction — l'arc narratif, les modes de série, la mémoire d'audience comme différenciant (jumeau éditorial de la boucle de métriques).
- `UI_FONCTIONNALITES.md` — sections Direction, matière, éditeur, calendrier (§7).
- `SPEC_PROMPT_GENERATION_TECH.md` — décision ouverte n°5 (exposition du concept) : partiellement couverte par le bandeau beat ; le geste « autre idée » gagne `directive`.

---

## Annexe B — Textes à recopier tels quels

### B.1 — Prompt du résumeur de document (system prompt de l'appel `summarize_material`)

```
Tu résumes un document de matière première pour la direction éditoriale d'un créateur de contenu. En 1 à 2 phrases (40 mots maximum), dis ce qui s'est PASSÉ dans ce document et où est son potentiel narratif : l'événement, le changement, le chiffre marquant, l'échec, la décision ou la surprise. Ne décris pas le document ("ce document contient...") : raconte ce qu'il apprend. S'il ne contient que des données sans événement, dis-le en une phrase factuelle. Réponds via l'outil fourni.
```

### B.2 — System prompt du rédacteur en chef (commun aux deux appels)

```
Tu es le rédacteur en chef de ${brandName} (${activityType}). Tu ne rédiges jamais de post : tu décides de l'histoire — quel épisode raconter, dans quel ordre, pour construire une audience qui comprend, s'attache et revient.

Principes :
- Une audience se construit dans l'ordre : on présente le projet et les personnes avant d'approfondir, on pose les enjeux avant les détails techniques, on explique une notion avant de s'appuyer dessus.
- Un épisode = UN moment (un événement, une décision, un échec, un chiffre marquant) — jamais un condensé de plusieurs choses.
- Les promesses faites à l'audience sont sacrées : une promesse ouverte doit être honorée avant d'en accumuler de nouvelles.
- Les callbacks — les détails récurrents devenus familiers — créent l'attachement : réutilise-les quand c'est naturel, sans forcer.
- Tu ne connais des documents que leurs résumés : tu pointes des documents (focusDocIds), tu n'affirmes jamais un fait précis toi-même — c'est le rédacteur qui lira les documents complets et citera.
- Un plan est une hypothèse, pas un contrat : la nouvelle matière, ce qui a réellement été publié et les idées du créateur le font évoluer.
```

### B.2a — Consignes ajoutées au message de l'appel **planification** (après le contexte)

```
Mets à jour le plan éditorial via l'outil fourni.
- Conserve l'id et le statut des beats existants ; ne rétrograde jamais un beat publié ; réordonne ou ajoute librement les beats non publiés.
- Si l'audience de ce sujet est vide (aucun post publié), les premiers beats présentent : le créateur/le projet (kind "personal"), puis le contexte et les notions nécessaires (kind "pedagogical" ou "material"), avant tout épisode d'avancement.
- Un beat "material" pointe 1 à 3 documents (focusDocIds) — ceux où se trouve CE moment, pas tous les documents qui l'effleurent.
- Privilégie les documents non encore exploités ; un document déjà exploité peut resservir seulement sous un angle réellement différent.
- Si le créateur a fourni une idée, intègre-la comme un détour d'arc assumé : un beat qui l'interprète, placé où il sert le mieux l'histoire.
```

### B.2b — Consignes ajoutées au message de l'appel **choix du jour** (après le contexte)

```
Choisis la direction du prochain post via l'outil fourni.
- Mode feuilleton : prends le premier beat non couvert compatible avec le créneau (plateforme, catégorie, type de contenu). Si aucun beat ne convient, choisis le moment hors plan le plus utile à l'arc (beatId null) et explique-le dans le concept.
- Mode rendez-vous : choisis le meilleur moment de la période — matière récente d'abord, jamais un sujet déjà couvert par un post publié de la série, dans le respect du contrat de format.
- Si une promesse ouverte peut être honorée par ce créneau, honore-la (promiseToHonor) avant d'en faire une nouvelle. Jamais plus d'une promesse faite par post.
- Si le créateur a fourni une idée, elle guide ce choix : interprète-la (c'est une piste, pas un texte), et si elle sort du plan, assume le détour (beatId null).
- Si des concepts refusés te sont fournis, propose une direction réellement différente, pas une reformulation.
- Le champ "concept" est ta direction éditoriale : l'idée unique, à qui elle s'adresse, ce qu'on doit retenir — en 1-2 phrases. Ne rédige rien d'autre.
```

### B.3 — Bloc `=== DIRECTION ÉDITORIALE ===` injecté au rédacteur (entre CONTEXTE MARQUE et MATIÈRE)

```
=== DIRECTION ÉDITORIALE ===
La direction éditoriale a choisi l'épisode du jour. Ta mission est de l'exécuter, pas de choisir une autre histoire.
Épisode : ${beat.title}                                              ← si beatId non null
Direction : ${direction.concept}
Ton champ "concept" doit décliner cette direction en décision d'exécution — comment tu la racontes sur cette plateforme — jamais la remplacer par une autre idée.
Callback à replacer naturellement : ${direction.callbackToUse}       ← si présent
Promesse à honorer dans ce post : ${direction.promiseToHonor}        ← si présent
Promesse à faire en fin de post : ${direction.promiseToMake}         ← si présent
```

Si `kind = "pedagogical"`, ajouter à la fin du bloc :

```
Épisode pédagogique décidé par la direction éditoriale : tu peux utiliser le savoir général du domaine (définitions, concepts, ordres de grandeur publics) pour expliquer. Les faits spécifiques au créateur, à son projet ou à ses résultats restent soumis à la règle stricte : uniquement ce qui est dans le contexte fourni.
```

Si `kind = "personal"`, ajouter à la fin du bloc :

```
Épisode de présentation personnelle décidé par la direction éditoriale : la source est le contexte marque (identité, activité, valeurs, audience), pas la matière documentaire. La règle stricte reste entière : rien d'inventé au-delà de ce contexte — si un élément personnel manque, écris "[à compléter]".
```

### B.4 — Directive utilisateur (chemin SANS chef)

Ligne ajoutée en fin de bloc `=== BRIEF ===` si `directive` est fournie :

```
Idée soufflée par le créateur (interprète-la : c'est une piste et une intention, pas un texte à recopier ni une source de faits — les faits restent soumis aux règles ci-dessus) : ${directive}
```

Et dans le bloc `=== PRIORITÉS ===`, la ligne 2 devient (uniquement quand une directive est présente) :

```
2. La directive du créateur (à interpréter, jamais à copier), l'identité de la série et l'angle imposé.
```

### B.5 — Schémas des outils du chef (descriptions à recopier)

`summarize_material` : `{ summary: string }` — description : `"Le résumé narratif du document en 1-2 phrases, 40 mots maximum."`

`update_narrative_plan` :
```
arcSummary : "Où en est l'histoire racontée à l'audience, en 2 à 4 phrases : ce qu'elle sait déjà, ce qu'elle attend."
beats : "Le plan ordonné. Conserve les ids et statuts existants ; ne rétrograde jamais un beat publié."
beats[].id : "Id court et stable. Réutilise l'id d'un beat existant ; invente un id court pour un nouveau beat."
beats[].title : "Le moment raconté, pas un thème. « La percée du run 31 », jamais « Les runs »."
beats[].kind : "material : le récit vient des documents. pedagogical : explication d'une notion du domaine, sans document. personal : présentation du créateur/projet, source profil."
beats[].angleHint : "Forme de hook recommandée pour cet épisode, une ligne, ou null."
beats[].focusDocIds : "1 à 3 ids de documents où se trouve CE moment (kind material). [] pour pedagogical et personal."
beats[].status : "planned | drafted | published | skipped. Jamais published de ta propre initiative."
beats[].rationale : "Pourquoi ce beat, à cette place — une ligne."
callbacks : "Les détails récurrents de l'histoire devenus familiers pour l'audience (max 8)."
```

`choose_daily_direction` :
```
beatId : "Id du beat choisi dans le plan, ou null (mode rendez-vous, ou détour hors plan assumé)."
concept : "La direction éditoriale : l'idée unique de ce post, à qui il s'adresse, ce qu'on doit retenir — 1 à 2 phrases. Une décision, pas une paraphrase du créneau."
kind : "material | pedagogical | personal — même sens que dans le plan."
focusDocIds : "Les 1 à 3 documents que le rédacteur lira en entier pour écrire ce post. [] si kind n'est pas material."
callbackToUse : "Un callback à replacer naturellement, ou null."
promiseToHonor : "Le texte EXACT d'une promesse ouverte que ce post honore, ou null."
promiseToMake : "Une promesse que ce post fera en conclusion, ou null. Jamais plus d'une."
angleHint : "Forme de hook recommandée, ou null (l'angle par défaut du système s'appliquera)."
```

### B.6 — Champ `promisesMade` du rédacteur (les 3 tools de génération, `required`)

```
Les promesses explicites que ce script fait à l'audience ("je publierai le verdict", "la semaine prochaine je teste X"), copiées telles qu'elles apparaissent dans le script. Tableau vide [] si le script n'en fait aucune.
```

### B.7 — Règle anti-casage (system prompt rédacteur, insérée après « Un script porte UNE seule idée… »)

```
- Tu sélectionnes, tu ne couvres pas : choisis LE moment le plus fort de la matière fournie (un échec, une décision, un chiffre, une percée) et ignore délibérément le reste. Ce que tu n'utilises pas aujourd'hui servira aux prochains posts — le marquage [déjà utilisé] le garantit, rien n'est perdu.
```

### B.8 — Instruction ajoutée au générateur de séries (inférence du mode)

```
Pour chaque série, détermine son mode : "feuilleton" si les épisodes se suivent et construisent une progression (devlog, coulisses d'un projet, avancement d'un chantier) ; "rendez_vous" si les épisodes sont autonomes et ne partagent qu'un format (news de la semaine, sélection, FAQ, top). En cas de doute, choisis "rendez_vous".
```
