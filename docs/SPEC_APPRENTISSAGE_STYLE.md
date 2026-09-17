# SPEC — APPRENTISSAGE DU STYLE À PARTIR DES CORRECTIONS

> **Statut : cadrage, à valider avant tout code.** Prolonge `docs/SPEC_MATIERE_EDITEUR.md` §4.7 (« sous-produit stratégique — la donnée de voix »), qui avait tranché de **stocker** le gisement premier jet / version finale sans l'exploiter. Ce document cadre l'exploitation. Point 9 de `docs/PRODUCT.md` §6.
>
> **Objectif.** Le produit connaît le style de l'utilisateur par un seul canal : l'analyse des légendes de ses vidéos d'inspiration (`analyzeStyle`, `src/lib/llm/styleProfile.ts`), résumée en une phrase injectée dans le prompt de génération. Il ignore le signal le plus riche qu'il possède : chaque écart entre ce que la machine a écrit (`scripts.firstDraftSnapshot`) et ce que l'utilisateur a finalement gardé, plus les scripts que l'utilisateur a écrits lui-même (`origin = "imported" | "manual"`). Ce chantier transforme ces écarts en **règles de style apprises**, proposées à l'utilisateur, et appliquées partout où la machine écrit à sa place.
>
> **Ce qui rend ce chantier rentable maintenant :** la donnée est déjà en base (colonne `firstDraftSnapshot` capturée à chaque génération depuis le chantier éditeur), le mécanisme de proposition à valider existe (`assistantProposals`), et l'écran de style existe (`StyleAnalysisPanel`). Il reste à relier les trois.

---

## 1. La question produit : c'est quoi « le style » ?

Deux choses distinctes, que le produit confond aujourd'hui dans un seul champ `summary` :

| | Ce que c'est | D'où ça vient | Ce que ça devient |
| :--- | :--- | :--- | :--- |
| **La voix** | Comment l'utilisateur écrit quand il écrit lui-même : ton, rythme, registre, tics. | Scripts importés ou nés dans l'éditeur, légendes d'inspiration (source existante, plus faible : ce sont des posts qu'il *aime*, pas les siens). | Le `summary` existant, recalculé sur de meilleures sources. |
| **Les corrections** | Ce que l'utilisateur **défait systématiquement** dans ce que la machine produit : il enlève les emojis, raccourcit le hook, supprime les questions rhétoriques, remplace « découvrez » par « regardez ». | Diff premier jet / version finale, script par script. | Des **règles impératives** que le rédacteur doit respecter. C'est le levier nouveau. |

Une règle vaut plus qu'un résumé : « Style observé : direct, phrases courtes » laisse le modèle libre ; « Jamais d'emoji. Le hook tient en une phrase. Pas de question en ouverture. » ne le laisse pas.

---

## 2. Décisions tranchées (récapitulatif)

