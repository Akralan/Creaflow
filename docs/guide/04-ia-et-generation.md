# 04 — L'IA et la génération (le cœur du produit)

C'est la partie qui compte le plus et qui a été le plus retravaillée. La génération par **événements** a été jugée « bien mieux » le 2026-10-17 ; le 2026-10-24, l'événement a perdu tous ses champs et le rédacteur s'est mis à choisir lui-même. Ne pas défaire sans relire `08-decisions.md`.

## Le principe

> Un événement n'est pas une fiche, c'est une **adresse** : un document, une ligne, une date. Résumer un événement avant de l'écrire, c'était donner au rédacteur un formulaire à traduire. On ne lui donne donc plus que des adresses, et il va lire.
>
> Et il n'y a plus de choisisseur : le rédacteur lit la ligne de temps, les posts déjà publiés, et **choisit lui-même** de quoi parle le prochain post.

## Le pipeline de bout en bout

```
 Source (repo GitHub, Notion, Linear, notes collées)
        │ ingestion (aucun appel LLM)
        ▼
 source_materials ── un document = un .md, + un « journal de commits »
        │
        ▼  EXTRACTEUR DE POINTEURS (prompt 29)              src/lib/llm/pointerExtractor.ts
        │    PAS d'agent : une part de 40 000 caractères = un appel indépendant
        │    sortie : des numéros de ligne et des dates. Rien d'autre.
 material_events ── la LIGNE DE TEMPS du sujet : document + ligne + date
        │            (aucun titre, aucun résumé, aucune conséquence, aucun public)
        ├─► PORTRAIT DES LECTEURS du sujet (1 à 3 publics)   readerPortrait.ts
        ▼
 content_series ── un LECTEUR (parmi le portrait) + un RYTHME (jours)
        │            le calendrier se remplit sur 28 jours        seriesSlotSync.ts
        ▼
 Un créneau = la ligne de temps ENTIÈRE du sujet, en adresses nues,
        │       marquées « déjà servi » quand un post en est parti  buildPointerBrief
        ▼  RÉDACTEUR À POINTEURS (prompt 30, jusqu'à 40 tours)   pointerPostWriter.ts
        │    reçoit : les adresses, les posts publiés (ids et dates), le lecteur,
        │             le contexte du projet, la langue, les règles du réseau
        │    outils : read_file (120 lignes au plus) · read_post · publish_post
        │    méthode : il ouvre ce qu'il veut, choisit ses pointeurs, écrit
        ▼
 CONTRÔLES DU CODE (scriptChecks.ts) — langue, longueurs, tournures          un post refusé
        │                                                                     repart au modèle
        ▼
 scripts (LinkedIn) puis scripts (X) — MÊMES pointeurs, même créneau   postPairService.ts
        │   restrictToLocked réduit la ligne de temps de X aux pointeurs de LinkedIn
        │   scripts.event_ids porte tous les pointeurs du post
        ▼
 (option) maquette HTML du visuel · animation HTML libre
```

## Les briques une par une

### Extracteur de pointeurs — `pointerExtractor.ts`, `materialEventService.ts`
Pas un agent. Le document est numéroté ligne par ligne, coupé en parts de 40 000 caractères sur des lignes entières, et chaque part fait **un appel structuré indépendant** qui rend des `{ line, date }`. Les numéros sont ceux du document complet, jamais ceux de la part. Son prompt n'a **qu'une phrase de définition** — « *An event is a line of this document where something happened* » — isolée dans `EVENT_DEFINITION` : c'est le seul levier si un relevé est mauvais. Se relance à l'ingestion et sur « Relire la matière » ; un document qui échoue reste non lu et n'empêche pas les autres.

**Pourquoi pas un agent.** Celui qu'il remplace tenait tout dans une seule conversation. Sur le dépôt de tellovo (43 documents, 966 688 caractères) il a lu **4 documents sur 43** et s'est arrêté de lui-même au 107e tour en demandant la permission de continuer, dans un travail de fond où personne ne lisait sa question. L'extracteur a vu les 43 documents en 50 appels.

### Portrait des lecteurs — `readerPortrait.ts`
1 à 3 publics par sujet, avec « s'arrête pour » et « fuit ». Réfléchi **avec la matière sous les yeux**, pas seulement avec la phrase « Pour qui ». Lit aussi `products.problem`. Visible et corrigeable. Le lecteur d'une série sort de là, et **c'est lui qui décide du registre** : les sujets dont le lecteur est un pair qui construit donnent du récit, celui dont les publics sont des opérateurs du produit donnait de la documentation d'admin.

