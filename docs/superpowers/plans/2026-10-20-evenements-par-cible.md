# Événements par cible — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** la ligne de temps cesse d'être neutre : chaque événement dit, pour chaque lecteur à qui il parle, ce que ça change pour lui dans ses mots — et un fait qui ne change rien pour personne ne part dans aucune série.

**Architecture:** tout ce qui se décide sans modèle devient pur et testable sans base — l'ordre de lecture des documents, le budget de tours, et la règle « à qui cet événement est-il racontable » (`src/lib/narrative/audience.ts`). Le lecteur d'événements (prompt 21) reçoit le portrait complet des lecteurs, écrit un angle par public au moment où il comprend le fait, et peut **compléter** un événement déjà enregistré au lieu de l'écarter. Une passe de synthèse finale fusionne et nettoie ; le tri séparé après coup (prompt 24) disparaît.

**Tech Stack:** Next 16, TypeScript, Drizzle + Postgres, Vitest, OpenAI (`callAgentic` / `callStructured`).

**Spec:** `docs/SPEC_EVENEMENTS_PAR_CIBLE.md`

## Global Constraints

- **Aucune table nouvelle** — colonnes seulement (`src/db/schemaInvariants.test.ts` le garde).
- Les tests ne touchent **jamais** la base ni un vrai LLM : logique pure, appels modèle mockés.
- Les prompts s'écrivent **en anglais** ; les exemples restent fictifs et hors domaine.
- Un angle ne peut nommer qu'un public **présent dans le portrait du sujet** ; le code filtre, il ne fait pas confiance au modèle.
- `audiences` reste écrit (dérivé des angles) : `seriesReaderService` et l'UI s'en servent déjà.
- **La date n'est un critère de rien** (§3.5 de la spec, révisé) — ni de recevabilité, ni de filtrage.
- Migration suivante : `drizzle/0055_*.sql`, générée par `npm run db:generate`.
- Le chemin existant doit continuer à passer : une série sans lecteur, un sujet sans portrait et un événement saisi à la main voient **tout**, comme aujourd'hui.

## Review Focus

Cinq cas que la spec implique sans qu'une tâche les exerce d'elle-même. Chacun a son test, dans la tâche qui porte le code.

1. **Un événement saisi à la main par l'auteur** (`/context`, `origin = "user"`) n'a pas d'angle : il doit rester racontable par **toutes** les séries, sinon l'inversion du défaut fait disparaître ce que l'auteur a écrit lui-même (Tâche 2).
2. **Un sujet sans portrait de lecteurs** : le lecteur ne peut nommer aucun public ; les événements ne doivent pas tous devenir muets (Tâche 2).
3. **Un angle qui nomme un public absent du portrait** — le modèle invente une étiquette : ignoré, l'événement garde ses autres angles (Tâche 4).
4. **`complete_event` sur un id inconnu, ou sur un événement d'un autre sujet** : refusé proprement, renvoyé au modèle (Tâche 4).
5. **La synthèse qui veut retirer un événement déjà raconté par un post** : refusée — un script pointe dessus (Tâche 5).

---

### Task 1: Données

**Files:**
- Modify: `src/db/schema.ts`
- Create: `drizzle/0055_evenements_par_cible.sql` (généré)
- Test: `src/db/schemaInvariants.test.ts` (existant, doit continuer à passer)

**Interfaces:**
- Produces: `materialEvents.audienceAngles` (jsonb, notNull, défaut `[]`) ; `materialEvents.qualifiedAt` (timestamp, nullable).

- [ ] **Step 1: Déclarer les deux colonnes dans `src/db/schema.ts`**

Commenter comme le reste du fichier en renvoyant à `docs/SPEC_EVENEMENTS_PAR_CIBLE.md` §4. `audienceAngles` porte `[{ audience: string, whatItChanges: string }]`. `qualifiedAt` : `null` = jamais passé par un lecteur qui connaissait la cible.

- [ ] **Step 2: Générer, renommer, appliquer**

Run: `npm run db:generate && npm run db:migrate`
Expected: un `drizzle/0055_*.sql` qui ne contient que deux `ALTER TABLE ... ADD COLUMN` ; renommé en `0055_evenements_par_cible.sql`, entrée corrigée dans `drizzle/meta/_journal.json`, migration appliquée.

- [ ] **Step 3: Vérifier l'invariant**

