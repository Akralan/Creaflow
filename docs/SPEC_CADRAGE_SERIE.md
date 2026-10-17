# SPEC — CADRER UNE SÉRIE PAR DES CHOIX

> **Statut : validé et implémenté le 2026-10-17** sur la branche `feature/prompt-generation-v3`, migration `0041` appliquée en base de dev. Étape posture essayée en réel (6 s, trois extraits distincts de 46 à 60 mots) ; parcours complet dans le navigateur et génération avec cadrage (test 3) encore à faire. Écarts constatés en réel : §6. Fait suite à `docs/SPEC_PROMPT_GENERATION_V3.md` et `docs/SPEC_MEMOIRE_ET_VEILLE.md`.
>
> **Objectif.** Personne ne sait répondre à « quel ton veux-tu ? », mais tout le monde sait dire « celui-là » devant trois textes. Avant le premier épisode d'une série, l'auteur choisit, parmi trois extraits écrits à partir d'un vrai moment de sa matière, **sa posture**, **sa voix** et **son récit**. Le modèle propose ensuite une **signature**. Ce cadrage entre dans chaque génération de la série, avec les extraits choisis comme exemples de manière.

---

## 1. Décisions tranchées

| Sujet | Décision |
| :--- | :--- |
| Les trois dimensions | **Posture** (d'où l'auteur parle au lecteur), **voix** (ses mots), **récit** (comment un épisode avance). La posture et le récit sont propres à la série ; la voix est propre à l'auteur. |
| Signature | Proposée par le modèle après les trois choix : une ouverture fixe, une formule de fin, un titre-rubrique ou un compteur. L'auteur l'accepte, la modifie ou la refuse. |
| Voix | Choisie **une fois pour le compte**, au premier cadrage (`creatorProfiles.chosenVoice`). Pour les séries suivantes, l'étape est proposée comme facultative : on garde sa voix, ou on l'ajuste pour cette série seulement (`framing.voice`). L'apprentissage du style par les corrections prend ensuite le relais, par-dessus. |
| Options | Un **catalogue fixe** de 6 options par dimension, dans le code, chacune avec une règle précise que le prompt applique. Le modèle choisit les **3 plus pertinentes et les plus différentes** pour ce sujet et ce public, puis écrit les extraits. Les règles restent stables, les extraits sont personnels. |
| Le moment raconté | Le même pour les trois étapes, pour qu'on compare la manière et pas le sujet : le prochain épisode du plan du rédacteur en chef et ses documents ; à défaut, le document le plus racontable du sujet, choisi par le modèle sur les résumés (§6) ; sans matière, la description du sujet, ce qui est signalé sur les cartes. |
| Cumul | Chaque étape est écrite avec les choix précédents : les voix dans la posture choisie, les récits dans la posture et la voix choisies. |
| « Aucune ne me va » | Trois autres options, en excluant celles déjà vues, avec une remarque libre facultative (« comme la 2, mais plus court »). |
| Extraits écartés | Gardés comme contre-exemples (« pas comme ça »). |
| Où | En haut du détail d'une série (Direction) : « Avant le premier épisode, choisis comment tu veux le raconter » si la série n'est pas cadrée, sinon un résumé et « Recadrer ». La première série d'un compte neuf affiche la même carte : l'onboarding n'a pas d'écran de plus. |
| Conflit avec l'angle | Une série cadrée garde l'angle tiré à chaque post, mais seulement pour **la forme de l'accroche** : la structure vient du récit choisi. |
| Hors périmètre | L'aperçu d'un premier épisode à la fin du cadrage (le test 3 le fait à part) ; le cadrage depuis l'assistant. |

---

## 2. Données

- `content_series.framing` (jsonb, nullable) :
  ```ts
  {
    moment: { title: string; docIds: string[] };
    posture: FramingChoice;
    voice: FramingChoice | null;     // null = la voix du compte
    story: FramingChoice;
    signature: { text: string; placement: "ouverture" | "fin" | "titre" } | null;
    rejected: Array<{ dimension: "posture" | "voice" | "story"; id: string; label: string; sample: string }>;
    remarks: string[];
    completedAt: string;
  }
  // FramingChoice = { id, label, rule, sample }
  ```
- `creator_profiles.chosen_voice` (jsonb, nullable) : `FramingChoice` + `chosenAt`.
- Migration `0041`.

## 3. Appels au modèle

`src/lib/llm/seriesFraming.ts` :
- `proposeFramingOptions` : une dimension, le catalogue, le moment et sa matière, les choix déjà faits, les options exclues, la remarque. Outil `propose_framing_options` en mode strict : exactement 3 `{ id, sample }`, avec `id` en enum du catalogue (moins les exclues). `maxTokens` 2048. Annexe A.2.
- `proposeSignature` : les trois choix et un extrait. Outil `propose_signature`. Annexe A.3.