### Rédacteur à pointeurs — `pointerPostWriter.ts` (`callAgentic`)
Son prompt a **quatre règles et rien d'autre**, arrêtées après quinze runs du banc :
1. la règle unique — *build in public*, pour ce lecteur ;
2. l'origine, seule exception, au premier post seulement ; sa raison est **celle que l'auteur donne**, jamais une choisie pour coller au lecteur ;
3. la première phrase est une accroche et rien d'autre — un chiffre, une heure, un aveu, un brin de folie ;
4. aucun post mort : il relit les posts précédents pour ne pas réécrire ce qui a été dit, **jamais pour copier leur forme**, et tout élément de machinerie nommé est expliqué dans la même phrase.

Ce qu'il ne reçoit **pas**, et qui n'est pas un oubli : aucun résumé d'événement, aucun type de post, aucune consigne d'alternance, et **pas le style appris** (le run validé ne l'avait pas — à rouvrir après l'essai en réel). Coût : 3 à 7 tours par post en général, 11 `read_post` au douzième post d'une série.

Sans `publish_post`, sa réponse conversationnelle n'est **jamais** enregistrée comme post : l'erreur porte « submitted no post » et `postPairService` réessaie.

### Deux leçons du banc, à ne pas réapprendre
- **Sans règle de forme, le modèle s'en donne une** : 12 posts sur 12 à quatre paragraphes exactement, tous finissant sur une leçon généralisée.
- **Nommer une exigence la fait ressortir comme un bloc.** Une phrase demandant qu'un inconnu puisse entrer dans n'importe quel post — et interdisant explicitement le paragraphe de présentation collé à la fin — a produit **6 pitchs produit sur 12**. La phrase a été rejetée.

### Contrôles du code — `scriptChecks.ts`, `platformRules.ts`
Ce qui se mesure est vérifié par le code, pas par le modèle. Un post fautif est **renvoyé au modèle** avec la liste de ses fautes.

### Posts libres (sans série) — prompt V3
`generateScript.ts` + `prompts.ts` : le modèle remplit des étapes de réflexion (lecteur visé, moments candidats, accroches, choix motivé), écrit, se relit ; le code contrôle et fait réécrire une fois. **N'est plus utilisé que pour les posts libres et les posts visuels** — le rédacteur à pointeurs rend un texte, pas un storyboard. Les posts libres ne sont plus générés automatiquement : un post ponctuel se place à la main.

### Ce qui a été retiré le 2026-10-24
Le **fil narratif** en entier (`src/lib/narrative/`, `narrativeWriter.ts`, `narrativeBriefService.ts`) : origine, vision, point d'étape, promesse tenue. L'origine est devenue la règle 2 du prompt ; les trois autres n'ont pas de remplaçant, ils lisaient des champs qui n'existent plus. Le **filtre par public** (`tellableTo`) part avec eux : une série raconte la ligne de temps de son sujet, entière. La **forme de série** et le **cadrage** étaient déjà partis. Un événement ne se **saisit plus à la main**.


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

`docs/PROMPTS.md` (état du 2026-10-19, tous les prompts en anglais) en est l'inventaire complet (où, pourquoi, quand, texte). Le code fait foi : `src/lib/llm/`.

## Ce qu'on a appris (à relire avant de retoucher les prompts)

1. La matière compte mais n'arrivait pas : un seul post sur quatre utilisait un événement avant le lecteur d'événements.
2. Un « chef » qui reçoit une phrase par document ne lit pas ; il faut **lire en entier**.
3. Les champs de « réflexion » remplis avant le post dans le même appel sont **un formulaire, pas une réflexion** ; des tours d'agent réels valent mieux.
4. Une forme de série écrite en recette numérotée est appliquée telle quelle à chaque post → un seul squelette. Resserrer cette recette n'y change rien : le brief d'écriture de la série est **retiré** le 2026-10-20, sans remplacement.
5. Des exemples de prompt liés à un domaine orientent toutes les générations vers ce domaine.
6. Les essais complets sont dans `docs/tests/` (`mykine-pack/`, `2026-10-17/`, `animation-html/`) — pack de test MyKiné, compte `mykine.test@example.com` en base de dev.
