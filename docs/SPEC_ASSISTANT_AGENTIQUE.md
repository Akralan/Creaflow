# CADRAGE — ASSISTANT ÉDITORIAL AGENTIQUE

> **Statut : implémenté (lots 0 à 4), mergé sur `main` (PR #2) et validé en conditions réelles.** Migrations `0024` (nouveaux kinds de proposition) et `0025` (`assistant_attachments`) appliquées. Ce document reste le cadrage de référence ; `PRODUCT.md` et `TECH.md` reflètent le code livré.
>
> Écarts assumés par rapport au cadrage initial :
> - **§3.2** — les outils d'écriture ne sont pas un par domaine : `propose_changes` (l'outil historique, sans la réponse conversationnelle) couvre sujets, séries, rôles, angles, cadence et audience ; s'y ajoutent `propose_material` et `propose_archive`. Trois outils plutôt qu'une quinzaine, pour ne pas noyer le modèle.
> - **§5.2** — l'extraction conversationnelle a été livrée avec le lot 3 plutôt qu'au lot 4 : c'est le même outil `propose_material`, avec du texte au lieu d'un `attachmentId`.
> - **§6** — un bug non prévu a été corrigé au passage : accepter n'importe quelle proposition de rôle (ou un rééquilibrage) remettait le `materialHungry` de **tous** les rôles à `false`, `saveCategoriesForUser` réécrivant la liste entière à partir d'items qui ne portaient pas le champ.
>
> Objet : donner à l'assistant éditorial (`/assistant`) des **outils de lecture sur toute l'application** et des **outils d'écriture sur tout sauf les scripts et le calendrier**, toute écriture continuant de passer par l'UI de validation existante. Suppose une primitive LLM qui n'existe pas encore dans le repo (§2).

---

## 1. Pourquoi ce chantier

### 1.1 Le constat — un configurateur aveugle

L'assistant actuel (`src/lib/llm/assistantChat.ts`, `src/lib/services/assistantService.ts`) est un **configurateur de la direction éditoriale**. Il voit l'ossature et il est aveugle à tout ce qui la remplit.

Ce qui lui est injecté aujourd'hui (`assistantChat.ts:276-324`), et les trous **à l'intérieur même** de ce qu'il voit :

