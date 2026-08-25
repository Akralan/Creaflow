# SPEC TECHNIQUE — INTELLIGENCE DE LA GÉNÉRATION (MISE À JOUR)

> **Statut : à implémenter.** Compagnon technique de `SPEC_PROMPT_GENERATION.md` (cadrage concept — le *pourquoi* est là-bas, ce document ne traite que le *quoi/comment*). Intègre les décisions tranchées en discussion (§1). À fusionner dans `TECH.md` (§3, §4, §5.1, §5.3, §5.6, §5.11) et `PRODUCT.md` (§3 Modules A/B) une fois livré.
>
> **Correction documentaire au passage :** `TECH.md` §4 documente encore `POST /api/scripts/:id/regenerate` comme geste actif — la régénération complète a été désactivée côté produit au profit de la micro-édition. Ce document acte son remplacement par « autre idée, même brief » (§6).
>
> **Annexe A = textes de référence.** Tous les textes de prompts (system prompt, gabarit d'assemblage, descriptions de champs, ajouts micro-retouches/onboarding/angles) sont fournis **verbatim en Annexe A**, à recopier tels quels — seuls les `${placeholders}` et les lignes conditionnelles sont du câblage. En cas d'écart entre le corps du document (§3-§6, qui décrit les intentions) et l'Annexe A, **l'annexe fait foi**.

---

## 1. Décisions tranchées (issues de la discussion de cadrage)

| Sujet | Décision |
| :--- | :--- |
| **Audience** | Champ marque `CreatorProfile.targetAudience` + override nullable par sujet `Product.targetAudience` (fallback marque à l'injection). Renseignée par **extraction conversationnelle** (onboarding, pattern `extractedProfile`) et éditable dans les paramètres ; pour les profils existants, **proposée** par l'assistant via `AssistantProposal` — jamais imposée par l'IA (principe existant Module E). Question d'onboarding **skippable**, pas un critère de `complete`. |
| **Concept** | **Stocké**, colonne nullable sur `Script`. Définition : la **trace de l'intention de génération**, pas une description vivante — même philosophie que `firstDraftSnapshot`. Figé pendant micro-retouches et éditions manuelles ; remplacé uniquement par « autre idée » (§6). |
| **« Autre idée, même brief »** | **En V1, dans ce chantier.** Supprimer-regénérer n'est pas une échappatoire acceptée. C'est la version *dirigée* de la régénération désactivée : brief intégralement verrouillé, concepts refusés réinjectés en contexte, mise à jour en place (non destructif pour le créneau). Détail §6. |
| **Portée des règles** | **Règles stratégiques** (une idée, concept, test du concurrent, hiérarchie de priorités) → génération complète, « autre idée », régénération de bloc, épisodes de série. **Règles de rédaction** (anti-clichés, concret > abstrait) → partout, y compris sélection→instruction, via constante partagée (§4.3). La sélection→instruction ne reçoit PAS les règles stratégiques — « plus court » doit produire plus court, pas une réévaluation du script. |
| **Séquencement / mesure** | Baseline **avant tout merge** : 3-5 briefs figés rejoués sur **Gemini** (provider par défaut, tier gratuit) avec le prompt actuel. Comparaison inter-provider : Gemini vs **OpenAI** (crédits restants). Claude : pas de clé API — test directionnel gratuit en collant le message assemblé (loggé) dans claude.ai. Protocole §8. |

---

## 2. Modèle de données — ajouts

```
CreatorProfile (ajout)
- targetAudience (text, nullable — qui lit/achète, ce qui l'intéresse, ce qu'il doit retenir ou faire ;
  texte libre, extrait de la conversation d'onboarding ou édité en paramètres)

Product (ajout)
- targetAudience (text, nullable — override par sujet ; null = fallback sur l'audience de marque.
  Couvre le cas personal branding multi-sujets : l'audience d'un projet ML ≠ celle d'un produit en dev)

Script (ajouts)
- concept (text, nullable — l'intention de génération, rédigée par le LLM en premier champ du tool.
  Null pour origin manual/imported et pour les scripts antérieurs à cette migration.
  Écrit à la génération, figé ensuite, remplacé uniquement par « autre idée » §6)
- rejectedConcepts (jsonb array de strings, défaut [] — concepts écartés via « autre idée »,
  appendés dans l'ordre ; injectés en contexte des générations suivantes du même script,
  plafonnés aux N plus récents à l'injection, cf. §6.3)
```

Aucune autre table. Pas de nouvelle entité pour l'historique des concepts : le tableau jsonb suffit (même arbitrage que `rejectedConcepts` ~ `recentTopics`, mémoire de variété, pas donnée relationnelle).

---

## 3. Le prompt — nouvelle structure

### 3.1 `SCRIPT_SYSTEM_PROMPT` v2 (court et dense — cf. leçon de sobriété, concept §2.7)

1. **Identité + posture** (2 phrases) : Directeur Marketing Virtuel, portée tous métiers inchangée ; obsession ajoutée — *un post publiable tel quel par un concurrent est un échec*.
2. **Règles de qualité** (6-8 principes, une ligne chacun) : une seule idée par script ; le hook crée un manque (tension, chiffre, contre-intuition **tirés de la matière**), il n'annonce pas ; le concret bat l'abstrait ; test du concurrent ; auto-vérification finale (au moins un élément que seul ce créateur peut dire, sinon retour à la matière).
3. **Interdits durs** (2-3, marqués) : jamais inventer une info non fournie ; `[à compléter]` **resserré** — construire autour de ce que la matière permet, resserrer l'ambition du post plutôt que multiplier les marqueurs ; `usedExcerpts` obligatoire (inchangé).
4. **Pas d'exemple contrasté en V1** — réintroduction conditionnée au protocole §8 (décision ouverte n°3).

Les règles de structure purement descriptives actuelles (hook en 3 composantes, storyboard numéroté…) migrent vers les **descriptions de champs** des schémas d'outils (§4.2), où elles sont mieux placées.

### 3.2 `buildScriptUserMessage` v2 — blocs balisés à ordre fixe

Données séparées des consignes ; chaque bloc désactivable indépendamment (mesure par module, §8) :

```
[CONTEXTE MARQUE]    marque, activité, ton, valeurs, styleProfile, matériel, temps
                     + Audience visée : Product.targetAudience ?? CreatorProfile.targetAudience
[MATIÈRE]            documents annotés [déjà utilisé], inchangé dans son contenu (§5.8 TECH.md)
[BRIEF]              plateforme + règle plateforme, catégorie, série, angle, type de contenu,
                     produit/sujet, brandAsset (visual), episodeDirective (séries)
[VARIÉTÉ]            recentTopics, performanceSummary,
                     concepts déjà refusés sur CE script (rejectedConcepts, si « autre idée » §6)
[PRIORITÉS & QUALITÉ]  ← bloc FINAL, position de poids maximal :
   1. vérité factuelle (matière)  2. identité de série & angle imposé
   3. voix de la marque           4. codes de la plateforme
   + soupape : si l'angle imposé ne s'applique pas à la matière disponible,
     adapter la structure plutôt que d'inventer des faits
   + rappel du test du concurrent
```

**Supprimé :** la ligne finale « Génère le contenu via l'outil fourni, en respectant strictement son format » — redondante avec le tool calling forcé et le retry de `callStructured`.

### 3.3 Constante partagée `EDITORIAL_WRITING_RULES`

Anti-clichés (une ligne d'exemples types : formules d'annonce, questions rhétoriques vides, accumulation d'emojis) + concret > abstrait. Exportée depuis `prompts.ts`, consommée par : les générations complètes (via le system prompt), `microEdit.ts` (sélection→instruction **et** régénération de bloc), `materialEpisodes.ts`.

---

## 4. Schémas d'outils (`scriptSchema.ts`)

### 4.1 Champ `concept`

- Sur les **3 tools de génération** (`generate_video_script` / `generate_visual_post` / `generate_text_post`) : **première propriété**, `required`.
- Description : *« À rédiger avant tout le reste : en 1-2 phrases, l'idée unique de ce post, à qui il s'adresse, ce qu'on doit retenir ou faire. »*
- L'ordre des propriétés est le mécanisme (les champs sont générés dans l'ordre du schéma) — ne pas le déplacer.
- La génération d'épisodes de série hérite gratuitement (elle passe par les mêmes tools) ; `propose_series_episodes` n'est pas concerné (il ne produit pas de script).
- Côté serveur : `createScriptRecord`/`updateScriptRecord` persistent `Script.concept`.

### 4.2 Descriptions de champs — réécriture qualitative

Chaque description porte l'exigence, pas seulement le type. Intentions (formulations à ajuster à l'implémentation) :
- `title` : nomme l'idée, pas le sujet.
- `hookText`/`hookAudio` : crée une tension ou une curiosité — jamais une annonce du sujet.
- `hookVisual` : une image concrète filmable en 3 secondes avec le matériel listé.
- `storyboard[].description` : un plan = une action filmable, pas une intention abstraite.
- `caption` : développe l'idée du `concept`, un seul appel à l'action clair.
- `hashtags` : mix large + niche selon la règle plateforme, jamais décoratif.
C'est ici que migrent les règles de structure retirées du system prompt (§3.1).

### 4.3 Tools de micro-retouche (`microEdit.ts`)

- `rewrite_selection` : + `EDITORIAL_WRITING_RULES` dans son contexte. **Pas** de règles stratégiques, pas de champ concept.
- `regenerate_hook` / `regenerate_storyboard` / `regenerate_hashtags` (et `regenerate_caption` côté service) : reçoivent `Script.concept` en **contexte de lecture** — « reconstruis ce bloc en cohérence avec cette intention ». C'est le geste principal d'édition depuis la désactivation de la régénération complète : la cohérence d'intention y est critique.

---

## 5. Onboarding & assistant — l'audience

- `onboardingChat.ts` : une question audience de plus (une à la fois, pattern inchangé), champ ajouté à `extractedProfile`/`mergeExtractedProfile`. **Non bloquante** pour `complete`.
- Paramètres : `targetAudience` éditable avec le reste du profil (`POST /api/profile`) ; override par sujet éditable sur la fiche produit (`PUT /api/products/:id`).
- Profils existants : l'override par sujet passe par le kind **`product_update` existant** (le champ vit sur `Product` — zéro nouveau kind). Pour l'audience de marque : nouveau kind `profile_update` (payload `{ targetAudience }`), même cycle accept/edit/reject que les autres propositions.

---

## 6. « Autre idée, même brief » — le geste

Remplace la régénération complète désactivée. Ce qui la rendait inacceptable — aveugle, destructrice pour le créneau mental de l'utilisateur, sans mémoire — est précisément ce que le concept corrige : le geste devient **dirigé** (il sait ce qui a été refusé) et **motivé** (l'utilisateur rejette une intention, pas des mots).

