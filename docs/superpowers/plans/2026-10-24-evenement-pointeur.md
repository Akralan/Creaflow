# Événement-pointeur Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le lecteur d'événements à champs et le rédacteur par événement par un extracteur de pointeurs non agentique et un rédacteur qui choisit lui-même ses pointeurs.

**Architecture :** Un événement devient `source_material_id` + `line` + `date`. L'extraction se fait document par document en appels structurés indépendants (il voit tout le corpus, là où l'appel agentique unique lisait 4 documents sur 43). Le rédacteur reçoit la ligne de temps en adresses nues, ouvre les documents par `read_file`, relit les posts par `read_post`, et rend son texte avec les adresses dont il s'est servi. Le fil narratif, le filtre par public et le choix côté code disparaissent.

**Tech Stack :** Next.js, Drizzle/PostgreSQL, Vitest, `callStructured` et `callAgentic` (adaptateur OpenAI).

**Spec :** `docs/SPEC_EVENEMENT_POINTEUR.md`

## Global Constraints

- Modèle de rédaction : `gpt-6-luna` (`OPENAI_MODEL`). Le run C a été mesuré sur lui ; `gpt-5-mini` n'a jamais été mesuré sur ce chemin.
- Aucune table nouvelle, aucun partitionnement par verticale — `src/db/schemaInvariants.test.ts` doit rester vert (`docs/ARCHITECTURE_VERTICALES.md` chantier 4).
- Les quatre phrases du prompt du rédacteur sont celles de la spec §4, **mot pour mot**. Toute règle ajoutée devra repasser le banc.
- Les colonnes retirées sont **supprimées**, pas commentées « conservées ».
- `PART_CHARS = 40_000` pour l'extracteur, `MAX_WINDOW_LINES = 120` et `maxTurns = 40` pour le rédacteur.
- Langue du post : `creator_profiles.language` sinon celle des notes (`docs/SPEC_LANGUE_DES_POSTS.md`), règle absolue et revérifiée.
- Un post `contentType: "visual"` reste sur le chemin V3 (`buildScriptUserMessage`) : le rédacteur à pointeurs produit un post texte. **Décision de ce plan**, pas de la spec.
- Le **style appris** (`creator_profiles.style_profile`, `docs/SPEC_APPRENTISSAGE_STYLE.md`) n'entre PAS dans le prompt du rédacteur : le run C n'en avait pas, et c'est lui qui a été validé. Les règles de style apprises cessent donc d'agir sur les posts de série. **Décision de ce plan à rouvrir après l'essai en réel**, pas une omission.

## Review Focus

- **Document vide ou d'une seule ligne** passé à l'extracteur : `numberAndSplit("")` doit rendre une part et non zéro, sinon le document n'est jamais lu. Test en tâche 1.
- **Pointeur dont le document a été supprimé** (`source_material_id` orphelin, FK `set null`) : la ligne de temps doit l'écarter au lieu de produire une adresse `null:42` que le rédacteur ne pourra pas ouvrir. Test en tâche 4.
- **`read_file` hors bornes** (`from_line` à 0, `to_line` au-delà de la fin, `from > to`) : fenêtre ramenée dans le document plutôt qu'erreur renvoyée au modèle. Test en tâche 3.
- **`publish_post` jamais appelé** (le modèle conclut en prose) : le post ne doit pas se perdre — `postPairService` a déjà un second essai sur « submitted no post », il faut que l'erreur porte ce texte. Test en tâche 5.
- **Post d'une seule phrase** : le découpage hook / caption doit rendre une `caption` non vide, sinon `textScriptSchema` (`caption: z.string().min(1)`) rejette le post. Test en tâche 3.

---

### Task 1 : L'extracteur et ses contrôles

**Files :**
- Modify: `src/lib/llm/pointerExtractor.ts` (déjà écrit dans ce worktree, sans tests)
- Test: `src/lib/llm/pointerExtractor.test.ts`

**Interfaces :**
- Produces: `extractPointers(doc: { file: string; text: string }): Promise<{ pointers: Pointer[]; calls: number }>`, `numberAndSplit(text: string, partChars?: number): string[]`, `Pointer = { file: string; line: number; date: string | null }`, `EVENT_DEFINITION: string`.

- [ ] **Step 1 : Écrire les tests qui échouent**