| Injecté | Détail transmis | Trou |
| :--- | :--- | :--- |
| Produits | id, nom, description | `valueProposition` et `targetAudience` non transmis — alors qu'il peut proposer un update de `valueProposition`, donc à l'aveugle |
| Séries | id, label, poids, description, rôle, plateformes | `mode` (rendez-vous / feuilleton) et `productId` absents — les deux champs issus de `SPEC_REDACTEUR_EN_CHEF.md` |
| Rôles | id, label, poids, plateformes | `description` non injectée (c'est pourtant la consigne éditoriale du rôle), `materialHungry` absent |
| Angles | id, label, description | — |
| Objectifs de fréquence | plateforme, cible/semaine | — |
| Audience de marque | `creatorProfiles.targetAudience` | — |

Ce qui ne lui est **pas** transmis du tout :

- **La matière** — `sourceMaterials` (y compris les `summary` déjà générés) et `sourceMaterialCitations`. Le réacteur du produit (`SPEC_MATIERE_EDITEUR.md` §3.1) est invisible pour l'assistant éditorial.
- **Les scripts** — aucun. Ni les `concept` générés, ni les publiés, ni les brouillons, ni `rejectedConcepts`.
- **Le calendrier** — `calendarEntries` : ni ce qui est planifié, ni les trous, ni la densité réelle comparée aux objectifs de fréquence qu'il propose lui-même de modifier.
- **Les performances** — `postMetrics`, `postMetricsSnapshots`. Le rééquilibrage des rôles existe (`categoryReweightService.ts`), mais il est calculé hors chat : l'assistant conversationnel n'a jamais le chiffre sous les yeux et ne peut pas en discuter.
- **L'état narratif** — `narrativeState` : arc, beats, promesses ouvertes, callbacks. Le rédacteur en chef et l'assistant s'ignorent complètement.
- **Le reste du profil** — `brandName`, `activityType`, `tone`, `values`, `equipment`, `weeklyTimeAvailable`, `styleProfile`. Il connaît l'audience, pas la marque ni le ton.
- **Les autres chats** — onboarding et interview matière ont leurs propres sessions ; l'assistant ne sait rien de ce qui s'y est dit.

Hors périmètre assumé de ce chantier : le quota et l'abonnement (`subscriptions`, `scriptGenerationEvents`) — sans intérêt pour une conversation éditoriale.

### 1.2 Le positionnement — rédacteur en chef assistant

La frontière n'est pas « lecture vs écriture », elle est **éditoriale** :

- **Il pilote la ligne** — sujets, séries, rôles, angles, cadence, matière, audience. C'est son métier.
- **Il n'écrit pas à ta place** — le contenu rédactionnel (`Script`) et le planning (`CalendarEntry`) restent la main de l'utilisateur.

C'est le pendant conversationnel de la règle « verrouiller le brief, libérer les mots » (`SPEC_MATIERE_EDITEUR.md` §1.3) : ici, l'assistant tient le brief, l'utilisateur tient les mots. Il **lit** les scripts et le calendrier — un rédacteur en chef qui ne lirait pas ce qui est publié ni ce qui est planifié n'aurait aucun avis utile — mais il ne les touche jamais.

---

## 2. Le verrou technique — la couche LLM est mono-tool et one-shot

### 2.1 État actuel

Toute la couche `src/lib/llm/` est bâtie sur une seule primitive, `callStructured` (`provider.ts`) : **un** tool, **imposé** (`tool_choice` forcé), **un seul aller-retour**, arguments récupérés, terminé. Il n'existe nulle part de notion de `tool_result`, de message assistant intermédiaire, ni de boucle. Les 4 adaptateurs sont écrits sur ce modèle :

| Provider | Fichier | Mécanique du tour |
| :--- | :--- | :--- |
| Gemini (défaut) | `providers/gemini.ts` | `generateContent` + `functionCallingConfig: ANY` sur un nom autorisé |
| Anthropic | `providers/anthropic.ts` | `messages.create` + `tool_choice: { type: "tool", name }` |
| Groq | `providers/groq.ts` | Chat Completions + `tool_choice: { type: "function", function: { name } }` |
| OpenAI | `providers/openai.ts` | API Responses + `tool_choice: { type: "function", name }`, `reasoning.effort: "low"` |

Le contexte n'est pas non plus une liste de messages : tout est **aplati en une seule chaîne** `userMessage` (transcript de la conversation reconstruit à chaque tour, `assistantChat.ts:272`).

Un assistant qui « va chercher la matière du sujet X, puis décide » exige exactement l'inverse : appeler un tool, recevoir le résultat, réfléchir, rappeler un autre tool.

### 2.2 `callAgentic` — la primitive à construire, **OpenAI uniquement**

Nouvelle primitive à côté de `callStructured`, qui n'est **pas** remplacée (générations de script, micro-retouches, onboarding, interview restent mono-tool — ils n'ont aucun besoin d'une boucle).

**Décision : un seul adaptateur, OpenAI.** La boucle agentique n'est écrite que pour `providers/openai.ts` ; Gemini, Anthropic et Groq ne la reçoivent pas. L'assistant agentique appelle donc l'adaptateur OpenAI **en dur, indépendamment de `LLM_PROVIDER`**, et échoue explicitement si `OPENAI_API_KEY` manque.

Ce n'est pas une entorse : c'est le pattern déjà en place pour les capacités qui n'existent que chez un provider — `embeddings.ts` et `providers/geminiImage.ts` (embeddings, captioning vision, génération d'images) tapent Gemini en dur pour la même raison. `LLM_PROVIDER` pilote la **génération de contenu**, pas toutes les capacités du produit.

Conséquence à assumer côté dev : un environnement sans `OPENAI_API_KEY` fait tourner toute l'app sauf l'assistant. `.env.example` et `CLAUDE.md` doivent le dire.

```
callAgentic({
  system,
  messages,          // vrai historique multi-tours, plus une chaîne aplatie
  tools,             // N tools, tool_choice "auto" et non forcé
  maxTokens,
  maxTurns,          // garde-fou dur
  onToolCall,        // exécution côté serveur, renvoie le tool_result
}): Promise<{ reply, toolCalls }>
```