### 6.1 Endpoint

`POST /api/scripts/:id/new-idea` (corps vide) :
1. Vérifie `origin="generated"` et l'existence d'un `concept` (sinon 409 — un script importé/manuel n'a pas d'intention IA à remplacer).
2. Appende `Script.concept` courant à `rejectedConcepts`.
3. Reconstruit le contexte normal (`buildGenerationContext`) — **brief intégralement verrouillé** : plateforme, catégorie, **angle conservé** (pas de recalcul anti-répétition — « verrouiller le brief, libérer les mots », `SPEC_MATIERE_EDITEUR.md` §1.3 ; c'est la différence avec l'ancien regenerate qui recalculait l'angle), série, type de contenu, produit.
4. Injecte `rejectedConcepts` dans le bloc `[VARIÉTÉ]` : *« Concepts déjà proposés et refusés pour ce post — propose une idée différente : … »*.
5. Génération complète via les tools normaux → `updateScriptRecord` **en place** (`CalendarEntry.scriptId` intact, `createdAt` inchangé), citations en delete-then-insert (mécanique existante), nouveau `concept` écrit.

### 6.2 Quota

`ScriptGenerationEvent` plein tarif — c'est un appel structuré complet, coût identique à une génération. Le grief historique contre le regenerate (« payer plein pot pour un résultat aveugle ») visait l'aveuglement, pas le prix ; le geste dirigé rend le prix juste. Alternative (pool dédié type micro-retouches) en décision ouverte n°2.

### 6.3 Garde-fous

- **Confirmation UI systématique** avant exécution : le contenu actuel du script est remplacé — si l'utilisateur a édité à la main, ses modifications partent. Une phrase de confirmation suffit en V1 (pas de détection fine « édité depuis génération »).
- **Plafond d'injection** : seuls les ~5 derniers `rejectedConcepts` sont injectés (le tableau stocke tout).
- **UI** : bouton dans l'en-tête du brief de l'éditeur (`/scripts/:id`), à côté du statut — pas dans les gestes de bloc, pour marquer la différence de nature (intention vs mots).

### 6.4 Cycle de vie du concept — récapitulatif

écrit à la génération → figé (micro-retouches, éditions manuelles, régénérations de bloc n'y touchent jamais) → remplacé uniquement par `new-idea` (l'ancien part dans `rejectedConcepts`). Non affiché à l'utilisateur en V1 (l'exposition dans l'en-tête du brief est l'évolution V2 naturelle, avec le multi-concepts au premier jet — hors périmètre, cf. « proposition multi-voix » déjà actée, `TECH.md` §10).