Run: `npx vitest run src/db/schemaInvariants.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/db/schema.ts drizzle/
git commit -m "feat(evenements): angles par public et date de qualification sur les événements"
```

---

### Task 2: À qui un événement est-il racontable (pur)

**Files:**
- Create: `src/lib/narrative/audience.ts`
- Test: `src/lib/narrative/audience.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces:

```ts
export interface AudienceAngle { audience: string; whatItChanges: string }

/** Lecture tolérante d'un `material_events.audience_angles` jsonb ; les angles hors portrait sont retirés. */
export function parseAudienceAngles(raw: unknown, portraitLabels: string[]): AudienceAngle[];

/** Les étiquettes retenues, pour la colonne `audiences` qui reste écrite. */
export function audiencesOf(angles: AudienceAngle[]): string[];

export interface TellableEvent {
  audienceAngles: unknown;
  origin: "reader" | "user";
  qualifiedAt: Date | null;
}

/** La règle du §3.4 : « personne » veut dire personne — avec ses trois exceptions. */
export function tellableTo(event: TellableEvent, readerLabel: string | null, portraitLabels: string[]): boolean;

/** L'angle à donner au rédacteur pour ce lecteur, s'il y en a un. */
export function angleFor(event: TellableEvent, readerLabel: string | null, portraitLabels: string[]): string | null;
```

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
describe("parseAudienceAngles", () => {
  it("garde les angles dont le public est au portrait", () => { /* 2 angles, 1 hors portrait → 1 gardé */ });
  it("rend une liste vide sur un jsonb illisible", () => { expect(parseAudienceAngles("n'importe quoi", ["Kinés"])).toEqual([]); });
  it("écarte un angle sans texte", () => { /* whatItChanges vide → retiré */ });
});

describe("tellableTo", () => {
  it("raconte à un lecteur nommé dans ses angles", () => { /* true */ });
  it("ne raconte PAS à un lecteur absent de ses angles — c'est l'inversion du défaut", () => { /* false */ });
  it("ne raconte à personne un événement sans aucun angle", () => { /* angles [], qualifiedAt renseigné → false */ });
  it("raconte tout à une série sans lecteur", () => { expect(tellableTo(ev({ audienceAngles: [] }), null, ["Kinés"])).toBe(true); });
  it("raconte tout quand le sujet n'a pas de portrait", () => { /* portraitLabels [] → true */ });
  it("raconte tout ce que l'auteur a écrit lui-même", () => { /* origin "user", angles [] → true */ });
  it("ne raconte rien d'un événement jamais passé par un lecteur qui connaissait la cible", () => { /* qualifiedAt null, origin "reader" → false */ });
});

describe("angleFor", () => {
  it("rend la phrase écrite pour ce lecteur", () => { /* "le compteur suit le patient sans décalage" */ });
  it("rend null pour un lecteur sans angle, et pour une série sans lecteur", () => { /* null */ });
});
```

Les deux tests « série sans lecteur » et « sujet sans portrait » couvrent le point 2 de Review Focus ; « ce que l'auteur a écrit lui-même » couvre le point 1.

- [ ] **Step 2: Lancer les tests pour les voir échouer**

Run: `npm run test -- audience`
Expected: FAIL, `audience.ts` n'existe pas.

- [ ] **Step 3: Implémenter les quatre fonctions dans `src/lib/narrative/audience.ts`**

`tellableTo` sort `true` sans regarder les angles dans trois cas, dans cet ordre : pas de lecteur de série, pas de portrait, `origin === "user"`. Ensuite `qualifiedAt === null` → `false`. Sinon : le lecteur figure-t-il dans les angles retenus.

- [ ] **Step 4: Lancer les tests pour les voir passer**

Run: `npm run test -- audience`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/narrative/audience.ts src/lib/narrative/audience.test.ts
git commit -m "feat(evenements): à qui un événement est racontable, et l'angle de son lecteur (pur)"
```

---

### Task 3: Ordre de lecture et budget de tours (pur)

**Files:**
- Modify: `src/lib/llm/eventReader.ts:273-275` (`maxTurnsForParts`)
- Test: `src/lib/llm/eventReader.test.ts`

**Interfaces:**
- Produces:

```ts
/** Densité de dates d'un texte : ce qui distingue un journal d'une page de doc. */
export function datedEntryCount(text: string): number;