Points d'attention, tous côté `providers/openai.ts` :

- **`tool_choice` passe de forcé à `auto`** : le modèle doit pouvoir répondre en texte quand il n'a rien à faire. Le filet actuel de `provider.ts` (`TOOL_CALL_RETRY_NOTE`, qui relance en grondant le modèle quand il répond en texte libre) **n'a plus lieu d'être ici** — répondre en texte y est légitime.
- **API Responses** (`/v1/responses`), déjà utilisée par l'adaptateur : le tour suivant se construit en renvoyant l'historique avec les `function_call` et leurs `function_call_output`. C'est le format à respecter, pas celui de Chat Completions.
- **`reasoning.effort`** est aujourd'hui figé à `"low"` (`providers/openai.ts`), calibré pour la génération de script. Une boucle multi-tools demande plus de discernement dans le choix des outils : à rendre paramétrable par appelant et à re-régler pour l'assistant (§9).
- Le mode `strict` (`types.ts`) reste hors sujet : il exige `additionalProperties: false` partout et n'est activé que pour la génération de script.

### 2.3 Garde-fous

Une boucle non bornée sur une clé payante est un risque à part entière :

- **`maxTurns`** dur (ordre de grandeur : 8) — au-delà, on rend la main avec ce qu'on a et un `logger.warn`.
- **Budget de tokens** par tour de conversation, pas seulement par appel.
- **Volume des retours de tools** : un `read_material` sur un journal de bord complet peut peser plus lourd que tout le reste du contexte. Les tools de lecture renvoient des **résumés et des listes par défaut**, le texte intégral seulement sur demande explicite et tronqué au-delà d'un seuil (même logique de garde-fou technique que `SPEC_MATIERE_EDITEUR.md` §3.6).
- Le rate limit existant (`enforceRateLimit("assistant-chat", userId, 20, 60)`) compte les **tours de conversation**, pas les appels LLM : un tour agentique peut désormais en coûter plusieurs. À réévaluer.

---

## 3. Le catalogue d'outils

### 3.1 Lecture — accès direct, sans validation

Aucun effet de bord, aucune proposition : ces tools répondent, point.

| Tool | Renvoie |
| :--- | :--- |
| `list_materials(productId?)` | Documents du sujet (ou de niveau marque) : id, titre, `kind`, date, `summary` |
| `read_material(id)` | Texte intégral d'un document, tronqué au-delà d'un seuil |
| `list_scripts(filters)` | Scripts : id, titre, plateforme, statut, date, rôle, série, `concept` |
| `read_script(id)` | Contenu des blocs d'un script + ses citations de matière |
| `read_calendar(from, to)` | Créneaux de la période : date, plateforme, rôle, série, script associé ou non |
| `read_performance(period)` | Métriques agrégées par script, rôle, plateforme |
| `read_narrative_state(productId ou seriesId)` | Arc, beats, promesses ouvertes, callbacks, contrat de format, `isStale` |
| `read_profile()` | Profil complet : marque, activité, ton, valeurs, dispo hebdo, `styleProfile`, audience |

L'état éditorial de base (produits, séries, rôles, angles, objectifs) reste **pré-injecté** dans le contexte du tour comme aujourd'hui — c'est ce dont il a besoin à chaque message, le faire chercher par un tool serait un aller-retour gratuit. Mais il est complété des champs manquants recensés au §1.1 et §6.

### 3.2 Écriture — via propositions uniquement

Chaque tool d'écriture **n'écrit rien** : il émet une ligne `assistantProposals` (§4). Le nom des tools doit le dire, pour que le modèle ne se croie pas en train d'appliquer : `propose_*`.