---

## 7. Ordre d'implémentation

| Lot | Contenu | Dépendances / mesure |
| :--- | :--- | :--- |
| **0 — baseline** | Figer 3-5 briefs (mix boutique / personal branding, avec et sans matière riche), les rejouer sur Gemini avec le prompt ACTUEL, archiver les sorties. Logger le message assemblé pour le test claude.ai manuel. | Rien. **Bloquant pour tout le reste** — sans « avant », pas de mesure. |
| **1 — prompt pur** | §3.1 + §3.2 + §3.3 (system prompt v2, blocs, priorités, constante partagée). Zéro migration. | Rejouer la baseline → première mesure isolée. |
| **2 — concept & schémas** | Migration `Script.concept`/`rejectedConcepts` + §4 (champ concept, descriptions qualitatives, contexte des régénérations de bloc). | Lot 1. Rejouer la baseline. |
| **3 — autre idée** | §6 (endpoint, UI, quota). | Lot 2 (le concept doit exister). |
| **4 — audience** | Migrations `CreatorProfile`/`Product` + §5 (onboarding, paramètres, propositions assistant). | Indépendant des lots 2-3, peut être parallélisé. |
| **5 — angles enrichis** | Prompt de `angleLabels.ts` : squelette de hook + condition de réussite par angle (concept §3.8). Régénération proposée depuis l'écran Direction pour les jeux existants. | Aucun. Dernier car levier indirect. |