/** Les documents à lire, ceux qui racontent d'abord. Tri stable. */
export function narrativeFirst<T extends { id: string; title: string | null; rawText: string }>(documents: T[]): T[];

/** Remplace `maxTurnsForParts` : compte les lectures ET les enregistrements. */
export function maxTurnsForReading(input: { parts: number; expectedEvents: number }): number;
```

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
describe("datedEntryCount", () => {
  it("compte les titres datés d'un journal", () => { expect(datedEntryCount("## 2025-11-09\nx\n## 2025-11-16\ny")).toBe(2); });
  it("ne compte pas deux fois la même date", () => { expect(datedEntryCount("## 2025-11-09\n## 2025-11-09")).toBe(1); });
  it("rend 0 sur une page de documentation sans date", () => { expect(datedEntryCount("# Architecture\nFastAPI, PostgreSQL 16.")).toBe(0); });
  it("ignore une date de dernière mise à jour isolée", () => { /* "Last updated: 2026-10-01" seul → 1, acceptable ; documenté */ });
});

describe("narrativeFirst", () => {
  it("met le journal daté avant la documentation", () => {
    const docs = [d("a", "# Architecture\nFastAPI."), d("b", "## 2025-11-09\nJulien dit…\n## 2025-11-16\nPrototype.")];
    expect(narrativeFirst(docs).map((x) => x.id)).toEqual(["b", "a"]);
  });
  it("classe les journaux entre eux par densité de dates décroissante", () => { /* 11 dates avant 2 dates */ });
  it("garde l'ordre d'origine entre deux documents sans date", () => { /* tri stable */ });
});

describe("maxTurnsForReading", () => {
  it("laisse de la place aux enregistrements, pas seulement aux lectures", () => {
    expect(maxTurnsForReading({ parts: 5, expectedEvents: 13 })).toBeGreaterThanOrEqual(34);
  });
  it("reproduit le cas réel qui avait été coupé", () => {
    // 5 documents, 13 entrées datées : la lecture avait besoin de 33 tours et n'en avait que 32.
    expect(maxTurnsForReading({ parts: 5, expectedEvents: 13 })).toBeGreaterThan(32);
  });
  it("reste plafonné pour ne pas partir en boucle", () => { expect(maxTurnsForReading({ parts: 500, expectedEvents: 500 })).toBeLessThanOrEqual(240); });
});
```

- [ ] **Step 2: Lancer les tests pour les voir échouer**

Run: `npm run test -- eventReader`
Expected: FAIL

- [ ] **Step 3: Implémenter les trois fonctions dans `src/lib/llm/eventReader.ts`**

`maxTurnsForReading` : `12 + 4 × parts + 2 × expectedEvents`, plafonné à 240. `maxTurnsForParts` disparaît ; son appel dans `materialEventService.ts` passe au nouveau, avec `expectedEvents` = somme des `datedEntryCount` des documents à lire, plancher à 10.

- [ ] **Step 4: Lancer les tests pour les voir passer**

