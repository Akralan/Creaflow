# Formes et genres Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** Le lecteur pose un `genre` sur chaque pointeur ; le rédacteur prend la forme du genre de l'événement qu'il a choisi, la lit avec `read_form`, l'écrit et la déclare ; l'app affiche l'étiquette de la forme sur chaque post.

**Architecture :** Un pointeur reste un document, une ligne, une date, et gagne un seul champ fermé : `genre` (13 valeurs), avec deux compléments posés par le même lecteur, `disponible` et `tient`. La ligne de temps que le rédacteur reçoit porte ces trois informations. Le rédacteur choisit son événement comme aujourd'hui, appelle `read_form(genre)`, écrit, et `publish_post` refuse un post dont la forme n'a pas été lue ou ne correspond pas aux événements déclarés. La forme est stockée sur `scripts.form`. Rien ne change dans le calendrier : la forme n'existe qu'une fois le post écrit.

**Tech Stack :** Next.js, Drizzle/PostgreSQL, Vitest, `callStructured` et `callAgentic` (adaptateur OpenAI).

**Spec :** `docs/FORMES_ET_GENRES.md` (Partie 1 : genres et règles du lecteur ; Partie 2 : formes ; Partie 3 : critères de lecture). Base de preuve : `docs/TYPOLOGIE_BUILD_IN_PUBLIC.md`, `docs/CATALOGUE_POSTS_LINKEDIN.md`.

**Branche :** `feature/formes-et-genres`, depuis `main` (qui contient le chantier pointeur).

## Global Constraints

- **Les quatre phrases du prompt du rédacteur restent, sauf la quatrième** (« aucun post mort et variation de forme »), remplacée par la règle de forme (tâche 5). Les trois autres sont **mot pour mot** celles de `SPEC_EVENEMENT_POINTEUR.md` §4 ; le test `porte les quatre règles arrêtées au run C` est mis à jour en conséquence, pas supprimé.
- **Les seize formes ne sont jamais dans le prompt système.** Le rédacteur reçoit la table genre → forme (une ligne par genre) et l'outil `read_form`. Loi du `DEVLOG.md` 2026-10-21 : tout élément nommé ressort dans le texte.
- **Le genre est le seul champ ajouté au pointeur.** `disponible` et `tient` sont ses compléments, posés dans le même appel. Rien d'autre ne revient sur `material_events` : pas de titre, pas de résumé, pas d'extrait. Le commentaire de `schema.ts` sur « aucun champ » est corrigé pour dire l'exception et son pourquoi.
- **Les identifiants de genre sont ceux de la spec, en français** (`livraison`, `échec`, `leçon`, `retour_utilisateur`…), pour que spec, prompt, base et banc parlent le même mot. Les formes et les étiquettes sont en anglais, comme l'app.
- **Aucune table nouvelle, aucun partitionnement par verticale** : `src/db/schemaInvariants.test.ts` reste vert.
- **La migration `0059` est écrite, pas appliquée** sur la base de dev partagée, comme `0057` et `0058` : les trois s'appliquent ensemble le jour où l'utilisateur le décide.
- **Modèle du banc : `gpt-6-luna`** (`OPENAI_MODEL`). La règle de forme est une règle de plus que le run C : elle doit passer le banc avant d'être tenue pour acquise, et les critères de la Partie 3 se lisent à la main sur les posts produits.
- **Texte des prompts.** La spec dit que le texte se rédige sur le banc, pas dans la spec. Ce plan donne une **première version** de chaque bloc pour démarrer le banc ; ce qui sort du banc fait foi et remonte dans `docs/PROMPTS.md`.

## Décisions de ce plan (pas de la spec)

