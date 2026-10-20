# Fil narratif — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** une série ne débite plus seulement des épisodes : elle pose aussi, aux bons moments, un post d'origine, un post de vision, des points d'étape et des promesses tenues, écrits à partir des mêmes événements datés.

**Architecture:** toute la décision de placement est une fonction **pure** (`src/lib/narrative/placement.ts`) qui reçoit les posts déjà écrits, la ligne de temps et les champs du sujet, et rend un type + un périmètre — testable sans base, comme `planSeriesSlots`. Un service d'I/O (`narrativeBriefService.ts`) l'alimente et construit le brief ; `generateScript` l'aiguille vers un quatrième rédacteur agentique (prompt 28), bâti sur le même squelette que `eventWriter.ts`. Les promesses sont déjà captées : il ne reste que le contrôle, l'appariement et la clôture.

**Tech Stack:** Next 16 (App Router), TypeScript, Drizzle + Postgres (pgvector), Vitest, OpenAI (`callAgentic` / `callStructured`).

**Spec:** `docs/SPEC_FIL_NARRATIF.md`

## Global Constraints

- **Aucune table nouvelle** — colonnes seulement (`src/db/schemaInvariants.test.ts` le garde).
- Les tests ne touchent **jamais** la base ni un vrai LLM : logique pure, appels modèle mockés (`npm run test`).
- Les prompts s'écrivent **en anglais** ; leurs exemples sont fictifs et sans rapport avec un domaine réel.
- Le prompt du rédacteur de récit est le **28** (le 24 est pris : « Qualification des événements par public »).
- Enum des types de récit, partout, dans cet ordre : `origin` | `vision` | `checkpoint` | `promise`.
- Un post de récit ne marque **aucun** événement comme raconté, sauf l'origine (le déclencheur) et la promesse tenue (l'événement qui la tient).
- Le chemin existant (rédacteur par événements, prompts 21/22/23) ne change pas : si aucun type de récit ne se déclenche, le code doit passer exactement comme aujourd'hui.
- Migration suivante : `drizzle/0054_*.sql`, générée par `npm run db:generate` (jamais écrite à la main sauf renommage).

## Review Focus

Cinq cas que la spec implique sans qu'une tâche les exerce naturellement. Chacun a son test, posé dans la tâche qui porte le code.