Run: `npm run test -- eventReader`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/llm/eventReader.ts src/lib/llm/eventReader.test.ts
git commit -m "feat(evenements): lire le récit d'abord, et un budget de tours qui compte les événements"
```

---

### Task 4: Le lecteur écrit pour une cible (prompt 21 revu)

**Files:**
- Modify: `src/lib/llm/eventReader.ts` (prompt système, message utilisateur, outils, schémas)
- Modify: `src/lib/services/materialEventService.ts:155-305` (orchestration)
- Test: `src/lib/llm/eventReader.test.ts`

**Interfaces:**
- Consumes: `parseAudienceAngles` (Tâche 2), `narrativeFirst` / `maxTurnsForReading` (Tâche 3).
- Produces: `EventReaderPromptContext.audiences` devient `Array<{ label: string; who: string; wants: string; stopsFor: string; turnsOff: string; words: string[] }>` ; `saveEventInputSchema` remplace `audiences` par `audienceAngles: Array<{ audience: string; whatItChanges: string }>` ; `completeEventInputSchema` ; constante `COMPLETE_EVENT_TOOL = "complete_event"`.

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
describe("prompt du lecteur d'événements", () => {
  it("donne le portrait complet de chaque public, pas seulement son étiquette", () => {
    const msg = buildEventReaderUserMessage(ctx());
    expect(msg).toContain("Comes looking for:");
    expect(msg).toContain("Turned off by:");
  });
  it("autorise explicitement un document technique à rendre des événements", () => {
    expect(buildEventReaderSystemPrompt(ctx())).toContain("A technical document can perfectly well contain events");
  });
  it("pose la bonne question : ce fait change-t-il quelque chose pour quelqu'un", () => {
    expect(buildEventReaderSystemPrompt(ctx())).toContain("does this fact change something for someone");
  });
  it("dit que compléter vaut mieux qu'écarter un doublon", () => {
    expect(buildEventReaderSystemPrompt(ctx())).toContain(COMPLETE_EVENT_TOOL);
  });
});

describe("schéma de save_event", () => {
  it("accepte des angles par public", () => { /* audienceAngles: [{ audience, whatItChanges }] → ok */ });
  it("accepte une liste d'angles vide : « personne » est une réponse normale", () => { /* [] → ok */ });
  it("refuse un angle sans texte", () => { /* whatItChanges: "" → erreur */ });
});

describe("outils", () => {
  it("expose complete_event avec l'id de l'événement à compléter", () => {
    const tools = buildEventReaderTools({ audienceLabels: ["Kinés"] });
    expect(tools.map((t) => t.name)).toContain(COMPLETE_EVENT_TOOL);
  });
  it("borne les publics à ceux du portrait dans le schéma", () => { /* enum = ["Kinés"] */ });
});
```

- [ ] **Step 2: Lancer les tests pour les voir échouer**

Run: `npm run test -- eventReader`
Expected: FAIL

- [ ] **Step 3: Réécrire le prompt 21 et les outils dans `src/lib/llm/eventReader.ts`**

Le prompt système change sur quatre points, et sur rien d'autre : la définition d'un événement devient « un fait qui change quelque chose pour quelqu'un », la règle qui interdisait les documents techniques est **remplacée** par son contraire assorti d'un contre-exemple (une colonne JSONB ne change rien pour personne ; « rien de ce que filme le téléphone n'en sort » change tout pour le lecteur qui s'inquiète de ses patients), le doublon se **complète** avec `complete_event`, et les angles s'écrivent public par public — vide quand personne. Le message utilisateur donne le portrait complet.

- [ ] **Step 4: Brancher l'orchestration dans `materialEventService.ts`**

`readers` passe le portrait complet au contexte ; les documents à lire sont triés par `narrativeFirst` ; `maxTurns` vient de `maxTurnsForReading`. `save_event` écrit `audienceAngles` (filtrés par `parseAudienceAngles`), `audiences` (dérivé) et `qualifiedAt = now()`. `complete_event` charge l'événement par id, **vérifie qu'il appartient au sujet et à l'utilisateur** — sinon erreur renvoyée au modèle (point 4 de Review Focus) — et ne met à jour que les champs fournis. Un angle nommant un public hors portrait est retiré sans faire échouer l'enregistrement (point 3).

- [ ] **Step 5: Lancer la suite et le lint**

Run: `npx vitest run && npm run lint`
Expected: PASS, PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/llm/eventReader.ts src/lib/llm/eventReader.test.ts src/lib/services/materialEventService.ts
git commit -m "feat(evenements): le lecteur écrit un angle par public et complète au lieu d'écarter"
```

---

### Task 5: Passe de synthèse, et retrait du tri séparé

**Files:**
- Create: `src/lib/llm/timelineSynthesis.ts`
- Test: `src/lib/llm/timelineSynthesis.test.ts`
- Modify: `src/lib/services/materialEventService.ts` (appel en fin de lecture ; suppression de `qualifyEventsForSubject` et `scheduleEventQualification`)
- Modify: `src/lib/services/readerPortraitService.ts` (un changement de portrait remet `eventsReadAt` à null au lieu de replanifier un tri)
- Modify: `src/app/api/events/qualify/route.ts` (supprimé)

**Interfaces:**
- Consumes: `callStructured`.
- Produces:

```ts
export interface TimelineFix {
  action: "merge" | "complete" | "drop";
  eventId: string;
  /** merge : l'événement qui absorbe celui-ci. */
  intoEventId?: string;
  /** complete : le whatChanged trouvé ailleurs dans la ligne de temps. */
  whatChanged?: string;
}
export async function synthesiseTimeline(input: {
  subjectName: string;
  events: Array<{ id: string; date: string | null; title: string; whatHappened: string; whatChanged: string | null; audiences: string[] }>;
}): Promise<TimelineFix[]>;