- **`scripts.form` stocke aussi `episode`.** La spec dit « nullable, l'épisode n'en a pas ». On stocke `episode` et l'écran n'affiche pas d'étiquette pour cette valeur : `null` veut dire « post d'avant le chantier ou chemin V3 », ce qui n'est pas la même chose qu'un épisode. Rien ne change pour l'auteur.
- **Deux valeurs pour la même forme Promesse tenue** : `promise_kept` (`tient` → un `engagement`) et `looking_back` (`tient` → une `décision`). Même texte de forme, étiquettes différentes comme la table de la spec le prévoit.
- **« Another idea, same story » garde la forme.** Ce bouton verrouille déjà les pointeurs du post remplacé (`buildGenerationContext`, `rewrittenIds`) : il raconte la même chose autrement. La forme suit les pointeurs, elle est donc la même ; on la passe au rédacteur en `lockedForm` pour qu'il ne la rechoisisse pas. **Changer de matière, c'est supprimer le post** : le créneau redevient « To write », et le rédacteur repart libre, forme comprise. C'est le geste que l'auteur du projet décrit dans le journal de la spec.
- **La version X reprend la forme de la version LinkedIn**, comme elle reprend ses pointeurs (`postPairService`).
- **« La personne qui parle » (je / on) est dans le texte rendu par `read_form`**, en préambule commun à toutes les formes, et pas une cinquième phrase du prompt système. Le prompt reste à quatre phrases.
- **Contrôle de cohérence dans `publish_post`** : la forme déclarée doit être celle que le code calcule pour les événements déclarés (`formFor`), sauf au premier post d'un sujet où `origin` est toujours acceptée. Déterministe, sans modèle. Un refus rend au modèle la forme attendue.
- **`engagement` sans chiffre ni date dans la ligne est ramené à `décision` par le code** (règle 4 de la spec, critère vérifiable de la Partie 3). Le modèle ne décide pas seul du genre le plus précieux.

## Review Focus