## 8. Protocole de validation (rappel opérationnel)

- Grille binaire par script rejoué : test du concurrent passé ? une seule idée identifiable ? hook = manque ou annonce ? formules creuses (compte) ? `[à compléter]` (compte) ? `concept` = vraie décision ou paraphrase du brief ?
- Un lot mergé = une passe de baseline. Retirer ce qui ne mesure aucun gain (leçon de sobriété).
- Inter-provider : Gemini vs OpenAI sur la baseline du lot 1 ; claude.ai en manuel pour le directionnel.

---

## 9. Décisions ouvertes

1. **`firstDraftSnapshot` après « autre idée »** — le conserver (règle actuelle « jamais réécrit ») ou le remplacer par le nouveau jet ? Reco : remplacer — comparer la version finale de l'utilisateur au jet d'une idée abandonnée est du bruit pour l'apprentissage de voix ; mais c'est une entorse à la règle existante, à trancher.
2. **Quota de `new-idea`** — `ScriptGenerationEvent` plein tarif (§6.2, reco) ou pool dédié plus généreux si l'usage montre des rejets en série ?
3. **Exemple contrasté** (bon/mauvais hook) — absent en V1 ; à réintroduire seulement si le protocole montre un besoin, éventuellement conditionné au provider (utile sur petits modèles Groq, superflu sur les gros).
4. **Plafond `rejectedConcepts` injectés** — 5 par défaut, à ajuster.
5. **Exposition du concept en UI** (en-tête du brief) — V2, couplée ou non au multi-concepts au premier jet.