/** Écarte ce que le code refuse d'appliquer. */
export function applicableFixes(fixes: TimelineFix[], knownIds: string[], toldEventIds: string[]): TimelineFix[];
```

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
describe("applicableFixes", () => {
  it("refuse de retirer un événement déjà raconté par un post", () => {
    expect(applicableFixes([{ action: "drop", eventId: "e1" }], ["e1"], ["e1"])).toEqual([]);
  });
  it("refuse une fusion vers un événement inconnu", () => { /* intoEventId absent de knownIds → écarté */ });
  it("refuse un id que la ligne de temps ne contient pas", () => { /* écarté */ });
  it("laisse passer une complétion sur un événement connu et non raconté", () => { /* gardée */ });
});

describe("synthesiseTimeline", () => {
  it("rend les corrections du modèle", async () => { /* mock callStructured → 2 fixes */ });
  it("ne crée jamais d'événement : une action inconnue est ignorée", async () => { /* action "create" → [] */ });
  it("rend une liste vide sans événement", async () => { /* events [] → [], 0 appel */ });
});
```

Le premier test couvre le point 5 de Review Focus.

- [ ] **Step 2: Lancer les tests pour les voir échouer**

Run: `npm run test -- timelineSynthesis`
Expected: FAIL

- [ ] **Step 3: Écrire le prompt 24 (réaffecté) et les deux fonctions**

Un `callStructured`, outil `fix_timeline`. Le prompt reçoit la ligne de temps entière sans les documents et ne peut que fusionner, compléter ou retirer — jamais créer. L'ancien prompt 24 (« Qualification des événements par public ») cède son numéro : il n'existe plus.

- [ ] **Step 4: Brancher en fin de lecture et retirer le tri**

Appel après `readEventsForSubject`, jamais bloquant (journalisé). `qualifyEventsForSubject`, `scheduleEventQualification`, le prompt de qualification et la route `POST /api/events/qualify` sont supprimés. Dans `readerPortraitService`, un portrait qui change remet `sourceMaterials.eventsReadAt = null` pour ce sujet — la matière sera relue avec la bonne cible — au lieu de redistribuer des étiquettes.

- [ ] **Step 5: Lancer la suite, le lint et le build**

Run: `npx vitest run && npm run lint && npm run build`
Expected: PASS, PASS, build réussi.

- [ ] **Step 6: Commit**

```bash
git add src/lib/llm/timelineSynthesis.ts src/lib/llm/timelineSynthesis.test.ts src/lib/services/ src/app/api/events/
git commit -m "feat(evenements): passe de synthèse de la ligne de temps, retrait du tri après coup"
```

---

### Task 6: « Personne » veut dire personne, et l'angle arrive au rédacteur

**Files:**
- Modify: `src/lib/services/seriesReaderService.ts:43` et `:143` (le filtre)
- Modify: `src/lib/llm/eventWriter.ts` (`BriefEvent` + le bloc `<event>`)
- Modify: `src/lib/llm/narrativeWriter.ts` (le bloc `<scope>`)
- Modify: `src/lib/services/narrativeBriefService.ts` (`toBriefEvent`)
- Test: `src/lib/llm/narrativeWriter.test.ts`, `src/lib/narrative/audience.test.ts`

**Interfaces:**
- Consumes: `tellableTo`, `angleFor` (Tâche 2).
- Produces: `BriefEvent` gagne `angle: string | null` — ce que ce fait change pour le lecteur de cette série, dans ses mots.

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
// narrativeWriter.test.ts
it("donne au rédacteur l'angle du lecteur à côté des faits", () => {
  const msg = buildNarrativeWriterUserMessage(context({ brief: brief({ scope: [ev("e1", "La démo tourne", "le patient voit son compteur bouger tout de suite")] }) }));
  expect(msg).toContain("le patient voit son compteur bouger tout de suite");
});
it("se passe d'angle quand il n'y en a pas", () => { /* angle null → pas de ligne vide, pas de plantage */ });
```

- [ ] **Step 2: Lancer les tests pour les voir échouer**

Run: `npm run test -- narrativeWriter`
Expected: FAIL

- [ ] **Step 3: Remplacer le filtre et porter l'angle**

Dans `seriesReaderService`, les deux `e.audiences.length === 0 || e.audiences.includes(label)` deviennent `tellableTo(e, series.readerLabel, portraitLabels)`. `toBriefEvent` (les deux, `seriesReaderService` et `narrativeBriefService`) remplit `angle` avec `angleFor(...)`. Les blocs `<event>` du 23 et `<scope>` du 28 ajoutent une ligne « For this reader: … » quand l'angle existe, et rien sinon.

- [ ] **Step 4: Lancer la suite**

Run: `npx vitest run && npm run lint`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/seriesReaderService.ts src/lib/services/narrativeBriefService.ts src/lib/llm/eventWriter.ts src/lib/llm/narrativeWriter.ts src/lib/llm/narrativeWriter.test.ts
git commit -m "feat(evenements): un événement muet ne part dans aucune série, et le rédacteur reçoit l'angle de son lecteur"
```