```ts
describe("numberAndSplit", () => {
  it("numérote à partir de 1 et garde les numéros du document complet", () => {
    const parts = numberAndSplit("a\nb\nc", 8);
    expect(parts[0]).toContain("1\ta");
    expect(parts.at(-1)).toContain("3\tc");
  });
  it("rend une part pour un document vide", () => {
    expect(numberAndSplit("")).toHaveLength(1);
  });
  it("ne coupe jamais au milieu d'une ligne", () => {
    for (const p of numberAndSplit("aaaa\nbbbb\ncccc", 10)) expect(p.startsWith("\t")).toBe(false);
  });
});

describe("extractPointers", () => {
  it("écarte une ligne hors du document, normalise une date non ISO en null, dédoublonne", async () => {
    mockStructured({ events: [{ line: 2, date: "2026-10-21" }, { line: 999, date: "" }, { line: 2, date: "hier" }] });
    const { pointers } = await extractPointers({ file: "d.md", text: "a\nb\nc" });
    expect(pointers).toEqual([{ file: "d.md", line: 2, date: "2026-10-21" }]);
  });
});
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/lib/llm/pointerExtractor.test.ts`
Expected: FAIL — `numberAndSplit("")` rend `[]` aujourd'hui (la boucle ne pousse rien quand il n'y a pas de ligne non vide).

- [ ] **Step 3 : Corriger `numberAndSplit` pour qu'un texte vide rende une part**

- [ ] **Step 4 : Lancer les tests pour vérifier qu'ils passent**

Run: `npx vitest run src/lib/llm/pointerExtractor.test.ts`
Expected: PASS

- [ ] **Step 5 : Commit**

```bash
git add src/lib/llm/pointerExtractor.ts src/lib/llm/pointerExtractor.test.ts
git commit -m "test(pointeurs): l'extracteur sous contrôle, et le document vide a sa part"
```

---

### Task 2 : La migration

**Files :**
- Modify: `src/db/schema.ts:484-522` (`materialEvents`)
- Create: `drizzle/0057_evenement_pointeur.sql`
- Test: `src/db/schemaInvariants.test.ts` (déjà présent, doit rester vert)

**Interfaces :**
- Produces: `materialEvents` réduit à `id`, `userId`, `productId`, `sourceMaterialId`, `line`, `date`, `createdAt`, `updatedAt`. `scripts.eventIds` (jsonb, défaut `[]`).

- [ ] **Step 1 : Réduire `materialEvents` dans `src/db/schema.ts`**

Retirer `date_precision`, `title`, `what_happened`, `what_changed`, `at_stake`, `kind`, `audiences`, `audience_angles`, `qualified_at`, `excerpt`, `origin`. Ajouter `line: integer("line").notNull()`. Rendre `sourceMaterialId` `notNull` : un pointeur sans document n'adresse rien. Retirer les enums devenus orphelins (`materialEventKindEnum`, `materialEventDatePrecisionEnum`, `materialEventOriginEnum`).

- [ ] **Step 2 : Ajouter `scripts.eventIds`**

`eventIds: jsonb("event_ids").notNull().default([])` — tous les pointeurs du post, dans l'ordre rendu. `scripts.eventId` reste rempli avec le premier, pour les écrans et requêtes qui le lisent déjà.

- [ ] **Step 3 : Retirer les colonnes orphelines du même coup**

`narrative_state` (table), `scripts.beat_id`, `content_series.mode`, `content_series.form`, `content_series.framing` : plus aucun code ne les écrit après la tâche 6.

- [ ] **Step 4 : Générer la migration**

Run: `npm run db:generate`
Expected: `drizzle/0057_evenement_pointeur.sql` créé. La relire : les `DROP COLUMN` sont destructifs et les événements existants deviennent inutilisables (pas de `line`) — ajouter `DELETE FROM material_events;` en tête, et un `UPDATE scripts SET event_id = NULL;` pour que la FK ne retienne pas des lignes supprimées.

- [ ] **Step 5 : Appliquer et vérifier**

Run: `npm run db:migrate && npx vitest run src/db/schemaInvariants.test.ts`
Expected: migration appliquée, invariants verts.

- [ ] **Step 6 : Commit**

```bash
git add src/db/schema.ts drizzle/
git commit -m "feat(pointeurs): un événement est un document, une ligne, une date"
```

---

### Task 3 : Le rédacteur — langue, plateforme, découpage