---

## 10. Impact documentaire

- `TECH.md` §3 — colonnes `CreatorProfile.targetAudience`, `Product.targetAudience`, `Script.concept`, `Script.rejectedConcepts`.
- `TECH.md` §4 — **retirer** `POST /api/scripts/:id/regenerate` de la liste active (désactivé produit) ; ajouter `POST /api/scripts/:id/new-idea` ; noter le nouveau kind `profile_update` d'`AssistantProposal`.
- `TECH.md` §5.1 — structure v2 (system prompt, blocs, priorités, concept, constante partagée).
- `TECH.md` §5.3 — question audience dans l'onboarding.
- `TECH.md` §5.6 — angles enrichis.
- `TECH.md` §5.11 — règles de rédaction partagées + concept en contexte des régénérations de bloc.
- `PRODUCT.md` §3 Module A — audience comme donnée de profil ; Module B — barre de qualité éditoriale, geste « autre idée, même brief » en remplacement de la régénération complète.
- `SPEC_PROMPT_GENERATION.md` — marquer les décisions ouvertes n°1, 2, 4 (concept doc §7) comme tranchées par le présent document.

---

## Annexe A — Textes des prompts à recopier tels quels

Rédigés pour être **agnostiques au provider** (Gemini par défaut, OpenAI, Claude, Groq). Les `${...}` sont des interpolations TypeScript ; les lignes marquées `← si …` ne sont émises que si la donnée existe. Les noms de champs de §A.5 sont à aligner sur les noms exacts de `scriptSchema.ts`.

### A.1 — Constante partagée `EDITORIAL_WRITING_RULES` (exportée depuis `prompts.ts`)

```
Règles de rédaction :
- Le concret bat l'abstrait : un détail daté, chiffré ou nommé vaut mieux que trois généralités.
- Écris comme la personne parle à ses clients ou à ses pairs, pas comme une marque qui communique.
- Registre marketing creux interdit : formules d'annonce ("Découvrez", "N'hésitez pas à", "Prêt à passer au niveau supérieur ?"), questions rhétoriques vides, superlatifs sans preuve, accumulation d'emojis.
```

### A.2 — `SCRIPT_SYSTEM_PROMPT` v2 (remplace intégralement l'actuel ; interpole A.1)