| Domaine | Tools |
| :--- | :--- |
| Matière | `propose_material_create`, `propose_material_update`, `propose_material_delete` |
| Sujets | `propose_product_create`, `propose_product_update` (avec `targetAudience`, §6) |
| Séries | `propose_series_create`, `propose_series_update` (avec `mode` et `productId`, §6), `propose_series_archive` |
| Rôles | `propose_category_create`, `propose_category_update` (avec `description` et `materialHungry`), `propose_category_archive` |
| Angles | `propose_angle_create`, `propose_angle_update`, `propose_angle_archive` |
| Cadence | `propose_posting_goal_update` |
| Profil | `propose_profile_update` (audience de marque, ton, valeurs, dispo hebdo) |

### 3.3 La frontière — scripts et calendrier

**Aucun tool d'écriture sur `Script` ni sur `CalendarEntry`.** Ni création, ni modification, ni suppression, ni déclenchement de génération, ni génération de mois. C'est une règle de périmètre produit (§1.2), pas une limitation technique : les endpoints existent tous et sont pilotables, on choisit de ne pas les exposer.

Elle doit être portée **deux fois** : par l'absence de tools (le modèle ne peut pas), et par une règle du prompt système (le modèle ne cherche pas, et sait quoi répondre quand on le lui demande — orienter vers l'écran concerné plutôt que refuser sèchement).

---

## 4. Toute écriture passe par `AssistantProposal`

### 4.1 Ce que ça implique en base et en service

Le mécanisme existe et ne change pas dans son principe (`assistantProposals`, `resolveProposal`, `AssistantProposalsPanel`). Il faut l'étendre :

- **`assistant_proposal_kind`** (enum, `schema.ts:21`) — ajouter `material_create`, `material_update`, `material_delete`, et les kinds d'archivage (`series_archive`, `category_archive`, `angle_archive`).
- **`resolveProposal`** (`assistantService.ts:203`) — une branche par nouveau kind, avec les mêmes garanties qu'aujourd'hui : validation Zod du payload fusionné (`{ ...payload, ...fields }`, l'utilisateur peut éditer avant d'accepter), et les invariants métier (2 à 6 rôles actifs, poids normalisés).
- À l'acceptation d'une proposition de matière, rejouer ce que fait déjà `POST /api/materials/upload` : `createFileMaterial`, `markStaleForMaterialIngestion`, puis `summarizeMaterialDocument` en `after()`.
- L'archivage est aujourd'hui **explicitement interdit** à l'assistant (`assistantChat.ts:242`). Cette règle du prompt disparaît, remplacée par : jamais de destruction directe, l'archivage passe par une proposition comme le reste.

### 4.2 Impact UI

`AssistantProposalsPanel.tsx` (464 lignes) est un `switch` sur `kind` avec un formulaire d'édition par groupe (`KIND_LABEL`, `proposalGroup`, un `*Draft` par type). Chaque nouveau kind demande son libellé, son groupe et son formulaire. Le panneau va grossir : à surveiller, un découpage par groupe en composants séparés deviendra sans doute nécessaire.

Point d'ergonomie à trancher à l'implémentation : les propositions `pending` s'accumulent aujourd'hui sans dédoublonnage ni péremption. Avec un assistant qui en produit davantage, une proposition périmée (la donnée a changé à la main entre-temps) s'appliquera telle quelle à l'acceptation. Voir §9.

---

## 5. La matière depuis le chat — deux portes

Une seule règle : **l'assistant ne crée jamais de matière lui-même, il la propose.** Deux façons pour la matière d'arriver dans la conversation.

### 5.1 Drag & drop de fichier

Le fichier se dépose dans le fil de conversation et s'ajoute **en plus du message**.

- **C'est une pièce jointe, pas du contexte.** L'assistant en voit la référence (nom du fichier), **jamais le contenu**. Le texte ne transite pas par le prompt, quelle que soit sa taille — un journal de bord de plusieurs centaines de Ko ne coûte rien au contexte.
- **Un fichier n'est jamais envoyé seul.** C'est le message qui l'accompagne qui dit quoi en faire (« c'est de la matière pour tel sujet »).
- **Si le rattachement n'est pas clair, l'assistant demande** — et le rangement peut arriver plusieurs tours plus tard. Le fichier reste en attente et référençable par son id dans la conversation.
- Sa proposition porte `{ attachmentId, productId }` ; le `SourceMaterial` naît à l'acceptation.
- **Corollaire assumé** : il ne peut pas juger le fichier avant de le ranger (« je vois que ça parle de X, je le mets là »). Le `summary` n'existe qu'après ingestion. Une fois la matière créée, elle rentre dans son périmètre de lecture (§3.1) et il peut la relire s'il en a besoin.
- Contraintes héritées de `POST /api/materials/upload` : `.md`/`.txt` uniquement, 2 Mo max — anti-scope `SPEC_MATIERE_EDITEUR.md` §3.2. Voir §9 pour le cas des autres formats.