| Sujet | Décision |
| :--- | :--- |
| Sources d'apprentissage | Trois, par ordre de poids : **(a) corrections** = scripts `origin="generated"` avec `firstDraftSnapshot` non null, finalisés (`status ∈ {shot, published}`), dont au moins un bloc diffère du snapshot ; **(b) échantillons de voix** = scripts `origin ∈ {imported, manual}` finalisés ; **(c) légendes d'inspiration** (source actuelle), conservées en repli. Un script finalisé mais identique à son premier jet n'apprend rien, il est marqué vu et ignoré. |
| Unité apprise | Une **règle** = une phrase impérative courte, optionnellement rattachée à une plateforme. Plafond 12 règles actives. Plus deux listes courtes : `avoid` (mots et tics à bannir) et `prefer` (expressions à privilégier). Le `summary` et les quatre champs descriptifs existants restent. |
| Forme de `styleProfile` | Étendu, rétrocompatible : `{ tone, sentenceLength, emojiUsage, vocabulary, summary, rules: [{ text, platform: string \| null }], avoid: string[], prefer: string[], evidence: { scriptCount, learnedAt } }`. Un profil ancien sans `rules` vaut `rules = []`. Pas de nouvelle colonne pour ça. |
| Ce que voit le LLM | Pas le texte brut de 20 scripts. Par correction : plateforme, type de contenu, et **seulement les blocs modifiés**, en AVANT / APRÈS, tronqués. Plus un **bloc de statistiques calculé en TypeScript** (pas par le modèle) : delta de longueur par bloc, emojis retirés/ajoutés, points d'exclamation, questions en ouverture, nombre de hashtags, présence d'un appel à l'action. Le modèle interprète, il ne compte pas. |
| Taille d'une passe | Au plus **15 corrections + 5 échantillons**, les plus récents d'abord. Une passe = un seul appel `callStructured` (mono-tool, donc compatible avec `LLM_PROVIDER` tel quel). |
| Incrémental | Chaque passe reçoit le profil courant et produit le profil suivant. Consigne : garder une règle existante sauf contradiction par les nouvelles corrections ; n'ajouter une règle que si elle est soutenue par au moins deux corrections ; fusionner les doublons. Le modèle rend aussi un `changeNotes` lisible (« 2 règles ajoutées, 1 retirée : … ») qui sert de texte à la proposition. |
| Déclenchement | **Paresseux, aucun cron** (règle du repo). Trois portes : (1) bouton « Relancer l'analyse » existant dans Paramètres ; (2) **suggestion** quand ≥ 5 scripts finalisés n'ont pas encore été appris — bandeau discret dans Paramètres et dans l'éditeur au passage en `shot`/`published`, jamais bloquant ; (3) l'assistant peut le proposer en conversation (lecture du compteur), le lancement reste un geste utilisateur. |
| Suivi de ce qui a été appris | Colonne `scripts.styleLearnedAt` (timestamp, null = pas encore appris). Un script est marqué à la fin de la passe qui l'a lu, que la proposition soit acceptée ou non (refuser des règles n'est pas une raison de reproposer les mêmes scripts). Relancer manuellement peut rejouer les 15 derniers scripts finalisés même déjà appris, pour reconstruire un profil. |
| Validation par l'utilisateur | Le résultat n'écrase jamais le profil : il devient une proposition `assistantProposals` de kind **`style_profile_update`** (payload = profil complet proposé + `changeNotes`), visible dans le panneau de propositions existant **et** dans le panneau de style de Paramètres. Accepter applique ; refuser garde l'ancien. Cohérent avec « tout passe par la validation client » (`SPEC_ASSISTANT_AGENTIQUE.md`). |
| Édition manuelle | Les règles sont **éditables à la main** dans Paramètres (ajouter, retirer, reformuler une ligne) via `PATCH /api/profile/style`. Une règle écrite par l'utilisateur est une règle comme une autre pour l'injection. |
| Injection : où la machine écrit à la place de l'utilisateur | **Partout, y compris là où ça manque aujourd'hui.** Constat vérifié dans le code : `styleProfile.summary` n'est injecté que dans `buildScriptUserMessage` (génération complète). Ni `microEdit.ts` (sélection → instruction, régénération de bloc) ni les autres portes ne le reçoivent. Ce chantier ajoute un bloc `=== STYLE ===` commun à : génération complète (créneau, libre, série depuis la matière), « autre idée, même brief », régénération de bloc, sélection → instruction. **Pas** dans le chat d'assistant, le chef narratif ni l'onboarding : ils ne rédigent pas de post. |
| Filtrage par plateforme | À l'injection, on passe les règles globales plus celles de la plateforme cible. Une règle avec `platform` non null n'est jamais injectée sur une autre plateforme. |
| Quota & limites | Pas comptée dans le quota scripts ni micro-retouches (entretien du profil, pas production). Rate limit existant `style-analysis` (5/min) conservé. |
| Provider | `callStructured` via `LLM_PROVIDER`, comme `analyzeStyle` aujourd'hui. Pas de boucle agentique nécessaire. |

---

## 3. Modèle mental cible

```
Scripts finalisés
  ├── generated + firstDraftSnapshot ≠ contenu final  → CORRECTION  (poids fort)
  ├── imported / manual                               → ÉCHANTILLON (poids moyen)
  └── légendes d'inspiration                          → ÉCHANTILLON (poids faible, repli)
            │
            ▼  passe d'apprentissage (1 appel LLM, ≤ 20 entrées + stats calculées)
            │
     proposition `style_profile_update`  ──accepter──▶  creatorProfiles.styleProfile
            │                                                   │
         refuser (profil inchangé)                              ▼
                                            bloc === STYLE === injecté dans chaque
                                            prompt qui rédige : génération, autre idée,
                                            bloc, sélection→instruction
```

---

## 4. Modèle de données

Deux changements, aucune table :

- `scripts.styleLearnedAt timestamp NULL` — index partiel utile `(user_id) WHERE style_learned_at IS NULL AND status IN ('shot','published')` pour le compteur.
- Enum `assistant_proposal_kind` : valeur `style_profile_update` ajoutée. `targetId` toujours null (une seule cible, même logique que `profile_update`).