**Files :**
- Modify: `src/lib/llm/pointerPostWriter.ts`
- Test: `src/lib/llm/pointerPostWriter.test.ts`

**Interfaces :**
- Consumes: `platformRuleText(platform, { visualOnly })` de `src/lib/llm/platformRules.ts`.
- Produces: `writePost(c: WriterContext, maxTurns?: number): Promise<WrittenResult>` avec `WriterContext` étendu de `platform: Platform` et `language: PostLanguage` ; `splitHookAndCaption(text: string): { hookText: string; caption: string }` ; `runWriterTool(c, call): unknown`.

- [ ] **Step 1 : Écrire les tests qui échouent**

```ts
describe("splitHookAndCaption", () => {
  it("prend la première ligne comme accroche et le reste comme caption", () => {
    expect(splitHookAndCaption("Accroche.\n\nSuite du post.")).toEqual({ hookText: "Accroche.", caption: "Suite du post." });
  });
  it("rend une caption non vide pour un post d'une seule phrase", () => {
    const { hookText, caption } = splitHookAndCaption("Une seule phrase.");
    expect(hookText).toBe("Une seule phrase.");
    expect(caption.length).toBeGreaterThan(0);
  });
});

describe("runWriterTool read_file", () => {
  const c = ctx({ files: new Map([["d.md", ["a", "b", "c"]]]) });
  it("ramène une fenêtre hors bornes dans le document", () => {
    expect(runWriterTool(c, { name: "read_file", input: { file: "d.md", from_line: 0, to_line: 99 } }))
      .toMatchObject({ from_line: 1, to_line: 3 });
  });
  it("plafonne la fenêtre à MAX_WINDOW_LINES", () => {
    const big = ctx({ files: new Map([["d.md", Array(500).fill("x")]]) });
    const r = runWriterTool(big, { name: "read_file", input: { file: "d.md", from_line: 1, to_line: 500 } });
    expect(r).toMatchObject({ to_line: MAX_WINDOW_LINES });
  });
});

describe("buildWriterSystemPrompt", () => {
  it("porte les quatre règles, la langue et les règles de plateforme", () => {
    const p = buildWriterSystemPrompt(ctx({ platform: "x", language: "fr" }));
    expect(p).toContain("That is your only rule: build in public, for that reader.");
    expect(p).toContain("Your first sentence is a hook and nothing else");
    expect(p).toContain("no post of yours is allowed to be dead");
    expect(p).toContain("never to copy their shape");
    expect(p).toContain("French");
    expect(p).toContain(platformRuleText("x", { visualOnly: false }));
  });
});
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/lib/llm/pointerPostWriter.test.ts`
Expected: FAIL — `splitHookAndCaption` n'existe pas, le prompt ne contient ni langue ni règles de plateforme.

- [ ] **Step 3 : Implémenter `splitHookAndCaption` et étendre le prompt**

La langue entre comme règle absolue, dans les mots de `docs/SPEC_LANGUE_DES_POSTS.md`. `platformRuleText(c.platform, { visualOnly: false })` entre dans un bloc à part, après les quatre phrases. Pour un post d'une seule phrase, la caption reprend l'accroche — `textScriptSchema` exige `caption` non vide.

- [ ] **Step 4 : Lancer les tests pour vérifier qu'ils passent**

Run: `npx vitest run src/lib/llm/pointerPostWriter.test.ts`
Expected: PASS

- [ ] **Step 5 : Commit**

```bash
git add src/lib/llm/pointerPostWriter.ts src/lib/llm/pointerPostWriter.test.ts
git commit -m "feat(pointeurs): le rédacteur reçoit la langue, le réseau, et son texte se découpe"
```

---

### Task 4 : La ligne de temps en pointeurs

**Files :**
- Modify: `src/lib/services/materialEventService.ts:161-430` (`readEventsForSubject`, `synthesiseTimelineForSubject`, `refreshPromiseMatches`)
- Modify: `src/lib/services/seriesReaderService.ts:83-163` (`planForSeries`, `buildEventBriefForSeries`)
- Test: `src/lib/services/seriesReaderService.test.ts`

**Interfaces :**
- Consumes: `extractPointers` (tâche 1), `materialEvents` réduit (tâche 2).
- Produces: `readEventsForSubject(userId, productId): Promise<{ documents: number; pointers: number; calls: number }>` ; `buildPointerBrief(userId, seriesId): Promise<PointerBrief | null>` avec `PointerBrief = { timeline: TimelineEntry[]; posts: WrittenPost[]; files: Map<string, string[]>; reader: Reader; projectContext: string }`.