```
Tu es le Directeur Marketing Virtuel de CreaFlow. Tu produis, pour des créateurs, artisans, freelances et petites entreprises de tout métier, du contenu social media prêt à publier. Ton obsession est la spécificité : un post qui pourrait être publié tel quel par un concurrent est un échec.

Règles de qualité :
- Un script porte UNE seule idée, formulée dans le champ "concept" avant tout le reste. Si deux messages cohabitent, garde le plus fort et abandonne l'autre.
- L'accroche crée un manque — une tension, un chiffre inattendu, une affirmation contre-intuitive tirés du contexte fourni. Elle n'annonce jamais le sujet.
- Chaque script contient au moins un élément que seul ce créateur peut dire. Si ce n'est pas le cas de ton brouillon, retourne puiser dans la matière fournie avant de répondre.

${EDITORIAL_WRITING_RULES}

Interdits :
- Tu n'inventes JAMAIS une information factuelle (nom, chiffre, date, anecdote, résultat...) absente du contexte fourni. Si la matière est pauvre, resserre l'ambition du post autour de ce que tu sais plutôt que de combler les trous ; en dernier recours, écris "[à compléter]" à la place d'une précision indispensable — jamais plus de deux fois par script.
- Le champ "usedExcerpts" de l'outil est obligatoire dans tous les cas : renvoie les passages copiés mot pour mot que tu as réellement utilisés, ou un tableau vide [] si aucune matière ne t'a été fournie. Ne l'omets jamais.
```

### A.3 — `buildScriptUserMessage` v2 — gabarit d'assemblage complet