- **`tient` vers un id inconnu ou postérieur** : ramené à `null` par le code, jamais une FK qui casse l'insertion. Test en tâche 3.
- **Plusieurs `déclencheur` sur un sujet** (l'extracteur travaille document par document, il ne peut pas le savoir) : le code garde le plus ancien et ramène les autres à `livraison`. Test en tâche 4.
- **`publish_post` avec une forme non lue** : refus avec un message qui nomme l'outil, et le modèle réessaie dans le même tour agentique ; `handed` reste faux tant qu'aucune remise n'est acceptée. Test en tâche 5.
- **`publish_post` au premier post** : `origin` acceptée quelle que soit la forme calculée. Test en tâche 5.
- **Posts existants** : `scripts.form` à `null` partout après la migration, l'écran ne doit afficher aucune étiquette pour eux ni planter. Tâche 7.
- **Cache du banc** : `timeline.json` d'avant le chantier n'a pas de genre ; un cache sans `genre` doit être ignoré, pas relu tel quel. Tâche 8.
- **Taille du message du lecteur** : la liste des engagements, annonces et décisions ouverts est plafonnée (40 entrées les plus récentes) pour qu'un sujet riche en décisions ne gonfle pas chaque appel. Tâche 4.

---

### Task 1 : Les genres et les formes en code

**Files :**
- Create: `src/lib/llm/postForms.ts`
- Test: `src/lib/llm/postForms.test.ts`

**Interfaces :**
- Produces: `GENRES` (les 13 identifiants, `Genre`), `FORMS` (les identifiants de forme, `Form` : `episode`, `launch`, `teaser`, `number`, `failure`, `lesson`, `proof`, `promise`, `promise_kept`, `looking_back`, `offer`, `question`, `backstage`, `curation`, `origin`), `FORM_LABELS: Record<Form, string | null>` (étiquettes anglaises de la spec, `null` pour `episode`), `formFor(entry: { genre: Genre; disponible: boolean; tientGenre: Genre | null }): Form`, `genreToFormTable(): string` (la table en une ligne par genre pour le prompt), `formText(form: Form): string` (le texte rendu par `read_form`, préambule « who speaks » compris), `WHO_SPEAKS: string`.

- [ ] **Step 1 : Écrire les tests qui échouent**

```ts
describe("formFor", () => {
  it("livraison → episode, livraison disponible → launch", () => {
    expect(formFor({ genre: "livraison", disponible: false, tientGenre: null })).toBe("episode");
    expect(formFor({ genre: "livraison", disponible: true, tientGenre: null })).toBe("launch");
  });
  it("tient gagne sur le genre : engagement → promise_kept, décision → looking_back, annonce → launch", () => {
    expect(formFor({ genre: "livraison", disponible: false, tientGenre: "engagement" })).toBe("promise_kept");
    expect(formFor({ genre: "chiffre", disponible: false, tientGenre: "décision" })).toBe("looking_back");
    expect(formFor({ genre: "livraison", disponible: false, tientGenre: "annonce" })).toBe("launch");
  });
  it("décision seule → episode, déclencheur → origin", () => {
    expect(formFor({ genre: "décision", disponible: false, tientGenre: null })).toBe("episode");
    expect(formFor({ genre: "déclencheur", disponible: false, tientGenre: null })).toBe("origin");
  });
});

describe("formText", () => {
  it("chaque forme a un texte qui commence par le préambule commun et porte ses cinq rubriques", () => {
    for (const f of FORMS) {
      const t = formText(f);
      expect(t.startsWith(WHO_SPEAKS)).toBe(true);
      for (const h of ["Reads", "Opens", "Body", "Ends", "Never"]) expect(t).toContain(h);
    }
  });
  it("promise_kept et looking_back partagent le même texte", () => {
    expect(formText("promise_kept")).toBe(formText("looking_back"));
  });
});

describe("genreToFormTable", () => {
  it("a une ligne par genre et aucune rubrique de forme", () => {
    const t = genreToFormTable();
    for (const g of GENRES) expect(t).toContain(g);
    expect(t).not.toContain("Opens");
  });
});
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/lib/llm/postForms.test.ts`
Expected: FAIL — le module n'existe pas.

- [ ] **Step 3 : Écrire `postForms.ts`**

Les textes de forme sont la traduction en anglais, rubrique par rubrique, des blocs « Lit / S'ouvre / Corps / S'arrête / Ne fait pas » de la Partie 2, **sans** les lignes « Observé » ni les chiffres de performance. Le préambule `WHO_SPEAKS` est la section « La personne qui parle » de la spec, en anglais, en quatre phrases. La table `genreToFormTable()` ne donne que `genre → form name`, une ligne par genre, plus les trois lignes `tient`.

- [ ] **Step 4 : Lancer les tests pour vérifier qu'ils passent**

Run: `npx vitest run src/lib/llm/postForms.test.ts`
Expected: PASS

- [ ] **Step 5 : Commit**

```bash
git add src/lib/llm/postForms.ts src/lib/llm/postForms.test.ts
git commit -m "feat(formes): les treize genres et les seize formes en code"
```

---

### Task 2 : La migration

**Files :**
- Modify: `src/db/schema.ts` (`materialEvents`, `scripts`, enums)
- Create: `drizzle/0059_formes_et_genres.sql` + entrée dans `drizzle/meta/_journal.json` et snapshot
- Test: `src/db/schemaInvariants.test.ts` (doit rester vert)

**Interfaces :**
- Produces: `materialEventGenreEnum` (`material_event_genre`, 13 valeurs de `GENRES`), `postFormEnum` (`post_form`, valeurs de `FORMS`), `materialEvents.genre` (NOT NULL, défaut `livraison`), `materialEvents.disponible` (bool NOT NULL défaut false), `materialEvents.tient` (uuid, FK vers `material_events.id`, `ON DELETE SET NULL`), `scripts.form` (nullable).

- [ ] **Step 1 : Modifier le schéma**

Dans `materialEvents` : ajouter les trois colonnes, et réécrire le commentaire « No title, no summary… nothing to add later » pour dire : un genre est l'unique exception, une classification fermée faite à la lecture, et pourquoi (`docs/FORMES_ET_GENRES.md`, journal des décisions). Dans `scripts` : `form: postFormEnum("form")`, commentaire : la forme que le rédacteur a déclarée en remettant le post ; `null` avant le chantier et sur le chemin V3.

- [ ] **Step 2 : Générer la migration**

Run: `npm run db:generate`
Expected: `drizzle/0059_*.sql` créé (renommer en `0059_formes_et_genres.sql` et aligner le `tag` du journal). La relire : deux `CREATE TYPE`, trois `ADD COLUMN` sur `material_events`, une FK auto-référente, un `ADD COLUMN` sur `scripts`. Rien de destructif : les pointeurs existants prennent `livraison` par défaut, ce qui est le défaut de la spec.

- [ ] **Step 3 : Vérifier les invariants et la compilation**

Run: `npx vitest run src/db/schemaInvariants.test.ts && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4 : Commit**

```bash
git add src/db/schema.ts drizzle/
git commit -m "feat(formes): genre, disponible et tient sur le pointeur, form sur le script"
```

---

### Task 3 : L'extracteur pose le genre

**Files :**
- Modify: `src/lib/llm/pointerExtractor.ts`
- Test: `src/lib/llm/pointerExtractor.test.ts`

**Interfaces :**
- Produces: `Pointer` gagne `genre: Genre`, `disponible: boolean`, `tient: string | null`. `OpenEvent = { id: string; genre: "engagement" | "annonce" | "décision"; date: string | null; text: string }`. `extractPointers(doc, open: OpenEvent[] = [])`. `normalizePointer(raw, { totalLines, openIds }): Pointer | null` (pur : les contrôles du code).
- Consumes: `GENRES` (tâche 1).

- [ ] **Step 1 : Écrire les tests qui échouent**

```ts
it("pose le genre, et ramène un genre inconnu à livraison", async () => {
  mockStructured({ events: [
    { line: 1, date: "2026-10-01", genre: "échec", available: false, fulfills: "" },
    { line: 2, date: "", genre: "truc", available: false, fulfills: "" },
  ] });
  const { pointers } = await extractPointers({ file: "d.md", text: "a\nb" });
  expect(pointers.map((p) => p.genre)).toEqual(["échec", "livraison"]);
});

it("ramène un engagement sans chiffre ni date dans la ligne à décision", async () => {
  mockStructured({ events: [{ line: 1, date: "", genre: "engagement", available: false, fulfills: "" }] });
  const { pointers } = await extractPointers({ file: "d.md", text: "On va faire mieux." });
  expect(pointers[0].genre).toBe("décision");
});

it("garde un engagement qui porte un nombre ou une date", async () => {
  mockStructured({ events: [{ line: 1, date: "", genre: "engagement", available: false, fulfills: "" }] });
  const { pointers } = await extractPointers({ file: "d.md", text: "1 M de vues d'ici le 31 décembre." });
  expect(pointers[0].genre).toBe("engagement");
});

it("tient : seulement vers un id de la liste ouverte, sinon null", async () => {
  mockStructured({ events: [
    { line: 1, date: "", genre: "livraison", available: true, fulfills: "e-open" },
    { line: 2, date: "", genre: "livraison", available: false, fulfills: "e-unknown" },
  ] });
  const open = [{ id: "e-open", genre: "annonce" as const, date: "2026-09-01", text: "dispo le 3 novembre" }];
  const { pointers } = await extractPointers({ file: "d.md", text: "a\nb" }, open);
  expect(pointers.map((p) => p.tient)).toEqual(["e-open", null]);
  expect(pointers[0].disponible).toBe(true);
});

it("le message utilisateur porte la liste ouverte quand il y en a une", async () => {
  mockStructured({ events: [] });
  await extractPointers({ file: "d.md", text: "a" }, [{ id: "e1", genre: "engagement", date: "2026-09-01", text: "100 clients avant Noël" }]);
  expect(callStructuredMock.mock.calls[0][0].userMessage).toContain("100 clients avant Noël");
});
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/lib/llm/pointerExtractor.test.ts`
Expected: FAIL — l'outil n'a pas ces champs.

- [ ] **Step 3 : Étendre l'outil et le prompt**

L'outil `record_events` gagne par entrée : `genre` (enum des 13, obligatoire), `available` (bool), `fulfills` (string, id de la liste ouverte ou vide). Le prompt système garde `EVENT_DEFINITION` et la phrase « you record nothing about an event » amendée : *« …except its genre: what kind of fact it is, one of thirteen, defined below. »* Puis la liste des treize genres avec leur condition minimale (Partie 1, tables), et les règles 1 à 15 réécrites en anglais, chacune en une phrase. Le message utilisateur gagne un bloc `<open>` avec les engagements, annonces et décisions du sujet (id, date, texte de la ligne), et la consigne de la règle 14.

- [ ] **Step 4 : Les contrôles du code dans `normalizePointer`**

Genre hors des treize → `livraison`. `engagement` dont la ligne ne contient ni chiffre ni date (regex `\d`) → `décision`. `fulfills` qui n'est pas dans `openIds` → `tient: null`. `available` n'est gardé que sur `livraison`.

- [ ] **Step 5 : Lancer les tests pour vérifier qu'ils passent**

Run: `npx vitest run src/lib/llm/pointerExtractor.test.ts`
Expected: PASS

- [ ] **Step 6 : Commit**

```bash
git add src/lib/llm/pointerExtractor.ts src/lib/llm/pointerExtractor.test.ts
git commit -m "feat(formes): l'extracteur pose un genre sur chaque pointeur"
```

---

### Task 4 : Le service : liste ouverte et déclencheur unique

**Files :**
- Modify: `src/lib/services/materialEventService.ts`
- Create: `src/lib/services/eventGenres.ts` (pur) + `src/lib/services/eventGenres.test.ts`

**Interfaces :**
- Produces: `openEventsFor(events: Array<{ id; genre; date; line; sourceMaterialId; heldBy: boolean }>, texts: Map<sourceMaterialId, string[]>, cap = 40): OpenEvent[]` (engagements et annonces qu'aucun `tient` ne vise, toutes les décisions, les plus récentes d'abord, plafonné) ; `keepOldestTrigger(events: Array<{ id; genre; date; createdAt }>): string[]` (les ids à ramener à `livraison`).
- Consumes: `extractPointers(doc, open)` (tâche 3).

- [ ] **Step 1 : Écrire les tests qui échouent**

```ts
it("openEventsFor écarte un engagement déjà tenu et plafonne", () => {
  const events = [
    { id: "a", genre: "engagement", date: "2026-01-01", line: 1, sourceMaterialId: "d", heldBy: true },
    { id: "b", genre: "annonce", date: "2026-02-01", line: 2, sourceMaterialId: "d", heldBy: false },
    { id: "c", genre: "décision", date: "2026-03-01", line: 3, sourceMaterialId: "d", heldBy: false },
    { id: "d", genre: "livraison", date: "2026-03-02", line: 4, sourceMaterialId: "d", heldBy: false },
  ];
  const open = openEventsFor(events, new Map([["d", ["l1", "l2", "l3", "l4"]]]), 2);
  expect(open.map((o) => o.id)).toEqual(["c", "b"]);
  expect(open[1].text).toBe("l2");
});

it("keepOldestTrigger garde le plus ancien déclencheur et rend les autres", () => {
  const ids = keepOldestTrigger([
    { id: "x", genre: "déclencheur", date: "2026-05-01", createdAt: new Date(1) },
    { id: "y", genre: "déclencheur", date: "2025-01-01", createdAt: new Date(2) },
    { id: "z", genre: "déclencheur", date: null, createdAt: new Date(0) },
  ]);
  expect(ids.sort()).toEqual(["x", "z"]);
});
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/lib/services/eventGenres.test.ts`
Expected: FAIL

- [ ] **Step 3 : Écrire les deux fonctions pures, puis les brancher**

Dans `readEventsForSubject`, avant chaque document : charger les événements du sujet de genre `engagement`, `annonce`, `décision` avec un marqueur `heldBy` (existe-t-il un événement dont `tient` les vise), et les textes de ligne depuis `source_materials.raw_text` ; construire `open` ; appeler `extractPointers(doc, open)` ; insérer avec `genre`, `disponible`, `tient`. Après le dernier document : `keepOldestTrigger` sur les `déclencheur` du sujet, `UPDATE … SET genre = 'livraison'` sur les ids rendus. `markMaterialForReReading` ne change pas (les pointeurs partent avec leur relecture, `tient` en SET NULL ne retient rien).

- [ ] **Step 4 : Vérifier**

Run: `npx vitest run src/lib/services && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5 : Commit**

```bash
git add src/lib/services/materialEventService.ts src/lib/services/eventGenres.ts src/lib/services/eventGenres.test.ts
git commit -m "feat(formes): la liste ouverte pour tient, un seul déclencheur par sujet"
```

---

### Task 5 : Le rédacteur lit sa forme et la déclare

**Files :**
- Modify: `src/lib/llm/pointerPostWriter.ts`
- Test: `src/lib/llm/pointerPostWriter.test.ts`

**Interfaces :**
- Produces: `TimelineEntry` gagne `genre: Genre`, `disponible: boolean`, `tient: string | null` ; `WriterContext.lockedForm?: Form | null` ; `READ_FORM_TOOL = "read_form"` ; `publish_post` gagne `form` (enum `FORMS`, obligatoire) ; `WrittenResult.form: Form | null` ; `expectedForm(c: WriterContext, eventIds: string[]): Form | null` (pur : la forme que `formFor` donne aux événements déclarés, `origin` si `c.posts` est vide).
- Consumes: `postForms.ts` (tâche 1).

- [ ] **Step 1 : Écrire les tests qui échouent**

```ts
it("la ligne de temps affiche le genre, la disponibilité et tient", () => {
  const m = buildWriterUserMessage(ctx({ timeline: [
    { id: "e1", file: "d.md", line: 3, date: "2026-09-01", used: false, genre: "livraison", disponible: true, tient: null },
    { id: "e2", file: "d.md", line: 9, date: null, used: false, genre: "chiffre", disponible: false, tient: "e1" },
  ] }));
  expect(m).toContain("[e1] 2026-09-01 · d.md:3 · livraison (available)");
  expect(m).toContain("[e2] no date · d.md:9 · chiffre · fulfills e1");
});

it("le prompt système porte la table genre → forme, pas les formes", () => {
  const p = buildWriterSystemPrompt(ctx());
  expect(p).toContain(genreToFormTable());
  expect(p).toContain(READ_FORM_TOOL);
  expect(p).not.toContain("Opens");
  expect(p).not.toContain("never to copy their shape"); // la quatrième phrase du run C est remplacée
});

it("read_form rend le texte de la forme et une erreur nommée pour une forme inconnue", () => {
  expect(runWriterTool(ctx(), { name: "read_form", input: { form: "failure" } })).toMatchObject({ form: "failure", text: formText("failure") });
  expect(runWriterTool(ctx(), { name: "read_form", input: { form: "sonnet" } })).toMatchObject({ error: expect.stringContaining("sonnet") });
});

it("expectedForm suit formFor, et rend origin au premier post", () => {
  const c = ctx({ timeline: [{ id: "e1", file: "d.md", line: 1, date: null, used: false, genre: "échec", disponible: false, tient: null }], posts: [] });
  expect(expectedForm(c, ["e1"])).toBe("origin");
  expect(expectedForm({ ...c, posts: [{ id: "p1", date: "2026-10-01", text: "x" }] }, ["e1"])).toBe("failure");
});

it("publish_post refuse une forme non lue, puis une forme qui ne colle pas, puis accepte", async () => {
  // callAgentic mocké : trois appels à onToolCall dans l'ordre, et on inspecte les réponses rendues.
  // 1. publish {form:"failure"} sans read_form → { error: contient "read_form" }
  // 2. read_form {form:"failure"} puis publish {form:"lesson", event_ids:["e1"]} → { error: contient "failure" }
  // 3. publish {form:"failure", event_ids:["e1"]} → { ok: true } et result.form === "failure", handed === true
});

it("lockedForm impose la forme : publish avec une autre forme est refusé", async () => { /* idem, lockedForm: "launch" */ });
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/lib/llm/pointerPostWriter.test.ts`
Expected: FAIL

- [ ] **Step 3 : La quatrième phrase, première version pour le banc**

Remplacer, dans `buildWriterSystemPrompt`, le paragraphe « And no post of yours is allowed to be dead… » et la fin du paragraphe sur la timeline (« You read them to find out what has already been said… let each one take the form its own material calls for ») par :

> *Each address also carries the genre of what happened there — what kind of fact it is. The form of your post is decided by the genre of the event you build it from, and by nothing else: the table below gives it. Once you have chosen your event, read its form with `read_form` and write inside it. If an address says it fulfills an earlier one, open that earlier address too: your post is about both. You read the published posts to find out what has already been said, so you do not write it again. And if you name a table, a function, a library, a tool or any piece of the machinery, say what it is or what it does in the same breath.*

suivi de `<forms>` + `genreToFormTable()` + `</forms>`. Quand `c.lockedForm` est posé : *« The form of this post is already set: `<form>`. Read it with `read_form` and keep it. »* Le reste du prompt est inchangé.

- [ ] **Step 4 : Les outils et le contrôle de `publish_post`**

`read_form(form)` rend `{ form, text }` et note la forme dans un `Set` local au `writePost`. `publish_post` : `form` obligatoire ; refus `{ error }` si la forme n'a pas été lue (« Read the form of your genre with read_form before handing in. »), si `lockedForm` est posé et différent, ou si `form !== expectedForm(c, event_ids)` (le message donne la forme attendue). Sinon `handed = { text, eventIds, form }`.

- [ ] **Step 5 : Lancer les tests pour vérifier qu'ils passent**

Run: `npx vitest run src/lib/llm/pointerPostWriter.test.ts`
Expected: PASS

- [ ] **Step 6 : Commit**

```bash
git add src/lib/llm/pointerPostWriter.ts src/lib/llm/pointerPostWriter.test.ts
git commit -m "feat(formes): le rédacteur lit la forme de son genre et la déclare"
```

---

### Task 6 : Le branchement dans la génération

**Files :**
- Modify: `src/lib/llm/scriptSchema.ts` (`GeneratedScript.form?: Form | null`)
- Modify: `src/lib/llm/generateScript.ts` (passe `lockedForm`, rend `form`)
- Modify: `src/lib/services/seriesReaderService.ts` (`PointerRow` et `pointerTimeline` portent `genre`, `disponible`, `tient` ; `PointerBrief.lockedForm`)
- Modify: `src/lib/services/scriptService.ts` (`buildGenerationContext` : `lockedForm` depuis le script remplacé ou `sameForm` ; `createScriptRecord` / `updateScriptRecord` persistent `form`)
- Modify: `src/lib/services/postPairService.ts` (`writeSlotVersion(userId, entry, samePointerIds, sameForm)` ; `pointersOfWrittenVersion` rend aussi `form`)
- Test: `src/lib/services/seriesReaderService.test.ts` (existant, étendre `pointerTimeline`)

**Interfaces :**
- Consumes: tâches 2 et 5.

- [ ] **Step 1 : Test de `pointerTimeline`**

Un `PointerRow` avec `genre: "échec"`, `disponible: false`, `tient: "e0"` ressort tel quel dans `TimelineEntry`.

- [ ] **Step 2 : Faire passer la forme de bout en bout**

`loadTimeline` lit les trois colonnes. `buildPointerBrief(userId, seriesId, lockedIds, lockedForm)` la rend. `buildGenerationContext` : `lockedForm` = `form` du script remplacé (`excludeScriptId`, « another idea, same story ») sinon `sameForm` (version X). `generateScript` passe `lockedForm` au rédacteur et rend `form: written.form`. `createScriptRecord` / `updateScriptRecord` écrivent `form`. `postPairService.writePost` reprend `form` de la première version écrite pour les suivantes, comme il fait pour `pointerIds`.

- [ ] **Step 3 : Vérifier**

Run: `npx tsc --noEmit && npm run test`
Expected: PASS

- [ ] **Step 4 : Commit**

```bash
git add -A src/lib
git commit -m "feat(formes): la forme suit le post jusqu'en base, et la version X la reprend"
```

---

### Task 7 : Les écrans

**Files :**
- Modify: `src/lib/services/calendarWeekService.ts` (colonne `form` du script dans la semaine)
- Modify: `src/lib/apiClient.ts` (`Script.form`, `WeekEntry.script.form`)
- Modify: `src/components/app/WeekScreen.tsx` (étiquette sur la carte, à côté de l'état)
- Modify: `src/components/app/PostPane.tsx` (étiquette en tête du post, sous le titre)
- Modify: `src/components/app/app-extra.css` (`.ap .form-tag`, même famille que `.series-tag`)
- Test: `npx tsc --noEmit`, puis œil dans l'app

**Interfaces :**
- Consumes: `FORM_LABELS` (tâche 1), `scripts.form` (tâche 2).

- [ ] **Step 1 : Renvoyer `form` dans la semaine et le détail**

`calendarWeekService` ajoute `form: true` aux colonnes du script. `GET /api/scripts/[id]` le rend déjà par le spread de `rest`. Types côté client.

- [ ] **Step 2 : Afficher l'étiquette**

Sur la carte : `FORM_LABELS[form]` quand il est non nul, non éditable, après l'état. Dans le `PostPane` : la même étiquette sous le titre. `episode` et `null` : rien. Le label vient du code client via `FORM_LABELS` importé de `postForms.ts` (pur, sans dépendance serveur).

- [ ] **Step 3 : Vérifier**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS. Puis `npm run dev`, un compte avec des posts d'avant le chantier : aucune étiquette, aucune erreur.

- [ ] **Step 4 : Commit**

```bash
git add -A src
git commit -m "feat(formes): l'étiquette de la forme sur la carte et en tête du post"
```

---

### Task 8 : Le banc

**Files :**
- Modify: `scripts/bench-pointeurs.ts`
- Create: `docs/tests/mykine-pack/C/genres.md` (matière de banc : un événement par genre, dont un `engagement` et l'événement qui le `tient`, une `décision` et l'événement qui y revient, une `annonce` et sa livraison, un `déclencheur`)
- Output: `docs/tests/pointeurs/mykine/` (relevés du run)

**Interfaces :**
- Consumes: tâches 3, 4 (fonctions pures `openEventsFor`), 5.

- [ ] **Step 1 : Adapter le banc**

L'extraction enchaîne les documents en construisant la liste ouverte avec `openEventsFor` d'un document au suivant, puis `keepOldestTrigger`. Le cache `timeline.json` est ignoré s'il ne porte pas `genre` (et réécrit). La `TimelineEntry` porte les trois champs. Le relevé affiche, par post : la forme déclarée, les événements choisis avec leur genre, le nombre de `read_form`, et un drapeau si `publish_post` a été refusé au moins une fois. Le rapport commence par la répartition des genres sur la ligne de temps.

- [ ] **Step 2 : Déposer la matière de banc**

`docs/tests/mykine-pack/C/genres.md` : un devlog daté d'une vingtaine de lignes qui remplit chaque condition minimale de la Partie 1 au moins une fois, écrit dans les mots d'un auteur (pas une liste de genres). L'ingérer dans le sujet MyKiné du compte de test (`docs/tests/mykine-pack/BIBLE.md` dit comment) et relire la matière.

- [ ] **Step 3 : Lancer**

Run: `node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/bench-pointeurs.ts 12 mykine`
Expected: la ligne de temps compte au moins un pointeur par genre ; 12 posts remis (`handed`), au moins quatre formes différentes sur les 12, un `promise_kept` ou `looking_back` quand l'événement `tient` est choisi, `origin` au premier post et jamais après.

- [ ] **Step 4 : Lire les critères de la Partie 3 à la main**

Un tableau dans `docs/tests/pointeurs/mykine/criteres-<modèle>.md` : une ligne par post, forme, critère de la spec, tenu ou non, et pour les non tenus la phrase fautive. Si une forme rate son critère sur deux posts, retoucher **son texte dans `postForms.ts`** (jamais le prompt système) et relancer. Ce qui change remonte dans la spec, Partie 2, avec la raison.

- [ ] **Step 5 : Commit**

```bash
git add scripts/bench-pointeurs.ts docs/tests/
git commit -m "test(formes): le banc pose les genres et lit les formes"
```

---

### Task 9 : La doc

**Files :**
- Modify: `docs/PROMPTS.md` (§29 extracteur : genres et liste ouverte ; §30 rédacteur : la quatrième phrase, `read_form`, le contrôle de `publish_post`), `docs/TECH.md` (§ modèle de données `material_events` et `scripts.form` ; corriger la phrase « ni genre »), `docs/guide/04-ia-et-generation.md`, `docs/guide/05-donnees.md`, `docs/DEVLOG.md` (entrée du jour : ce que le banc a montré), `docs/SPEC_EVENEMENT_POINTEUR.md` (§2 : renvoi vers l'exception), `docs/FORMES_ET_GENRES.md` (statut : implémenté, résultats du banc), `CLAUDE.md` (entrée mise à jour)

- [ ] **Step 1 : Mettre la doc à jour**

Les textes de prompt recopiés dans `PROMPTS.md` sont ceux qui sortent du banc, pas ceux de ce plan.

- [ ] **Step 2 : Commit**

```bash
git add -A docs CLAUDE.md
git commit -m "docs(formes): la doc suit le chantier"
```

---

## Ordre et ce qui peut attendre

Tâches 1 → 5 sans base ni clé (tout est pur ou mocké). Tâche 6 demande `tsc` et la suite. Tâche 7 demande l'app en local sur une base **où `0057`-`0059` sont appliquées** : à faire sur une base jetable si la base de dev partagée ne doit pas bouger. Tâche 8 demande `OPENAI_API_KEY` et `gpt-6-luna`. Rien n'est mergé avant que le banc ait tourné et que les critères aient été lus.