- [ ] **Step 1 : Écrire les tests qui échouent**

```ts
describe("buildPointerBrief", () => {
  it("écarte un pointeur dont le document a disparu", async () => {
    // événement avec sourceMaterialId pointant sur un document supprimé
    const brief = await buildPointerBrief(userId, seriesId);
    expect(brief!.timeline.every((e) => brief!.files.has(e.file))).toBe(true);
  });
  it("marque used les pointeurs déjà portés par un post de la série", async () => {
    const brief = await buildPointerBrief(userId, seriesId);
    expect(brief!.timeline.find((e) => e.id === toldId)!.used).toBe(true);
  });
  it("ne filtre plus par lecteur : tous les pointeurs du sujet sont là", async () => {
    const brief = await buildPointerBrief(userId, seriesId);
    expect(brief!.timeline).toHaveLength(pointersOfSubject);
  });
});
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/lib/services/seriesReaderService.test.ts`
Expected: FAIL — `buildPointerBrief` n'existe pas.

- [ ] **Step 3 : Remplacer la lecture par l'extraction**

`readEventsForSubject` boucle sur les documents non lus et appelle `extractPointers` pour chacun — plus de `callAgentic`, plus de plafond de tours, plus de `list_documents`/`read_document`. `lastReadAt` posé par document. Retirer `synthesiseTimelineForSubject` et `refreshPromiseMatches` (le nettoyage de ligne de temps et l'appariement des promesses n'ont plus d'objet).

- [ ] **Step 4 : Écrire `buildPointerBrief` dans `seriesReaderService.ts`**

Les pointeurs du sujet, triés par date (non datés en dernier), `used` dérivé de `scripts.eventIds` des posts de la série ; `files` = le texte des documents cités, découpé en lignes ; `posts` = les posts de la série, par date. `planForSeries` perd `next` et ne garde que `events`, pour les écrans. Retirer `buildEventBriefForSeries` et `tellableTo`.

- [ ] **Step 5 : Lancer les tests pour vérifier qu'ils passent**

Run: `npx vitest run src/lib/services/`
Expected: PASS

- [ ] **Step 6 : Commit**

```bash
git add src/lib/services/materialEventService.ts src/lib/services/seriesReaderService.ts src/lib/services/seriesReaderService.test.ts
git commit -m "feat(pointeurs): l'extraction remplace la lecture, et la série donne sa ligne de temps entière"
```

---

### Task 5 : Le branchement dans la génération

**Files :**
- Modify: `src/lib/llm/generateScript.ts:41-75`
- Modify: `src/lib/services/scriptService.ts:107-140`
- Modify: `src/lib/services/postPairService.ts:46-84`
- Test: `src/lib/llm/generateScript.test.ts`

**Interfaces :**
- Consumes: `writePost` (tâche 3), `buildPointerBrief` (tâche 4), `splitHookAndCaption` (tâche 3).
- Produces: `ScriptGenerationContext.pointerBrief: PointerBrief | null` ; `GeneratedScript` enrichi de `eventIds: string[]`.

- [ ] **Step 1 : Écrire les tests qui échouent**

```ts
describe("generateScript avec pointerBrief", () => {
  it("passe par le rédacteur à pointeurs et rend hook, caption et eventIds", async () => {
    const r = await generateScript(ctx({ pointerBrief: brief, contentType: "text" }));
    expect(r.hookText).toBe("Accroche.");
    expect(r.eventIds).toEqual(["e1", "e2"]);
  });
  it("relance l'erreur avec « submitted no post » quand publish_post n'est jamais appelé", async () => {
    mockAgenticWithoutPublish();
    await expect(generateScript(ctx({ pointerBrief: brief }))).rejects.toThrow(/submitted no post/);
  });
  it("retombe sur le chemin V3 pour un post visuel", async () => {
    const r = await generateScript(ctx({ pointerBrief: brief, contentType: "visual" }));
    expect(r.contentType).toBe("visual");
  });
});
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/lib/llm/generateScript.test.ts`
Expected: FAIL — `pointerBrief` n'est pas dans le contexte.

- [ ] **Step 3 : Brancher le rédacteur**

Dans `generateScript`, remplacer les deux branches `narrativeBrief` et `eventBrief` par une seule : `if (context.pointerBrief && context.contentType === "text")` → `writePost` puis `splitHookAndCaption`, `hashtags: []`. Sans `publish_post`, lever `new Error("The writer submitted no post")` pour que le second essai de `postPairService` s'arme. Dans `scriptService`, construire `pointerBrief` au lieu d'`eventBrief` et retirer l'appel au fil narratif. Dans `postPairService`, écrire `eventIds` au complet et `eventId` = le premier.

- [ ] **Step 4 : Lancer les tests pour vérifier qu'ils passent**

Run: `npx vitest run`
Expected: PASS (les tests du fil narratif et du rédacteur par événements échouent encore — ils partent en tâche 6).

- [ ] **Step 5 : Commit**

```bash
git add src/lib/llm/generateScript.ts src/lib/services/scriptService.ts src/lib/services/postPairService.ts src/lib/llm/generateScript.test.ts
git commit -m "feat(pointeurs): la génération passe par le rédacteur qui choisit"
```

---

### Task 6 : Les retraits

**Files :**
- Delete: `src/lib/narrative/` (tout le dossier, tests compris), `src/lib/llm/narrativeWriter.ts`, `src/lib/llm/eventWriter.ts` (+ tests), `src/lib/llm/eventReader.ts` (+ tests), `src/lib/services/narrativeBriefService.ts` (+ test)
- Delete: `src/app/api/narrative/` s'il en reste quelque chose, `docs/SPEC_CHOIX_DES_EVENEMENTS.md`
- Modify: les imports orphelins signalés par le typecheck

- [ ] **Step 1 : Supprimer les fichiers et lancer le typecheck**

Run: `npx tsc --noEmit`
Expected: la liste exacte des imports à retirer. Les corriger jusqu'à zéro erreur.

- [ ] **Step 2 : Lancer toute la suite**

Run: `npm run test && npm run lint`
Expected: PASS. Les tests qui portaient sur le placement, le rédacteur de récit et le lecteur d'événements sont partis avec leur code.

- [ ] **Step 3 : Commit**

```bash
git add -A
git commit -m "refactor(pointeurs): retirer le fil narratif, le lecteur d'événements et le rédacteur par événements"
```

---

### Task 7 : Les écrans

**Files :**
- Modify: les composants qui affichent un événement par son titre — `src/components/SeriesReaderPanel.tsx`, le panneau Source (« Why this angle »), l'écran de ligne de temps
- Test: `npx tsc --noEmit` et la suite

**Interfaces :**
- Consumes: `planForSeries` sans `next` (tâche 4), `scripts.eventIds` (tâche 2).

- [ ] **Step 1 : Remplacer le titre d'un événement par son adresse**

Un événement s'affiche `document:ligne` et sa date. « Why this angle » montre les adresses du post, pas un concept.

- [ ] **Step 2 : Vérifier**

Run: `npx tsc --noEmit && npm run test && npm run build`
Expected: PASS

- [ ] **Step 3 : Commit**

```bash
git add -A
git commit -m "feat(pointeurs): les écrans affichent l'adresse d'un événement"
```

---

### Task 8 : L'essai en réel et la doc

**Files :**
- Modify: `docs/PROMPTS.md`, `docs/TECH.md`, `docs/guide/04-ia-et-generation.md`, `docs/guide/05-donnees.md`, `docs/DEVLOG.md`, `CLAUDE.md`

- [ ] **Step 1 : Lancer l'app et faire le parcours complet sur tellovo puis MyKiné**

Run: `npm run dev`, connecter le sujet, relire la matière, préparer une semaine.
Expected: la ligne de temps compte des centaines de pointeurs (581 attendus sur tellovo), les posts sortent dans la langue du profil, hook et caption séparés, les deux réseaux sur les mêmes `eventIds`.

- [ ] **Step 2 : Mettre la doc à jour**

Prompt 21 et 23 et 28 retirés de `docs/PROMPTS.md`, remplacés par l'extracteur et le rédacteur à pointeurs. `docs/TECH.md` : le modèle de données de `material_events`. `CLAUDE.md` : la ligne de `SPEC_CHOIX_DES_EVENEMENTS.md` remplacée par `SPEC_EVENEMENT_POINTEUR.md`.

- [ ] **Step 3 : Commit**

```bash
git add -A
git commit -m "docs(pointeurs): la doc suit le chantier"
```