Le service `seriesFramingService.ts` trouve le moment, appelle le modèle, enregistre le cadrage, et pose `chosenVoice` sur le profil s'il n'en a pas encore.

Routes :
- `POST /api/series/[id]/framing/options` → `{ moment, options: [{ id, label, description, sample }] }` ;
- `POST /api/series/[id]/framing/signature` → `{ text, placement, why }` ;
- `PUT /api/series/[id]/framing` → enregistre.

## 4. Dans la génération

- Le bloc `<cadrage>`, placé après `<style>`, est présent pour une série cadrée (Annexe A.4).
- La voix choisie (compte ou série) s'ajoute au bloc `<style>`.
- La priorité n° 2 du system prompt devient « ce que l'auteur a demandé pour ce post et pour cette série (idée soufflée, direction éditoriale, cadrage choisi) ».
- Une série cadrée réduit l'angle à l'accroche : `Angle (forme de l'accroche seulement, la structure vient du récit choisi)`.

## 5. Écran

Panneau `SeriesFramingPanel` en haut de `SeriesDetail` :
- **série non cadrée** : une carte d'appel et un bouton « Cadrer la série » ;
- **série cadrée** : le résumé (posture, voix, récit, signature) et le bouton « Recadrer ».

L'assistant de cadrage passe par trois étapes, puis par la signature, puis enregistre :
- chaque étape propose trois cartes, avec un nom, une ligne d'explication et l'extrait, sous le moment raconté ;
- en bas de chaque étape : « Aucune ne me va », une remarque facultative, et « Retour » ;
- la signature s'affiche dans un champ modifiable, avec « Sans signature » ;
- pour une série suivante, l'étape voix commence par « Garder ma voix (label) » ou « L'ajuster pour cette série ».

## 6. Écarts avec la version validée

Constatés au premier essai réel, corrigés le même jour :

