# 04 — L'IA et la génération (le cœur du produit)

C'est la partie qui compte le plus et qui a été le plus retravaillée. Après des dizaines d'essais jugés « jamais bons », la génération par **événements** a été jugée « bien mieux » (2026-10-17). Ne pas la défaire sans relire `08-decisions.md`.

## Le principe

> Une chaîne qui transmet des documents et des titres n'en sort pas ce qui s'est passé. On lit **toute** la matière pour en extraire des **événements datés**, on choisit **un lecteur** par série, et le rédacteur reçoit **un événement, un lecteur, une forme** — avec le droit de relire la source et de recommencer.

## Le pipeline de bout en bout

```
 Source (repo GitHub, Notion, Linear, notes collées)
        │ ingestion (aucun appel LLM)
        ▼
 source_materials ── un document = un .md, + un « journal de commits »
        │
        ▼  LECTEUR D'ÉVÉNEMENTS (agent, lit tout en entier)           src/lib/llm/eventReader.ts
 material_events ── la LIGNE DE TEMPS du sujet : date, titre, ce qui s'est passé,
        │            ce que ça a changé, genre, publics, document + extrait qui le prouve
        │
        ├─► PORTRAIT DES LECTEURS du sujet (1 à 3 publics)            readerPortrait.ts
        │      puis QUALIFICATION des événements par public            (qualifyEventsForSubject)
        ▼
 content_series ── un LECTEUR (parmi le portrait) + une FORME écrite pour lui   seriesForm.ts
        │            + un RYTHME (jours) ── le calendrier se remplit sur 28 jours  seriesSlotSync.ts
        ▼
 Un créneau = le PROCHAIN événement de la ligne de temps, filtrée sur le lecteur,
        │       dans l'ordre, en sautant ce qui a déjà été raconté
        ▼  RÉDACTEUR AGENTIQUE (jusqu'à 3 tours)                      eventWriter.ts
        │    reçoit : l'événement + ses voisins (2 avant, 1 après), le lecteur, la forme,
        │             les règles de style apprises, les 5 derniers posts, les règles du réseau
        │    outils : read_source · read_timeline · submit_post
        │    méthode : relire la source → brouillon → le juger comme le lecteur → recommencer → soumettre
        ▼
 CONTRÔLES DU CODE (scriptChecks.ts) dans l'outil de soumission                     un post refusé repart
        │    tournures interdites, longueurs par réseau, citations retrouvées          au modèle avec ses fautes
        │    dans la matière, trous, accroche déjà utilisée, langue
        ▼
 scripts (LinkedIn) puis scripts (X) — même événement, même créneau   postPairService.ts
        │   événement marqué « raconté » · brouillons et rejets gardés dans generationTrace
        ▼
 (option) maquette HTML du visuel · animation HTML libre
```

## Les briques une par une

### Lecteur d'événements — `eventReader.ts`, `materialEventService.ts`
Agent à trois outils (`list_documents`, `read_document`, `save_event`). Il lit **tout**, par tranches de 12 000 caractères pour les gros documents. Quand la matière a un journal daté, chaque entrée est un événement. Se relance à l'ingestion et sur le bouton « Relire la matière ». Un événement : `date` + précision, `title` (un moment, pas un thème), `whatHappened`, `whatChanged`, `kind` (échec · décision · résultat · retour d'utilisateur · étape), `audiences`, `sourceMaterialId` + `excerpt`, `toldByScriptIds`. Un événement raconté n'est pas verrouillé : il peut resservir sous un autre angle, mais le rédacteur le sait.

### Portrait des lecteurs — `readerPortrait.ts`
1 à 3 publics par sujet, avec « s'arrête pour » et « fuit ». Réfléchi **avec la matière sous les yeux**, pas seulement avec la phrase « Pour qui ». Lit aussi `products.problem`. Visible et corrigeable.

### Forme de série — `seriesForm.ts`
Écrite en un appel au moment où l'auteur choisit un lecteur : ce qu'il vient chercher, de quoi est fait un bon épisode, ce qui le fait partir, ses mots, longueur et registre. **Décrit des ingrédients, jamais un ordre** (sinon chaque post reprend le même squelette). Signature facultative. Éditable.

### Rédacteur — `eventWriter.ts` (`callAgentic` dans `provider.ts`)
- Le post **s'arrête avant l'événement suivant** (les voisins servent à situer, pas à raconter).
- Première personne du **singulier** sauf équipe déclarée.
- Il varie ouverture et fin d'un post à l'autre et ne reprend pas les chiffres des épisodes voisins.
- Coût accepté : 3 à 6 appels par post.
- Les exemples des prompts sont **fictifs et sans rapport avec un domaine** (un testeur, un joueur, un pair) pour ne pas orienter les générations.