`creatorProfiles.styleProfile` (jsonb) change de forme sans migration : lecture tolérante via un schéma zod avec `rules/avoid/prefer/evidence` en `.default(...)`.

Le compteur « scripts à apprendre » est une requête, pas une colonne.

---

## 5. Logique serveur

### 5.1 Sélection & préparation (`src/lib/services/styleLearningService.ts`, logique pure dans `src/lib/llm/styleLearning.ts`)

1. `selectLearningCorpus(userId, { includeLearned })` : corrections et échantillons selon §2, triés par `updatedAt DESC`, plafonds 15 / 5.
2. `diffScript(firstDraftSnapshot, script)` — **fonction pure, testée** : pour chaque bloc textuel (`title`, `hookText`, `hookVisual`, `hookAudio`, `caption`, `hashtags`, `storyboard[].description`, `soundRecommendation`), renvoie `{ field, before, after }` si différent, chaque côté tronqué à 1 200 caractères (début + fin). Un script sans aucun diff est écarté.
3. `computeEditStats(diffs)` — **fonction pure, testée** : les compteurs listés en §2. Agrégés sur la passe (ex. « emojis retirés dans 9 corrections sur 11 »).
4. Construction du message utilisateur (Annexe A.2).

### 5.2 Appel & proposition

5. `learnStyle(currentProfile, corpus, stats)` → `callStructured` avec le tool `learn_style` (Annexe A.1). Validation zod : ≤ 12 règles, chaque règle ≤ 140 caractères, `avoid`/`prefer` ≤ 15 entrées.
6. Insertion d'une ligne `assistantProposals` (`style_profile_update`, payload `{ styleProfile, changeNotes }`). Si une proposition de ce kind est déjà `pending`, elle est remplacée (une seule proposition de style en attente à la fois).
7. `UPDATE scripts SET style_learned_at = now()` pour les scripts lus.
8. `resolveProposal` (`assistantService.ts`) : cas `style_profile_update` → écrit `styleProfile` + `styleProfileUpdatedAt`.

### 5.3 Endpoints

| Route | Rôle |
| :--- | :--- |
| `POST /api/profile/style-analysis` | **Réutilisée.** Devient la passe complète (corrections + échantillons + légendes). Renvoie la proposition créée, plus le profil courant. 400 si aucune source. Rate limit inchangé. |
| `GET /api/profile/style-learning-status` | `{ pendingScripts: number, lastLearnedAt, pendingProposalId }` — alimente les bandeaux. Peut être fusionné dans `GET /api/profile` (principe « une route par vue », `TECH.md` §2). |
| `PATCH /api/profile/style` | Édition manuelle de `rules`, `avoid`, `prefer`. Validation zod identique. |

### 5.4 Injection (`src/lib/llm/prompts.ts` + `microEdit.ts`)

Une fonction unique `buildStyleBlock(styleProfile, platform)` renvoie :

```
=== STYLE ===
Voix : ${summary}
Règles à respecter (apprises des corrections de l'auteur, non négociables) :
- ${rule}          ← une ligne par règle globale ou de la plateforme cible
À bannir : ${avoid.join(", ")}
À privilégier : ${prefer.join(", ")}
```

Chaîne vide si le profil est absent ou si tout est vide. Insérée dans `buildScriptUserMessage` **à la place** de la ligne « Style de communication observé » actuelle, et ajoutée aux messages de `rewriteSelection` et `regenerateBlock` (`microEdit.ts`), qui reçoivent donc `styleProfile` et `platform` en paramètres — `microEditService.ts` les charge depuis le profil comme `buildGenerationContext` le fait déjà.

---

## 6. UI

### 6.1 Paramètres (`StyleAnalysisPanel.tsx`)

- Conserve l'affichage des quatre descripteurs et du `summary`.
- Ajoute la liste des **règles** (une ligne chacune, badge plateforme si présente), éditable : supprimer, modifier, ajouter. Listes `avoid` / `prefer` en chips éditables.
- Ligne d'état : « Appris sur N scripts · dernière analyse le … · **K scripts corrigés depuis** ». Le bouton existant « Relancer l'analyse » lance la passe.
- Si une proposition `style_profile_update` est en attente : encart « Nouvelle analyse disponible » avec `changeNotes`, Accepter / Refuser (même composant que le panneau de propositions).
- Le texte de repli « connectez un compte puis relancez » disparaît : la source principale est désormais l'usage de l'éditeur.