---

### Task 7: Contrôle de jargon

**Files:**
- Modify: `src/lib/llm/scriptChecks.ts`
- Test: `src/lib/llm/scriptChecks.test.ts`

**Interfaces:**
- Produces: `CheckContext` gagne `jargon: string[]` (la liste `form.jargon` de la série) ; `checkGeneratedPost` refuse un post qui emploie un de ces termes sans l'expliquer.

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
describe("jargon du lecteur", () => {
  it("refuse un terme de la liste employé tel quel", () => {
    expect(checkGeneratedPost(post({ caption: withSentence("Le serveur reçoit un payload JSONB.") }), null, ctx({ jargon: ["JSONB"] })))
      .toContain("\"JSONB\" is in the words this reader does not understand: say what it changes for them, or leave it out.");
  });
  it("laisse passer un terme expliqué par son effet dans la même phrase", () => {
    expect(checkGeneratedPost(post({ caption: withSentence("Les angles sont rangés en JSONB, c'est-à-dire que tout un mouvement tient dans une seule ligne.") }), null, ctx({ jargon: ["JSONB"] }))).toEqual([]);
  });
  it("ignore la casse et les accents", () => { /* "jsonb" trouvé pour "JSONB" */ });
  it("ne dit rien sans liste de jargon", () => { expect(checkGeneratedPost(post(), null, ctx())).toEqual([]); });
});
```

- [ ] **Step 2: Lancer les tests pour les voir échouer**

Run: `npm run test -- scriptChecks`
Expected: FAIL

- [ ] **Step 3: Ajouter `jargonFailures(post, ctx)` et la brancher dans `checkGeneratedPost`**

« Expliqué » = le terme est suivi, dans la même phrase, d'une incise (`,` `(` `—` `:` ou « c'est-à-dire ») d'au moins 25 caractères. Comparaison via `normalizeForCheck`, sur les mots entiers.

- [ ] **Step 4: Remplir `jargon` à l'appel**

Dans `eventWriter.ts` et `narrativeWriter.ts`, le `CheckContext` reçoit `context.brief.form.jargon`.

- [ ] **Step 5: Lancer la suite**

Run: `npx vitest run && npm run lint`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/llm/scriptChecks.ts src/lib/llm/scriptChecks.test.ts src/lib/llm/eventWriter.ts src/lib/llm/narrativeWriter.ts
git commit -m "feat(evenements): un mot que le lecteur ne comprend pas renvoie le post au modèle"
```

---

### Task 8: Relecture réelle du pack MyKiné et documentation

**Files:**
- Modify: `scripts/seed-mykine.ts` (relecture forcée)
- Modify: `docs/PROMPTS.md` (21 réécrit, 24 remplacé), `docs/TECH.md` §5.16, `docs/guide/04-ia-et-generation.md`, `docs/guide/05-donnees.md`, `CLAUDE.md`

- [ ] **Step 1: Relire la matière du compte de démonstration**

Run: `node_modules/.bin/tsx scripts/seed-mykine.ts --reset && node_modules/.bin/tsx scripts/seed-mykine.ts 3`
Expected: la lecture n'est plus coupée (`stoppedAtMaxTurns: false`).

- [ ] **Step 2: Juger les six critères du §8 de la spec**

Le déclencheur du 2025-11-09 existe et est daté ; les 11 entrées du devlog sont là ; `A/privacy.md` rend un événement dont l'angle kiné ne contient ni « angle », ni « serveur », ni « JSONB » ; aucun angle ne nomme un public hors portrait ; les faits de plomberie ne retiennent aucun public ; et les trois premiers posts se lisent sans rien savoir de la technique. Itérer sur le prompt 21 jusque-là.

- [ ] **Step 3: Mettre la documentation à jour**

Prompt 21 réécrit et prompt 24 remplacé par la synthèse dans `docs/PROMPTS.md` ; §5.16 de `docs/TECH.md` ; le pipeline de `docs/guide/04-ia-et-generation.md` ; les colonnes dans `docs/guide/05-donnees.md` ; la ligne `docs/SPEC_EVENEMENTS_PAR_CIBLE.md` dans `CLAUDE.md`.

- [ ] **Step 4: Commit**

```bash
git add docs/ CLAUDE.md scripts/
git commit -m "docs(evenements): prompt 21 par cible, synthèse de la ligne de temps, relecture du pack MyKiné"
```

---

### Task 9: L'origine devient obligatoire et lit large

**Files:**
- Modify: `src/lib/narrative/placement.ts` (la branche origine)
- Modify: `src/lib/services/narrativeBriefService.ts` (les trois champs du sujet)
- Modify: `src/lib/llm/narrativeWriter.ts` (`subjectLines`)
- Test: `src/lib/narrative/placement.test.ts`

**Spec :** `docs/SPEC_FIL_NARRATIF.md` §5, §7 et §14-3, révisés le 2026-10-20. Cette tâche vient **après**
le lecteur : juger une origine sur une ligne de temps amputée n'apprend rien.

**Interfaces:**
- Produces: `NarrativeDecision.eventIds` porte, pour `origin`, les 12 plus anciens événements ; `marksTold` reste le plus ancien. `NarrativeBrief.subject` est déjà en place ; `subjectLines` donne les trois champs à l'origine.

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
describe("decideNarrative — origine, révisée", () => {
  it("pose une origine même sans aucun événement daté", () => {
    expect(decideNarrative(input({ events: [ev("e1", null), ev("e2", null)] }))?.kind).toBe("origin");
  });
  it("prend les 12 plus anciens événements dans son périmètre", () => {
    const quinze = Array.from({ length: 15 }, (_, i) => ev(`e${i}`, `2026-01-${String(i + 1).padStart(2, "0")}`));
    const d = decideNarrative(input({ events: quinze }));
    expect(d?.eventIds).toHaveLength(12);
    expect(d?.eventIds[0]).toBe("e0");
  });
  it("ne marque comme raconté que le plus ancien", () => {
    expect(decideNarrative(input())?.marksTold).toBe("e1");
  });
  it("prend tout ce qu'il y a quand la ligne de temps est courte", () => {
    expect(decideNarrative(input({ events: [ev("e1", "2026-01-01")] }))?.eventIds).toEqual(["e1"]);
  });
  it("rend toujours null sur une ligne de temps vide", () => {
    expect(decideNarrative(input({ events: [] }))).toBeNull();
  });
});
```

Le premier et le dernier remplacent les deux tests de la version initiale (« pas d'origine sans
événement daté »), qui décrivaient la règle abandonnée : les supprimer fait partie de l'étape.

- [ ] **Step 2: Lancer les tests pour les voir échouer**

Run: `npm run test -- placement`
Expected: FAIL

- [ ] **Step 3: Réécrire la branche origine**

Plus de condition sur une date : au rang 1 de la première série, `eventIds` = les 12 premiers de
`events` (déjà triés, datés d'abord), `marksTold` = le premier. Constante `ORIGIN_SCOPE = 12`.

- [ ] **Step 4: Donner les trois champs du sujet à l'origine**

Dans `narrativeWriter.subjectLines`, le cas `origin` rend les trois champs — ce qui est construit
(`description`), pour qui (`targetAudience`), le problème (`problem`) — et le cas `vision` ajoute
`targetAudience` aux trois qu'il a déjà. `NarrativeBrief.subject` gagne `targetAudience`, rempli par
`narrativeBriefService`.

- [ ] **Step 5: Lancer la suite**

Run: `npx vitest run && npm run lint && npm run build`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/narrative/ src/lib/services/narrativeBriefService.ts src/lib/llm/narrativeWriter.ts
git commit -m "feat(fil-narratif): l'origine est obligatoire et lit les 12 premiers événements"
```