- **Le moment.** Le document le plus récent du sujet était un README d'installation, sans histoire à raconter. `pickFramingMoment` fait maintenant choisir au modèle, sur les résumés des 40 derniers documents, le moment le plus racontable, en écartant les documents d'installation. Le plan du rédacteur en chef garde la priorité quand son prochain épisode pointe des documents.
- **La longueur des extraits.** Les premiers extraits faisaient plus de 120 mots : trop longs pour comparer trois cartes d'un coup d'œil. Plafond à 80 mots, dans le prompt et dans la description du champ.
- **Le même moment d'un bout à l'autre.** Le navigateur renvoie le moment à chaque étape (paramètre `moment` de la route d'options) ; « Recadrer » en demande un nouveau (`freshMoment`) au lieu de réutiliser celui du cadrage précédent.
- **La série sans sujet.** La série de dev n'était rattachée à aucun sujet : pas de matière, pas de lecteurs, des extraits génériques. La génération des séries rattache désormais chaque série au sujet choisi par le modèle, ou d'office à l'unique sujet du compte (`generateSeriesForUser`).

---

## Annexe A — Textes de référence

### A.1 Catalogues

**Posture**

| id | Nom | Pour l'auteur | Règle pour le prompt |
|---|---|---|---|
| coulisses | Les coulisses | Je te montre ce que je fais, y compris ce qui rate. | Première personne. Montre le travail en train de se faire, avec ses ratés et ses doutes. Pas de leçon générale plaquée : le lecteur tire la sienne. |
| pedagogue | Le pédagogue | Je t'explique ce que j'ai compris. | S'adresse au lecteur. Part de ce qu'il sait, ajoute une notion, l'illustre par le cas de l'auteur, finit sur une idée claire qu'il peut réutiliser. |
| position | La prise de position | Voilà ce que je pense, et pourquoi. | Une thèse nette dès l'accroche, défendue par les faits de la matière. Assume le désaccord sans caricaturer l'avis inverse. |
| labo | Le carnet de labo | J'ai testé, voici ce que ça donne. | Protocole, mesure, résultat, limite. Ton factuel, chiffres en avant, conclusions prudentes. |
| guide | Le guide | Voici comment faire. | Mode d'emploi concret tiré de ce que l'auteur a fait : étapes, outils, pièges. Le lecteur doit pouvoir refaire. |
| compagnon | Le compagnon de route | On avance ensemble. | Le lecteur est embarqué : « on », vraies questions posées à la communauté, invitation sincère à réagir. Chaleureux, jamais racoleur. |

**Voix**

| id | Nom | Pour l'auteur | Règle pour le prompt |
|---|---|---|---|
| sobre | Sobre et précise | Peu de mots, les bons. | Phrases courtes, mots exacts, aucun effet de style, pas d'emoji, pas de point d'exclamation. |
| parlee | Parlée et directe | Comme à l'oral, entre collègues. | Le ton de l'oral : tournures simples, expressions familières mesurées, phrases qui s'enchaînent comme on parle. |
| imagee | Imagée | Une image vaut mieux qu'un concept. | Au plus une image ou une comparaison par post, concrète et tirée du métier de l'auteur, jamais une métaphore toute faite. |
| pairs | Entre pairs | Le jargon du métier, assumé. | Les termes techniques du domaine employés sans les expliquer, comme entre gens du métier. |
| vulgarisee | Vulgarisée | Compréhensible par tous. | Chaque terme technique est remplacé par un mot courant ou expliqué en une phrase simple. |
| chaleureuse | Chaleureuse | Personnelle et sincère. | Ton personnel ; les émotions et les remerciements seulement quand la matière les contient, jamais inventés. |

**Récit**

| id | Nom | Pour l'auteur | Règle pour le prompt |
|---|---|---|---|
| journal | Le journal | J'ai essayé, ça a cassé, j'ai compris. | Chronologique : ce que l'auteur a tenté, ce qui s'est passé, ce qu'il en retient, ce qui vient ensuite. |
| fin | Par la fin | On commence par le résultat, puis on remonte. | Ouvre sur le résultat ou la conclusion, puis raconte comment on y est arrivé. |
| probleme | Problème puis solution | Le problème, les tentatives, ce qui a marché. | Le problème concret d'abord, puis les essais, puis la solution retenue et pourquoi. |
| avantapres | L'avant / après | Avant, le changement, après. | L'état d'avant, le changement précis, l'état d'après, ce qui explique l'écart. |
| question | La question ouverte | Une vraie question, sans conclure. | Une question que l'auteur se pose vraiment, les pistes qu'il voit, sans trancher ; le lecteur est invité à répondre. |
| lecons | Les leçons | Ce qu'un moment m'a appris. | Un seul moment raconté brièvement, puis deux ou trois enseignements qui en découlent, du plus surprenant au plus attendu. |

### A.2 Proposer les options (`proposeFramingOptions`)

System prompt :

```text
Tu aides un auteur à choisir comment raconter une série de posts. On te donne une dimension à choisir (posture, voix ou récit), un catalogue d'options, un moment réel tiré de sa matière, et les choix qu'il a déjà faits.

1. Choisis les 3 options du catalogue les plus pertinentes pour ce sujet et ce public, et les plus DIFFÉRENTES entre elles : l'auteur doit sentir la différence en lisant.
2. Pour chacune, écris un extrait de 3 à 5 phrases courtes, 80 mots au plus (une accroche, le cœur, une fin), qui raconte CE moment selon cette option, en respectant les choix déjà faits. L'auteur doit pouvoir le lire d'un coup d'œil.

Règles :
- Les trois extraits racontent le même moment : seule la manière change.
- N'invente aucun fait au-delà de la matière fournie ; s'il manque une précision, écris [à compléter].
- Pas de tournures creuses : pas de « Découvrez », de question rhétorique d'ouverture, de « ce n'est pas X, c'est Y », de superlatif sans preuve.
- Si l'auteur a laissé une remarque, tiens-en compte.
- Écris en français, à la première personne de l'auteur.
```

Message :

```text
Sujet : ${name} — ${description}
Série : ${label} — ${description} (${mode}, rôle : ${rôle})
Lecteurs : ${label} : ${who} ; …
Dimension à choisir : ${posture | voix | récit}
Catalogue :
- ${id} — ${nom} : ${règle}
Choix déjà faits :
- Posture : ${nom} — ${règle}
- Voix : ${nom} — ${règle}
Remarque de l'auteur : ${remarque}
Moment raconté : ${titre}
Matière :
[${titre du document}]
${texte, 4 000 caractères au plus par document}
```

### A.3 Proposer une signature (`proposeSignature`)

```text
Propose une signature pour cette série : un élément court qui revient à chaque épisode et la rend reconnaissable (une ouverture fixe, une formule de fin, un titre-rubrique, un compteur d'épisode). Elle découle de la posture, de la voix et du récit choisis, et ne doit pas sonner comme un slogan. Une seule proposition, avec sa place et la raison en une phrase.
```

Outil : `text` (la signature, avec `{n}` pour un numéro d'épisode si besoin), `placement` (ouverture, fin ou titre), `why`.

### A.4 Bloc `<cadrage>` du message de génération

```text
<cadrage>
Manière choisie par l'auteur pour cette série. Elle s'applique à chaque épisode et prime sur l'angle.
- Posture : ${nom} — ${règle}
- Voix : ${nom} — ${règle}          ← seulement si la série a sa propre voix
- Récit : ${nom} — ${règle}
- Signature (${placement}) : ${texte}
Extraits qu'il a choisis, comme exemples de MANIÈRE (n'en reprends ni les faits ni les formules) :
« ${extrait} »
Extraits qu'il a écartés (à ne pas imiter) :
« ${extrait} »
</cadrage>
```

Ajout au bloc `<style>` quand l'auteur a choisi sa voix :

```text
Voix choisie par l'auteur : ${nom} — ${règle} Exemple qu'il a préféré : « ${extrait} »
```