### 6.2 Éditeur de script (`scripts/[id]/page.tsx`)

Au passage en `shot` ou `published`, si `pendingScripts ≥ 5` : bandeau discret en haut de page, fermable, « Tu as corrigé 5 scripts depuis la dernière analyse de style — l'analyser ? » → lance la passe et renvoie vers Paramètres. Jamais de modale.

### 6.3 Panneau de propositions (`AssistantProposalsPanel.tsx`)

Nouveau libellé `style_profile_update: "Style d'écriture"`. Corps : `changeNotes`, puis les règles proposées avec un marquage ajoutée / retirée / inchangée par rapport au profil courant (calcul côté client, comparaison de texte).

### 6.4 Assistant (`assistantReadTools.ts`)

L'outil de lecture du profil expose `styleProfile.rules` et `pendingScripts`, pour que l'assistant puisse dire « tu as 7 scripts corrigés non analysés, veux-tu lancer l'analyse ? ». Il ne la lance pas lui-même.

---

## 7. Ce qui ne change pas

- `firstDraftSnapshot` reste capturé une seule fois à la génération, jamais réécrit (`createScriptRecord`).
- `inspirationVideos` et leur récupération à la connexion d'un compte : inchangés, la source rétrograde seulement en repli.
- Le contrat des trois tools de génération (`scriptSchema.ts`) : inchangé. Le style entre par le message, pas par le schéma.
- Le gel du `concept` et le brief verrouillé de l'éditeur.

---

## 8. Risques & garde-fous

| Risque | Garde-fou |
| :--- | :--- |
| Le modèle invente des règles à partir d'une seule correction (bruit). | Consigne « au moins deux corrections », plafond 12, stats agrégées fournies pour qu'il voie ce qui est *systématique*. Validation humaine avant application. |
| Une règle contredit une consigne de plateforme (ex. « jamais de hashtag » sur Instagram). | Les règles sont présentées comme préférences de l'auteur ; le system prompt de génération garde la primauté sur le format de la plateforme. À observer en usage réel, pas de mécanisme de plus en V1. |
| Un script corrigé pour une raison factuelle (pas stylistique) pollue l'apprentissage. | Consigne au modèle d'ignorer les corrections de fond (chiffres, faits) et de ne retenir que la forme. Les `usedExcerpts` ne sont pas dans le diff. |
| Prompts de micro-retouche plus longs → coût. | Bloc STYLE ≤ ~120 tokens en pratique (12 règles courtes). Négligeable. |
| Profil ancien sans `rules`. | Lecture tolérante par zod, aucune migration de données. |

---

## 9. Plan d'implémentation par lots

### Lot 0 — Logique pure (aucune base, aucun appel LLM)
- `diffScript`, `computeEditStats`, `buildStyleBlock`, schéma zod du profil étendu, sélection du corpus factorisée pour être testable sur des fixtures.
- Tests Vitest : diff sur les trois types de contenu, troncature, stats (emojis, exclamation, question en ouverture), filtrage par plateforme du bloc STYLE, tolérance à l'ancien format de profil.

### Lot 1 — Passe d'apprentissage
- Migration : `scripts.styleLearnedAt`, valeur d'enum `style_profile_update`.
- Tool `learn_style` + prompts (Annexe A), `styleLearningService.ts`, réécriture de `POST /api/profile/style-analysis`, cas `style_profile_update` dans `resolveProposal`, `GET` du statut, `PATCH /api/profile/style`.
- Test mocké : la passe produit une proposition et marque les scripts.

### Lot 2 — Injection partout
- `buildStyleBlock` dans `buildScriptUserMessage`, `rewriteSelection`, `regenerateBlock`. Vérifier que « autre idée » et « série depuis la matière » passent bien par `buildGenerationContext` (donc héritent).
- Tests existants de `generateScript.test.ts` mis à jour sur le bloc STYLE.

### Lot 3 — UI
- `StyleAnalysisPanel` (règles éditables, état, proposition), bandeau éditeur, libellé et rendu dans `AssistantProposalsPanel`, outil de lecture assistant.

### Lot 4 — Documentation
- `TECH.md` (§3 modèle, §4 endpoints, §5 prompts), `PRODUCT.md` (§3, §4 ligne Corpus & Éditeur, §6 point 9), `SPEC_MATIERE_EDITEUR.md` §4.7 renvoie ici.