Ordre des sections **fixe**. La ligne finale actuelle (« Génère le contenu via l'outil fourni, en respectant strictement son format ») est **supprimée sans remplacement**.

```
=== CONTEXTE MARQUE ===
Marque : ${brandName} (${activityType})
Audience visée : ${product?.targetAudience ?? creatorProfile.targetAudience}          ← si l'une des deux est renseignée
Ton : ${tone}                                                                          ← si renseigné
Valeurs : ${values}                                                                    ← si renseigné
Style de communication observé (à respecter) : ${styleProfile.summary}                 ← si présent
Matériel disponible : ${equipment.join(", ")}                                          ← si renseigné
Temps disponible par semaine : ${weeklyTimeAvailable}                                  ← si renseigné

=== MATIÈRE ===                                                                        ← bloc entier si materialDocuments
[Conserver TELLES QUELLES les formulations actuelles de prompts.ts, calibrées en usage réel :
 l'introduction « Matière factuelle disponible sur ce sujet (base-toi dessus en priorité,
 n'invente rien au-delà)... », l'explication des marqueurs [déjà utilisé...]/[/déjà utilisé],
 et le rappel usedExcerpts qui suit les documents.]

=== BRIEF ===
Produit/Sujet concerné : ${product.name} — ${description} (proposition de valeur : ${valueProposition})
  ← ou, sans produit : « Aucun produit spécifique : script générique sur l'activité de la marque. »
Plateforme cible : ${platform}. ${platformRule(platform)}
Catégorie de contenu visée : ${contentCategory.label}. ${contentCategory.description}
Série récurrente à respecter (identité et angle de la série — directive forte) : ${series.label} — ${series.description}     ← si série
Angle à adopter pour ce script (structure/format de hook à respecter) : ${angle.label} — ${angle.description}                ← si angle
Type de contenu : ${contentType}. ${CONTENT_TYPE_GUIDANCE[contentType]}
[Photo de référence : conserver telle quelle la formulation actuelle avec son garde-fou « mise en scène uniquement »]        ← si brandAsset (visual)
Cet épisode de la série doit se concentrer sur : ${episodeTitle} — ${angleHint}                                              ← si episodeDirective

=== VARIÉTÉ ===                                                                        ← bloc si au moins une ligne
Sujets déjà traités récemment (évite de reproposer les mêmes angles, varie les sujets) : ${recentTopics.join(" ; ")}
Performance récente observée : ${performanceSummary}
Concepts déjà proposés et refusés pour ce post — propose une idée réellement différente, pas une reformulation : ${rejectedConcepts.slice(-5).join(" ; ")}     ← si new-idea (§6)

=== PRIORITÉS ===
En cas de tension entre les consignes ci-dessus, l'ordre de priorité est :
1. La vérité factuelle : la matière fournie prime sur tout, rien n'est inventé au-delà.
2. L'identité de la série et l'angle imposé.
3. La voix de la marque (style observé, ton, valeurs).
4. Les codes de la plateforme.
Si l'angle imposé ne s'applique pas à la matière disponible, garde l'esprit de l'angle et adapte sa structure plutôt que d'inventer des faits.
Dernière vérification avant de répondre : si ce post pouvait être publié tel quel par un concurrent, il est raté — retourne chercher dans la matière le détail qui le rend unique.
```

### A.4 — Description du champ `concept` (première propriété, `required`, sur les 3 tools de génération)

```
À rédiger en premier, avant tous les autres champs : en 1 ou 2 phrases, l'idée unique de ce post, à qui il s'adresse précisément, et ce que cette personne doit retenir ou faire après l'avoir vu. Une vraie décision éditoriale — pas une paraphrase du brief.
```

### A.5 — Descriptions des champs des tools de génération

| Champ | Tools | Description exacte |
| :--- | :--- | :--- |
| `title` | les 3 | Le nom de l'idée, pas du sujet : court, spécifique à ce post, impossible à réutiliser pour un autre. |
| `hookVisual` | video | Ce qu'on voit dans les 3 premières secondes : une action ou un objet précis, filmable avec le matériel listé. Pas une intention ("plan dynamique") — une image. |
| `hookText` | video, visual | Le texte affiché à l'écran : une phrase courte qui crée une tension ou une curiosité. Jamais une annonce du sujet. |
| `hookText` (variante contentType text) | text | La première phrase du texte : elle crée un manque qui oblige à lire la deuxième. |
| `hookAudio` | video | Ce qu'on entend dans les premières secondes (voix ou son) : prolonge le manque créé par le visuel, ne le répète pas. |
| `storyboard[].description` | video | Une action filmable en un seul plan avec le matériel listé : qui fait quoi, sur quoi. Concret et exécutable, pas une intention. |
| `storyboard[].description` (variante visual) | visual | Le contenu d'une slide : ce qu'on voit et le texte affiché, au service de l'idée du concept. |
| `caption` | les 3 | Développe l'idée du concept avec les détails de la matière. Un seul appel à l'action, clair, à la fin. Respecte les codes de la plateforme cible. |
| `hashtags` | selon plateforme | Chaque hashtag sert la découverte du post selon la règle de la plateforme cible (mix large + niche, nombre adapté). Jamais décoratif. |
| `soundRecommendation` | video | Un type de son, musique ou tendance cohérent avec l'idée et la plateforme, décrit concrètement. |
| `usedExcerpts` | les 3 | **Conserver la description actuelle** (calibrée en usage réel, mode strict compris). |

### A.6 — Micro-retouches (`microEdit.ts`)

Ligne de contexte ajoutée au message des tools `regenerate_*` (uniquement si `script.concept` non null) :

```
Intention du script (le bloc régénéré doit rester cohérent avec elle) : ${script.concept}
```

`rewrite_selection` : appendre `${EDITORIAL_WRITING_RULES}` (A.1) à son system prompt existant. Rien d'autre — pas de règles stratégiques, pas de concept.

### A.7 — Onboarding (`onboardingChat.ts`) — instruction ajoutée au system prompt

```
Cherche aussi à connaître l'audience visée : qui achète ou lit, ce qui intéresse ces personnes, ce qu'elles doivent retenir de la marque. Pose une question simple, avec un exemple adapté à l'activité décrite. Si la personne ne sait pas répondre ou préfère passer, n'insiste pas : ce champ n'est pas nécessaire pour terminer l'onboarding.
```

### A.8 — Angles (`angleLabels.ts`) — instruction ajoutée au prompt de génération d'angles

```
Pour chaque angle, la description doit contenir : (1) le squelette de l'accroche — la forme de la première phrase ou des trois premières secondes, sans contenu spécifique ; (2) en une ligne, ce qui fait réussir cet angle et l'erreur classique qui le fait échouer.
```