1. **Série sans sujet, sans lecteur, sans forme ou sans aucun événement** → aucun post de récit, et le chemin par événements reste intact (garde d'I/O en Tâche 7 ; ligne de temps vide testée en Tâche 2).
2. **Ligne de temps sans aucun événement daté** → pas d'origine, jamais, et aucun plantage sur le rang 1 (Tâche 2).
3. **Appariement qui rend un id inconnu ou un événement déjà raconté** → ignoré, le post reste un épisode normal (Tâche 5).
4. **Deux promesses appariées en même temps** → une seule est tenue (la plus ancienne) ; l'autre reste ouverte pour plus tard (Tâche 3).
5. **Génération d'un post de récit qui échoue** → le créneau retombe en `planned` comme aujourd'hui, jamais bloqué en `generating` (Tâche 7).

---

### Task 1: Données

**Files:**
- Modify: `src/db/schema.ts`
- Create: `drizzle/0054_fil_narratif.sql` (généré)
- Test: `src/db/schemaInvariants.test.ts` (existant, doit continuer à passer)

**Interfaces:**
- Produces: `narrativeKindEnum` (pgEnum `narrative_kind`, valeurs `origin` | `vision` | `checkpoint` | `promise`) ; `calendarEntryKindEnum` (pgEnum `calendar_entry_kind`, valeurs `event` | `narrative`) ; colonnes `calendarEntries.kind` (notNull, défaut `event`), `calendarEntries.narrativeKind` (nullable), `scripts.narrativeKind` (nullable), `scripts.promiseSourceScriptId` (uuid nullable, FK `scripts.id`, `onDelete: "set null"`), `scripts.promiseMatch` (jsonb nullable).

- [ ] **Step 1: Déclarer les deux enums et les cinq colonnes dans `src/db/schema.ts`**

Commenter chaque colonne comme le reste du fichier, en renvoyant à `docs/SPEC_FIL_NARRATIF.md` §11. `promiseMatch` porte `{ promise: string, eventId: string }` et vit sur le script **qui a fait** la promesse. `promiseHonored` existe déjà : mettre à jour son commentaire (il portait l'ancien rédacteur en chef) pour dire qu'il contient le texte exact de la promesse tenue.

- [ ] **Step 2: Générer la migration**

Run: `npm run db:generate`
Expected: un fichier `drizzle/0054_*.sql` qui ne contient que des `CREATE TYPE` et des `ALTER TABLE ... ADD COLUMN`. Le renommer en `0054_fil_narratif.sql` et corriger son entrée dans `drizzle/meta/_journal.json`.

- [ ] **Step 3: Appliquer et vérifier**

Run: `npm run db:migrate && npm run test -- schemaInvariants`
Expected: migration appliquée, test d'invariants vert (aucune table nouvelle).

- [ ] **Step 4: Commit**

```bash
git add src/db/schema.ts drizzle/
git commit -m "feat(fil-narratif): colonnes du fil narratif sur les créneaux et les scripts"
```

---

### Task 2: Placement (pur)

**Files:**
- Create: `src/lib/narrative/placement.ts`
- Test: `src/lib/narrative/placement.test.ts`

**Interfaces:**
- Consumes: rien (module pur, aucune dépendance au schéma).
- Produces:

```ts
export type NarrativeKind = "origin" | "vision" | "checkpoint" | "promise";

export interface PlacementPost { date: string; narrativeKind: NarrativeKind | null; eventId: string | null }
export interface PlacementEvent { id: string; date: string | null; kind: "failure" | "decision" | "result" | "feedback" | "milestone"; whatChanged: string | null }
export interface PlacementInput {
  written: PlacementPost[];   // posts déjà écrits de la série, par date croissante
  events: PlacementEvent[];   // ligne de temps du sujet, par date croissante, nulls en dernier
  isFirstSeries: boolean;
  subject: { problem: string | null; valueProposition: string | null };
  promiseMatch: { promise: string; sourceScriptId: string; eventId: string } | null;
}
export interface NarrativeDecision { kind: NarrativeKind; eventIds: string[]; marksTold: string | null; promise: { text: string; sourceScriptId: string } | null }

export function postRank(written: PlacementPost[]): number;
export function decideNarrative(input: PlacementInput): NarrativeDecision | null;
```

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
describe("postRank", () => {
  it("compte les dates distinctes, +1", () => {
    expect(postRank([p("2026-01-05"), p("2026-01-05"), p("2026-01-07")])).toBe(3);
  });
  it("vaut 1 pour une série vierge", () => expect(postRank([])).toBe(1));
});

describe("decideNarrative", () => {
  it("pose une origine au rang 1 de la première série", () => {
    expect(decideNarrative(input({ events: [ev("e1", "2026-01-01"), ev("e2", "2026-02-01")] })))
      .toEqual({ kind: "origin", eventIds: ["e1"], marksTold: "e1", promise: null });
  });
  it("ne pose pas d'origine sans aucun événement daté", () => {
    expect(decideNarrative(input({ events: [ev("e1", null)] }))).toBeNull();
  });
  it("rend null quand la ligne de temps est vide", () => {
    expect(decideNarrative(input({ events: [] }))).toBeNull();
  });
  it("ne pose pas d'origine sur une série qui n'est pas la première du sujet", () => {
    expect(decideNarrative(input({ isFirstSeries: false }))).toBeNull();
  });
  it("pose la vision au rang 3 quand une décision existe et que le sujet est rempli", () => { /* kind: "vision", eventIds = les ids des événements kind "decision", marksTold: null */ });
  it("reporte la vision tant qu'aucun événement de genre décision n'existe", () => { /* rang 3 sans décision → null ; rang 4 avec décision → vision */ });
  it("pose un point d'étape à partir de 3 événements racontés au whatChanged rempli et 4 épisodes normaux", () => { /* eventIds = tous les événements racontés depuis le dernier récit, marksTold: null */ });
  it("ne pose pas de point d'étape si seulement 2 événements racontés ont changé quelque chose", () => { /* null */ });
  it("ne pose pas de point d'étape avant 4 épisodes normaux depuis le dernier post de récit", () => { /* null */ });
  it("compte depuis le début de la série quand elle n'a jamais eu de post de récit", () => { /* checkpoint */ });
  it("pose une promesse tenue dès qu'un appariement existe, et marque son événement", () => { /* kind: "promise", eventIds: ["e9"], marksTold: "e9", promise: {...} */ });
  it("ne pose jamais deux posts de récit à la suite", () => { /* dernier written.narrativeKind non nul → null, même avec un appariement */ });
  it("préfère la promesse tenue au point d'étape quand les deux se déclenchent", () => { /* kind: "promise" */ });
});
```

- [ ] **Step 2: Lancer les tests pour les voir échouer**

Run: `npm run test -- placement`
Expected: FAIL, `placement.ts` n'existe pas.

- [ ] **Step 3: Implémenter `postRank` et `decideNarrative` dans `src/lib/narrative/placement.ts`**

Ordre d'évaluation, en sortant au premier qui tient : interdiction de deux récits de suite → origine (rang 1, `isFirstSeries`, un événement daté) → vision (rang 3 ou plus si reportée, `isFirstSeries`, `problem` et `valueProposition` non nuls, un événement `decision`) → promesse (`promiseMatch` non nul) → point d'étape (≥ 3 événements racontés au `whatChanged` rempli **et** ≥ 4 posts sans `narrativeKind`, tous deux comptés depuis le dernier post de récit, ou depuis le début s'il n'y en a pas). Aucune condition remplie : `null`.

- [ ] **Step 4: Lancer les tests pour les voir passer**

Run: `npm run test -- placement`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/narrative/
git commit -m "feat(fil-narratif): règles de placement des posts de récit (pur)"
```

---

### Task 3: Promesses (pur)

**Files:**
- Create: `src/lib/narrative/promises.ts`
- Test: `src/lib/narrative/promises.test.ts`

**Interfaces:**
- Consumes: `PlacementEvent` de `src/lib/narrative/placement.ts`.
- Produces:

```ts
export interface PromisingPost { scriptId: string; date: string; promisesMade: string[] }
export interface OpenPromise { scriptId: string; date: string; promise: string }

export function openPromises(published: PromisingPost[], honored: string[]): OpenPromise[];
export function candidateEvents(events: PlacementEvent[], afterDate: string, toldEventIds: string[], limit?: number): PlacementEvent[];
```

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
describe("openPromises", () => {
  it("rend les promesses des posts publiés, les plus anciennes d'abord", () => { /* tri par date croissante */ });
  it("écarte une promesse dont le texte figure déjà dans les promesses tenues", () => { /* honored: [texte] → absente */ });
  it("rend une liste vide quand aucun post publié n'a de promesse", () => expect(openPromises([], [])).toEqual([]));
});

describe("candidateEvents", () => {
  it("ne garde que les événements datés strictement après la date donnée", () => { /* même date → exclu */ });
  it("écarte les événements déjà racontés", () => { /* toldEventIds → exclus */ });
  it("écarte les événements sans date", () => { /* date null → exclu */ });
  it("plafonne à 30 candidats, les plus récents", () => { /* 50 entrées → 30, la plus récente en tête */ });
});
```

- [ ] **Step 2: Lancer les tests pour les voir échouer**

Run: `npm run test -- promises`
Expected: FAIL

- [ ] **Step 3: Implémenter les deux fonctions dans `src/lib/narrative/promises.ts`**

`limit` vaut 30 par défaut. Le tri d'`openPromises` par date croissante est ce qui réalise le point 4 de Review Focus : l'appelant prend la première et laisse les autres ouvertes.

- [ ] **Step 4: Lancer les tests pour les voir passer**

Run: `npm run test -- promises`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/narrative/promises.ts src/lib/narrative/promises.test.ts
git commit -m "feat(fil-narratif): promesses ouvertes et événements candidats (pur)"
```

---

### Task 4: Contrôle de la capture des promesses

**Files:**
- Modify: `src/lib/llm/scriptChecks.ts`
- Test: `src/lib/llm/scriptChecks.test.ts`

**Interfaces:**
- Consumes: `findBestMatchInText` de `src/lib/services/citationMatching.ts`, `postTextFields` (interne au module).
- Produces: `CheckablePost` gagne `promisesMade: string[]` ; `checkGeneratedPost` ajoute un échec quand aucune promesse déclarée n'est retrouvée dans le post.

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
describe("promesses déclarées", () => {
  it("passe quand la phrase déclarée est dans le post", () => {
    expect(checkGeneratedPost(post({ promisesMade: ["La semaine prochaine je publie le chiffre."], caption: "… La semaine prochaine je publie le chiffre." }), null, ctx())).toEqual([]);
  });
  it("passe sur une reformulation légère", () => { /* ponctuation et casse différentes → [] */ });
  it("refuse quand aucune promesse déclarée n'est dans le post", () => {
    expect(checkGeneratedPost(post({ promisesMade: ["Une phrase qui n'est nulle part."] }), null, ctx()))
      .toContain("None of the declared promisesMade can be found in the post: copy the sentences as they appear.");
  });
  it("ne dit rien quand aucune promesse n'est déclarée", () => expect(checkGeneratedPost(post({ promisesMade: [] }), null, ctx())).toEqual([]));
});
```

- [ ] **Step 2: Lancer les tests pour les voir échouer**

Run: `npm run test -- scriptChecks`
Expected: FAIL

- [ ] **Step 3: Ajouter `promiseFailures(post: CheckablePost): string[]` dans `src/lib/llm/scriptChecks.ts` et la brancher dans `checkGeneratedPost`**

Même tolérance que `citationFailures` : l'échec n'est levé que si **aucune** phrase déclarée n'est retrouvée, en cherchant avec `findBestMatchInText` dans la concaténation des champs texte du post.

- [ ] **Step 4: Lancer la suite entière**

Run: `npm run test`
Expected: PASS — les tests existants de `generateScript` et `scriptChecks` passent toujours (ils déclarent déjà `promisesMade: []`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/llm/scriptChecks.ts src/lib/llm/scriptChecks.test.ts
git commit -m "feat(fil-narratif): le code vérifie que les promesses déclarées sont bien dans le post"
```

---

### Task 5: Appariement promesse ↔ événement

**Files:**
- Create: `src/lib/llm/promiseMatch.ts`
- Test: `src/lib/llm/promiseMatch.test.ts`
- Modify: `src/lib/services/materialEventService.ts`

**Interfaces:**
- Consumes: `callStructured` de `src/lib/llm/provider.ts` ; `openPromises` / `candidateEvents` de la Tâche 3.
- Produces:

```ts
export async function matchPromiseToEvent(input: {
  promise: string;
  postText: string;
  candidates: Array<{ id: string; date: string | null; title: string; whatHappened: string }>;
}): Promise<string | null>;

export async function refreshPromiseMatches(userId: string, productId: string): Promise<number>;  // materialEventService.ts
```

- [ ] **Step 1: Écrire les tests qui échouent (modèle mocké, comme `src/lib/llm/eventReader.test.ts`)**

```ts
it("rend l'id choisi par le modèle", async () => { /* outil renvoie { eventId: "e3" } → "e3" */ });
it("rend null quand le modèle ne choisit aucun événement", async () => { /* { eventId: null } → null */ });
it("rend null quand le modèle renvoie un id absent des candidats", async () => { /* { eventId: "inconnu" } → null */ });
it("n'appelle pas le modèle sans candidat", async () => { /* candidates: [] → null, 0 appel */ });
```

(Les deux derniers couvrent le point 3 de Review Focus.)

- [ ] **Step 2: Lancer les tests pour les voir échouer**

Run: `npm run test -- promiseMatch`
Expected: FAIL

- [ ] **Step 3: Écrire le prompt 28a et `matchPromiseToEvent` dans `src/lib/llm/promiseMatch.ts`**

Un seul appel `callStructured`, outil `match_promise`, champ `eventId: string | null`. La question posée est **permissive**, parce que les promesses captées sont molles : *« Does this event let the author say what they announced? »* — pas *« does it fulfil the promise? »*. Le résultat est filtré sur la liste des candidats avant d'être rendu.

- [ ] **Step 4: Brancher `refreshPromiseMatches` dans la relecture de la matière**

Dans `src/lib/services/materialEventService.ts`, après l'enregistrement des nouveaux événements : charger les scripts `published` du sujet, `openPromises`, prendre **la première** promesse ouverte par post, `candidateEvents`, appeler le modèle, écrire `scripts.promiseMatch` sur le script qui a fait la promesse. Jamais bloquant : une panne ici est journalisée, comme `ensureReaderForSeries`.

- [ ] **Step 5: Lancer les tests et le build**

Run: `npm run test -- promiseMatch && npm run lint`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/llm/promiseMatch.ts src/lib/llm/promiseMatch.test.ts src/lib/services/materialEventService.ts
git commit -m "feat(fil-narratif): appariement d'une promesse ouverte à un événement postérieur"
```

---

### Task 6: Rédacteur de récit (prompt 28)

**Files:**
- Create: `src/lib/llm/narrativeWriter.ts`
- Test: `src/lib/llm/narrativeWriter.test.ts`

**Interfaces:**
- Consumes: `SCRIPT_CORE_PROMPT`, `callAgentic`, `checkGeneratedPost`, `splitDocumentIntoParts`, `BriefEvent` (`src/lib/llm/eventWriter.ts`), `NarrativeKind` (Tâche 2).
- Produces:

```ts
export interface NarrativeBrief {
  kind: NarrativeKind;
  scope: BriefEvent[];                                   // le périmètre, et rien d'autre
  subject: { name: string; description: string | null; problem: string | null; valueProposition: string | null };
  promise: { text: string; postText: string } | null;    // promesse tenue seulement
  reader: Reader;
  form: SeriesForm;
  seriesLabel: string;
  sources: Array<{ id: string; title: string | null; text: string }>;
}
export interface NarrativeWriterContext { brandName: string; activityType: string; subjectName: string; platform: Platform; contentType: ContentType; visual?: VisualFormatSpec | null; styleProfile?: StyleProfile | null; recentPosts?: RecentPostCard[]; brief: NarrativeBrief; language?: PostLanguage }

export const NARRATIVE_WRITER_SYSTEM_PROMPTS: Record<NarrativeKind, string>;
export function buildNarrativeWriterUserMessage(context: NarrativeWriterContext): string;
export async function writeNarrativePost(context: NarrativeWriterContext): Promise<GeneratedScript>;
```

- [ ] **Step 1: Écrire les tests qui échouent (modèle mocké, comme `src/lib/llm/promptsV3.test.ts` et `generateScript.test.ts`)**

```ts
describe("message utilisateur", () => {
  it("n'expose que les événements du périmètre", () => { /* un événement hors scope n'apparaît pas dans la sortie */ });
  it("donne problem et valueProposition pour la vision, pas pour le point d'étape", () => { /* … */ });
  it("donne la phrase de promesse et le post d'origine pour la promesse tenue", () => { /* … */ });
});
describe("système", () => {
  it("a un bloc what_makes_a_post par type", () => { expect(Object.keys(NARRATIVE_WRITER_SYSTEM_PROMPTS)).toEqual(["origin", "vision", "checkpoint", "promise"]); });
  it("interdit de nommer le type dans le post", () => { /* chaque prompt contient la règle */ });
});
describe("writeNarrativePost", () => {
  it("rend le post soumis et une trace", () => { /* submit_post accepté → GeneratedScript avec trace */ });
  it("renvoie le post au modèle quand les contrôles échouent, une fois", () => { /* 2 soumissions au plus */ });
  it("échoue clairement quand rien n'est soumis", () => { /* throw "The writer submitted no post." */ });
});
```

- [ ] **Step 2: Lancer les tests pour les voir échouer**

Run: `npm run test -- narrativeWriter`
Expected: FAIL

- [ ] **Step 3: Écrire le prompt 28 et `writeNarrativePost` dans `src/lib/llm/narrativeWriter.ts`**

Même squelette que `writeScriptFromEvent` : `callAgentic`, `maxTurns: 14`, `MAX_DRAFTS = 3`, `MAX_SUBMISSIONS = 2`, mêmes outils plus `read_post` (promesse tenue seulement), `read_timeline` **limité au périmètre**. `CheckContext.materialTexts` = les textes de `brief.sources`, plus `brief.promise.postText` pour la promesse tenue. Le système est `SCRIPT_CORE_PROMPT` + la méthode + **un seul** bloc `<what_makes_a_post>`, choisi par `brief.kind` ; les quatre blocs reprennent les colonnes « Ce qu'il dit » et « Ce qu'il ne fait pas » du §5 de la spec, et tous portent les règles communes du §10 (pas de call to action, pas de bilan chiffré hors périmètre, ne jamais nommer le type, s'arrêter sur un fait). Exemples fictifs, hors domaine, comme au 23.

- [ ] **Step 4: Lancer les tests pour les voir passer**

Run: `npm run test -- narrativeWriter`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/llm/narrativeWriter.ts src/lib/llm/narrativeWriter.test.ts
git commit -m "feat(fil-narratif): prompt 28, le rédacteur des quatre types de post de récit"
```

---

### Task 7: Branchement

**Files:**
- Create: `src/lib/services/narrativeBriefService.ts`
- Modify: `src/lib/llm/generateScript.ts:40-55`, `src/lib/services/scriptService.ts:122-135` et `:240-258`, `src/lib/services/postPairService.ts:44-105`
- Test: `src/lib/services/postPairService.test.ts` (créer — partie pure seulement)

**Interfaces:**
- Consumes: `decideNarrative` / `postRank` (Tâche 2), `NarrativeBrief` (Tâche 6), `loadSeriesWithProduct` et `planForSeries` (`seriesReaderService.ts`).
- Produces:

```ts
export async function buildNarrativeBriefForSeries(userId: string, seriesId: string, locked: { kind: NarrativeKind; eventIds: string[] } | null): Promise<NarrativeBrief | null>;
```

`ScriptGenerationContext` gagne `narrativeBrief: NarrativeBrief | null` ; `createScriptRecord` accepte `narrativeKind`, `promiseHonored`, `promiseSourceScriptId`. `postPairService.ts` exporte la fonction pure `lockedNarrativeOf(versions: Array<{ scriptId: string | null; narrativeKind: NarrativeKind | null; eventIds: string[] }>): { kind: NarrativeKind; eventIds: string[] } | null`.

- [ ] **Step 1: Écrire le test qui échoue**

```ts
// postPairService.test.ts — la règle « le second réseau reprend le type du premier »
it("reprend le type de récit de la version déjà écrite", () => {
  expect(lockedNarrativeOf([{ scriptId: "s1", narrativeKind: "checkpoint", eventIds: ["e1", "e2"] }]))
    .toEqual({ kind: "checkpoint", eventIds: ["e1", "e2"] });
});
it("ne verrouille rien quand aucune version n'est écrite", () => expect(lockedNarrativeOf([])).toBeNull());
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `npm run test -- postPairService`
Expected: FAIL

- [ ] **Step 3: Écrire `buildNarrativeBriefForSeries` dans `src/lib/services/narrativeBriefService.ts`**

Mêmes gardes que `buildEventBriefForSeries` en premier (pas de sujet, pas de lecteur, pas de forme → `null`, ce qui couvre le point 1 de Review Focus). Puis : charger les posts écrits de la série (créneaux au `scriptId` renseigné, avec le `narrativeKind` et l'`eventId` de leur script), la ligne de temps, `isFirstSeries` (la plus ancienne série non archivée du `productId`), les champs du sujet, et le `promiseMatch` d'un script `published`. Appeler `decideNarrative`, puis construire le brief : les événements du périmètre, leurs documents source, et pour la promesse tenue le texte du post d'origine.

- [ ] **Step 4: Aiguiller la génération**

Dans `src/lib/services/scriptService.ts`, appeler `buildNarrativeBriefForSeries` **avant** `buildEventBriefForSeries` ; s'il rend un brief, ne pas construire de brief d'événement. Dans `src/lib/llm/generateScript.ts`, ajouter la branche `if (context.narrativeBrief) return writeNarrativePost({...})` avant la branche `eventBrief`. À l'enregistrement, écrire `scripts.narrativeKind`, `eventId` (seulement si `marksTold`), `promiseHonored` et `promiseSourceScriptId`, et vider le `promiseMatch` du script d'origine. Sur le créneau, écrire `kind` et `narrativeKind` au même endroit que `scriptId` (`postPairService.ts:56`).

- [ ] **Step 5: Verrouiller le second réseau**

Dans `src/lib/services/postPairService.ts`, à côté d'`eventOfWrittenVersion`, ajouter la lecture du type de récit déjà écrit et le passer à la seconde écriture, de la même façon que l'`eventId`. Le chemin d'erreur existant (retour du créneau en `planned`) ne change pas — c'est ce qui couvre le point 5 de Review Focus.

- [ ] **Step 6: Annoncer un voisin de récit à l'épisode suivant**

Dans `src/lib/llm/recentPosts.ts`, marquer la carte d'un post de récit comme telle (son `narrativeKind`) : c'est ce qui empêche l'épisode qui suit un point d'étape de le répéter, sans toucher au prompt 23 lui-même. Ajouter le test correspondant à `src/lib/llm/recentPosts.test.ts`.

- [ ] **Step 7: Vérifier**

Run: `npm run test && npm run lint && npm run build`
Expected: PASS, PASS, build réussi.

- [ ] **Step 8: Commit**

```bash
git add src/lib/services/narrativeBriefService.ts src/lib/services/postPairService.ts src/lib/llm/recentPosts.ts src/lib/llm/recentPosts.test.ts src/lib/services/scriptService.ts src/lib/llm/generateScript.ts src/lib/services/postPairService.test.ts
git commit -m "feat(fil-narratif): le fil se pose tout seul dans le calendrier"
```

---

### Task 8: Banc d'essai et documentation

**Files:**
- Modify: `scripts/mykine-compare.ts`
- Modify: `docs/PROMPTS.md` (section 28), `docs/TECH.md`, `docs/PRODUCT.md`, `docs/guide/04-ia-et-generation.md`, `docs/guide/05-donnees.md`, `CLAUDE.md`

- [ ] **Step 1: Ajouter un cas « série entière » au banc**

Le pack MyKiné doit produire origine + vision + épisodes + point d'étape + une promesse tenue, et au moins un post d'épisode doit poser une vraie promesse. Le banc juge les cinq critères du §12 de la spec.

- [ ] **Step 2: Lancer le banc avec une vraie clé et itérer sur les prompts**

Run: `npx tsx scripts/mykine-compare.ts`
Expected: les cinq critères passent. Itérer sur les blocs `<what_makes_a_post>` du prompt 28 jusque-là, sans toucher au prompt 23.

- [ ] **Step 3: Mettre la documentation à jour**

Le prompt 28 dans `docs/PROMPTS.md` (texte complet, comme les autres) ; le quatrième rédacteur dans le pipeline de `docs/guide/04-ia-et-generation.md` ; les colonnes dans `docs/guide/05-donnees.md` (en retirant `promisesMade`/`promiseHonored` de la ligne « jamais écrits ») ; la ligne `docs/SPEC_FIL_NARRATIF.md` dans la liste de `CLAUDE.md` ; le modèle de données et les endpoints dans `docs/TECH.md`.

- [ ] **Step 4: Commit**

```bash
git add scripts/ docs/ CLAUDE.md
git commit -m "docs(fil-narratif): banc série entière, prompt 28 et mise à jour de la doc"
```