### Validation de fin de chantier (usage réel)
Générer 5 scripts sur un même profil ; sur chacun, retirer tous les emojis, ramener le hook à une phrase, supprimer la question d'ouverture ; les passer en `published`. Lancer l'analyse : la proposition doit contenir au moins « pas d'emoji » et « hook en une phrase ». Accepter. Générer un 6e script et une régénération de bloc : les deux respectent les règles sans consigne manuelle.

---

## 10. Décisions ouvertes

1. **Seuil de suggestion** : 5 scripts. À ajuster après usage (3 si les corrections sont denses, 10 si l'utilisateur produit beaucoup).
2. **Pondération temporelle** : faut-il faire expirer une règle non confirmée depuis N passes ? V1 : non, l'édition manuelle suffit.
3. **Règles par série** : une série « Coulisses » peut vouloir plus de légèreté qu'une série « Expertise ». Hors V1 ; la plateforme est le seul axe.

## 11. Hors périmètre

- Proposition de **2-3 voix** au premier jet (`SPEC_MATIERE_EDITEUR.md` §4.7, seconde partie) : reste actée dans son principe, non couverte ici.
- Apprentissage à partir des **performances** (quel style marche) : c'est le rééquilibrage par métriques, chantier distinct.
- Suivi de modifications accepter/rejeter dans l'éditeur : toujours reporté (§4.4 de la spec éditeur).

---

## Annexe A — Prompts

### A.1 Tool `learn_style`

```
name: learn_style
description: Met à jour le profil de style d'un auteur à partir de ses corrections sur des textes générés et de textes qu'il a écrits lui-même.
properties:
  tone, sentenceLength, emojiUsage, vocabulary, summary : string   (mêmes descriptions qu'aujourd'hui)
  rules: array of { text: string, platform: string | null }
    description: "Règles impératives, courtes, vérifiables, tirées de ce que l'auteur corrige SYSTÉMATIQUEMENT (au moins deux corrections concordantes). Garder les règles existantes sauf contradiction. Fusionner les doublons. 12 maximum. platform non null seulement si la règle ne vaut que pour une plateforme."
  avoid: array of string   — "Mots, expressions ou tics que l'auteur retire ou n'emploie jamais."
  prefer: array of string  — "Expressions ou tournures que l'auteur ajoute ou emploie de lui-même."
  changeNotes: string      — "2 à 4 phrases pour l'auteur : ce qui change par rapport au profil précédent et pourquoi (quelles corrections l'ont motivé)."
required: tous
```

### A.2 System prompt

```
Tu es le rédacteur en chef d'un auteur. Tu reçois son profil de style actuel, puis des textes générés par une machine accompagnés de la version que l'auteur a finalement gardée (AVANT / APRÈS), des textes qu'il a écrits lui-même, et des statistiques calculées sur ces écarts.
Ta tâche : mettre à jour son profil de style pour que les prochaines générations demandent moins de corrections.
Règles :
- Ne retiens que la FORME (ton, longueur, structure, vocabulaire, ponctuation, emojis, hashtags, appels à l'action). Ignore les corrections de fond (chiffres, faits, détails produit).
- Une règle n'existe que si au moins deux corrections la soutiennent, ou si une statistique la montre comme systématique.
- Une règle est une phrase impérative, concrète, vérifiable à la lecture (« Le hook tient en une phrase », pas « Être percutant »).
- Conserve les règles existantes sauf si les nouvelles corrections les contredisent. Fusionne les doublons. Jamais plus de 12.
- Si une règle ne vaut visiblement que pour une plateforme, renseigne platform ; sinon null.
- Les textes écrits par l'auteur lui-même sont la référence de sa voix : ils nourrissent summary, avoid et prefer.
```

### A.3 Message utilisateur (structure)

```
=== PROFIL ACTUEL ===
${JSON du profil courant, ou "aucun"}

=== STATISTIQUES SUR ${n} CORRECTIONS ===
Emojis : retirés dans 9/11, ajoutés dans 0/11
Longueur du hook : raccourci dans 8/11 (médiane −42 %)
Question en ouverture : supprimée dans 6/11
Hashtags : moyenne 12 → 5
Appel à l'action : conservé 10/11
…

=== CORRECTIONS ===
--- Script 1 · instagram · visual ---
[caption] AVANT : … / APRÈS : …
[hookVisual] AVANT : … / APRÈS : …
--- Script 2 · linkedin · text ---
…

=== TEXTES ÉCRITS PAR L'AUTEUR ===
--- linkedin · text ---
…
```