### Contrôles du code — `scriptChecks.ts`, `platformRules.ts`
Ce qui se mesure est vérifié par le code, pas par le modèle. Un post fautif est **renvoyé au modèle** avec la liste de ses fautes.

### Posts libres (sans série) — prompt V3
`generateScript.ts` + `prompts.ts` : le modèle remplit des étapes de réflexion (lecteur visé, moments candidats, accroches, choix motivé), écrit, se relit ; le code contrôle et fait réécrire une fois. **N'est plus utilisé que pour les posts libres.** Les posts libres ne sont plus générés automatiquement : un post ponctuel se place à la main.

## Ce qui entoure la génération

| Mécanisme | Où | Rôle |
| :--- | :--- | :--- |
| **Anti-répétition** | `angleService.ts`, `recentPosts.ts` | Rotation LRU des angles ; les 5 derniers posts relus pour ne pas répéter accroche ni fin |
| **Apprentissage du style** | `styleLearning.ts`, `styleLearningService.ts` | Compare premier jet (`firstDraftSnapshot`) et version finale ; propose des règles de style, injectées partout (génération, micro-retouche) |
| **Micro-retouches** | `microEdit.ts`, `microEditService.ts` | Instruction libre sur une sélection ou un bloc ; le « concept » du post est gelé et jamais réécrit |
| **« Autre idée, même brief »** | route `new-idea` | Régénère en entier avec brief verrouillé ; l'idée écartée est mémorisée (`rejectedConcepts`) |
| **Veille d'inspiration** | `inspirationResearch.ts` (recherche web OpenAI) | Fiches par sujet, réinjectées dans les prompts des posts libres ; le rédacteur déclare lesquelles servent |
| **Langue** | `src/lib/language.ts` | Profil sinon langue des notes, règle absolue, revérifiée |
| **Citations** | `citationMatching.ts`, `citationService.ts` | Retrouve (approximativement) les passages cités dans la matière |

## Visuels

- **Maquette HTML** (`designPrompts.ts`, `visualDesignService.ts`, `src/lib/visualDesign/`) : un slide HTML par entrée du storyboard, thème commun, rendu en PNG **dans le navigateur** (`html-to-image`). Photos de la bibliothèque choisies par recherche sémantique (embeddings pgvector, `assetSelection.ts`). Détourage Photoroom optionnel derrière un adaptateur. Un HTML passe par `htmlSanitizer`.
- **Animation** (`animationHtml.ts`, `src/lib/animationHtml/`) : le modèle écrit une page HTML animée sous un **contrat de temps** `window.seek(ms)` (pure, pas de minuteur, pas de hasard) parce que l'export MP4 se fait image par image. Contrôle en trois couches : lecture du code (`verify.ts`), iframe `sandbox="allow-scripts"` + CSP `default-src 'none'`, essai de rendu + revue du modèle sur ses propres images (vision OpenAI). Les **chiffres affichés viennent du post** (`numbers.ts`).
- Les deux comptent comme une **micro-retouche** (`design_instruction`), jamais comme une semaine.

## Fournisseurs de modèles — la réalité

| Usage | Fournisseur réel |
| :--- | :--- |
| Toute génération de texte, assistant, agents, embeddings, recherche web, vision des animations | **OpenAI** (`OPENAI_API_KEY`) — `callAgentic` n'est écrit que pour cet adaptateur |
| Légendes vision des photos (captioning) | **Gemini** (`GEMINI_API_KEY`), indépendamment de `LLM_PROVIDER` |
| Détourage | Photoroom, optionnel |

`LLM_PROVIDER=openai` à renseigner **explicitement** : le repli codé en dur est `gemini`, non opérationnel.

## Où sont les prompts

`docs/PROMPTS.md` (94 Ko) en est l'inventaire complet (où, pourquoi, quand, texte). Le code fait foi : `src/lib/llm/`.

## Ce qu'on a appris (à relire avant de retoucher les prompts)

1. La matière compte mais n'arrivait pas : un seul post sur quatre utilisait un événement avant le lecteur d'événements.
2. Un « chef » qui reçoit une phrase par document ne lit pas ; il faut **lire en entier**.
3. Les champs de « réflexion » remplis avant le post dans le même appel sont **un formulaire, pas une réflexion** ; des tours d'agent réels valent mieux.
4. Une forme de série écrite en recette numérotée est appliquée telle quelle à chaque post → un seul squelette.
5. Des exemples de prompt liés à un domaine orientent toutes les générations vers ce domaine.
6. Les essais complets sont dans `docs/tests/` (`mykine-pack/`, `2026-10-17/`, `animation-html/`) — pack de test MyKiné, compte `mykine.test@example.com` en base de dev.