### 5.2 Extraction conversationnelle

Quand l'utilisateur raconte une information exploitable dans le chat — une actualité sur un sujet, une anecdote, un chiffre — l'assistant **propose de l'ajouter en matière**, avec le sujet de rattachement.

C'est le pattern déjà éprouvé de `materialInterviewChat.ts` (`extractedMaterial`, `TECH.md` §5.12), transposé dans l'assistant éditorial : la différence est qu'ici l'extraction est un **sous-produit** d'une conversation qui parle d'autre chose, pas le but de l'échange. Il ne doit donc pas proposer à chaque phrase — même discipline que pour le reste (« la plupart des tours ne proposent rien »).

À terme, cela recouvre largement l'interview-chat dédié. Les deux ne fusionnent pas dans ce chantier — à réévaluer une fois l'assistant en service.

### 5.3 Le champ URL disparaît

Le champ « URLs » actuel (`urlsText` dans `AssistantChat.tsx`, paramètre `urls` de `POST /api/assistant/chat`, jusqu'à 3 pages extraites par `urlFetchService`) est **retiré** — inutile en usage réel. Le drag & drop prend sa place dans l'UI.

`urlFetchService.ts` n'a aucun autre appelant que l'assistant : suppression propre, service compris.

---

## 6. Trous à combler au passage

Indépendants de la boucle agentique, tous dans le périmètre :

1. **`product.targetAudience` non proposable** — le prompt système y renvoie explicitement (« ça, c'est product_update », `assistantChat.ts:207` et `:249`) mais `productProposalSchema` ne porte pas le champ (`assistantChat.ts:12`). L'assistant est dirigé vers une action qu'il n'a pas les moyens d'émettre. Bug réel, à corriger.
2. **`series.mode` et `series.productId`** — non proposables, non injectés. Deux leviers structurants du rédacteur en chef, invisibles pour l'assistant éditorial.
3. **`category.description`** — non injectée alors qu'elle porte la consigne éditoriale du rôle ; **`category.materialHungry`** — ni injecté ni proposable.
4. **`product.valueProposition`** — proposable en update sans être injectée : écrasement à l'aveugle.
5. **Historique plafonné à 20 messages** (`assistantService.ts:18`) sans résumé ni avertissement : une conversation longue perd son début en silence. Passer à un plafond en tokens et/ou un résumé glissant.
6. **`maxTokens: 1536`** (`assistantChat.ts:337`) pour la réponse + jusqu'à 22 propositions : déjà juste, intenable en mode agentique.

---

## 7. Modèle de données (esquisse)

```
AssistantAttachment (fichier déposé dans la conversation, en attente de rangement)
- id, userId
- filename, rawText (texte extrait à l'upload — .md/.txt)
- createdAt, consumedAt (nullable — posé à l'acceptation de la proposition qui le range)
— l'assistant n'en voit que { id, filename } ; rawText n'entre jamais dans le prompt.
— devient un SourceMaterial à l'acceptation, puis n'a plus d'usage (purge : §9).

AssistantProposal (existant — enum `kind` étendue)
+ material_create / material_update / material_delete
+ series_archive / category_archive / angle_archive
— payload de material_create : { attachmentId?, title, rawText?, productId }
  (attachmentId pour la porte fichier, rawText pour l'extraction conversationnelle)

AssistantSession (existant — messages jsonb)
— un message utilisateur peut désormais porter des attachmentIds.
```

Aucune modification de `Script`, `CalendarEntry`, `SourceMaterial` ni `NarrativeState`.

---

## 8. Ordre d'attaque

| Lot | Contenu | Pourquoi cet ordre |
| :--- | :--- | :--- |
| **0** | Les trous du §6 (champs manquants, `product.targetAudience`, plafond d'historique, `maxTokens`) | Indépendant du reste, corrige des bugs réels, bénéficie à l'assistant actuel tout de suite |
| **1** | `callAgentic` sur l'adaptateur **OpenAI seul** + tests | Le verrou. Rien d'autre ne peut avancer avant |
| **2** | Tools de **lecture** (§3.1) et bascule de l'assistant sur la boucle | Aucun effet de bord, donc testable sans risque : c'est là qu'on voit si le modèle sait chercher au bon endroit |
| **3** | Tools d'**écriture** (§3.2) + extension de l'enum, de `resolveProposal` et du panneau | Vient après la lecture : un assistant qui propose sans savoir lire proposerait à l'aveugle |
| **4** | Matière depuis le chat (§5) : `AssistantAttachment`, drag & drop, extraction conversationnelle, retrait du champ URL | Dépend du lot 3 (les propositions de matière) |

**Validation transverse** : à modèle égal, l'assistant agentique doit au minimum ne pas régresser sur ce que l'assistant actuel fait bien — proposer des séries pertinentes sans sur-proposer. Le risque propre au mode agentique est le bavardage : lire cinq tools avant de répondre « oui, bonne idée ».

---

## 9. Décisions ouvertes

1. **Formats de fichier au drop.** `.md`/`.txt` est l'anti-scope assumé de `SPEC_MATIERE_EDITEUR.md` §3.2 (« pas de parseur PDF, ne pas construire un gestionnaire de documents IA par accident »). Mais dropper un PDF dans un chat est un réflexe autrement plus naturel que d'aller le déposer dans un panneau. À re-trancher maintenant que le dépôt devient un geste de conversation.
2. **Durée de vie d'un attachment non rangé.** Il peut être rangé « plus tard » (§5.1) — mais jusqu'à quand ? Purge à la fin de la session, à N jours, ou jamais ?
3. **Péremption des propositions.** Aujourd'hui aucune : une proposition `pending` s'applique telle quelle même si la donnée cible a changé entre-temps. Avec un volume plus élevé, faut-il invalider, ré-évaluer à l'acceptation, ou laisser tel quel ?
4. ~~**Rate limit et coût.**~~ **Tranché à l'implémentation : 10 tours/minute** (au lieu de 20), le plafond continuant de compter des tours de conversation et non des appels LLM. Reste à observer en usage réel : un tour agentique peut coûter jusqu'à `maxTurns` appels.
5. **Sort de l'interview-chat matière** (`materialInterviewChat.ts`). L'extraction conversationnelle (§5.2) le recouvre en grande partie. Fusion, coexistence, ou dépréciation — à décider à l'usage.
6. **Modèle et effort de raisonnement OpenAI.** `gpt-5-mini` avec `reasoning.effort: "low"` (`providers/openai.ts`) est calibré pour la génération de script, où le tool est imposé et où il n'y a rien à choisir. Une boucle multi-tools demande de décider *quel* outil appeler, et quand s'arrêter de chercher : effort et modèle sont à re-régler sur ce cas précis, et à rendre paramétrables par appelant plutôt que figés dans l'adaptateur. Le symptôme à guetter au lot 2 : le bavardage — lire cinq tools avant de répondre « oui, bonne idée ».

---

## 10. Hors périmètre

- **Écriture sur les scripts et le calendrier** — décision de périmètre produit (§1.2, §3.3), pas une limitation technique.
- **Quota, abonnement, facturation** — sans intérêt pour une conversation éditoriale.
- **Écriture directe sans validation** — écarté explicitement : tout passe par `AssistantProposal`.
- **Porter `callAgentic` sur Gemini, Anthropic et Groq** — OpenAI seul (§2.2). Si un autre provider devient nécessaire un jour, la primitive est déjà là et il ne reste que l'adaptateur à écrire.
- **Basculer les autres appels LLM sur `callAgentic`** — génération de script, micro-retouches, onboarding, interview restent mono-tool, et continuent de suivre `LLM_PROVIDER`. `callStructured` n'est pas remplacée.
- **Connexions sociales et publication** — l'assistant ne publie rien.
