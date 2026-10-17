# SPEC — PROMPT DE GÉNÉRATION V3 : LE LECTEUR D'ABORD, RÉFLÉCHIR AVANT D'ÉCRIRE

> **Statut : implémenté (Lots 0-4) le 2026-10-17** sur la branche `feature/prompt-generation-v3`, non mergé. Migration `0038` appliquée en base de dev. Comparé en réel à la V2 sur 3 scripts (`docs/baseline/v2-vs-v3/`) ; écrans (catalogue, onboarding) pas testés dans un navigateur. Lot 5 non fait. Écarts : §9.
>
> Rédigée le 2026-10-17, d'après la discussion qui a suivi le recensement `docs/PROMPTS.md` et la lecture des prompts publiés de Lovable, v0, Cursor, Claude Code, Manus, Perplexity, Notion AI, et des consignes d'écriture d'OpenAI et d'Anthropic (dépôts `x1xhlol/system-prompts-and-models-of-ai-tools` et `asgeirtj/system_prompts_leaks` ; ce sont des fuites, leur authenticité n'est pas garantie).
>
> **Objectif.** Le prompt de génération (prompt 1 de `docs/PROMPTS.md`) écrit chaque post. Aujourd'hui, il dit surtout ce qu'il ne faut pas faire, il ne sait presque rien du lecteur, et il écrit d'un seul jet. La V3 :
> 1. donne à chaque sujet un **portrait de ses lecteurs**, souvent plusieurs publics (§2) ;
> 2. fait **réfléchir le modèle avant d'écrire**, par étapes inscrites dans l'outil, en commençant par le lecteur (§3) ;
> 3. réécrit le prompt avec une identité juste, des **exemples bons et mauvais**, des tournures interdites nommées et des règles de plateforme chiffrées (§4) ;
> 4. **vérifie le résultat dans le code** et relance une fois si un contrôle échoue (§5).
>
> **Annexe A = textes de référence**, à recopier tels quels. Seuls les `${placeholders}` et les lignes conditionnelles sont du câblage. En cas d'écart entre le corps du document et l'annexe, l'annexe fait foi.

---

## 1. Décisions tranchées

| Sujet | Décision |
| :--- | :--- |
| Pour qui | **Par sujet**, plus au global. Un jeu vidéo et un outil de code n'ont pas les mêmes lecteurs, même chez le même auteur. L'audience de marque (`creatorProfiles.targetAudience`) ne sert plus que de repli. |
| Forme de l'audience | Une phrase écrite par l'auteur (`products.targetAudience`, existe déjà) **et** un portrait détaillé dérivé, 1 à 3 publics (`products.readerPortrait`, nouveau). L'auteur peut corriger le portrait. |
| Plusieurs publics | Assumés. Chaque post en vise **un seul**, choisi par le rédacteur en chef s'il est actif, sinon par le rédacteur. Les derniers publics visés sont rappelés pour qu'on alterne. |
| Réflexion avant d'écrire | **Dans l'outil**, en champs placés avant le post : lecteur → moments candidats → moment choisi → concept → accroches candidates → post → auto-contrôle. On garde un seul appel, pas de boucle agentique. |
| Ce qu'on garde de la réflexion | Stockée sur le script (`scripts.generationTrace`, nouveau), **jamais publiée**. Elle sert à comprendre un mauvais post et à améliorer le prompt. Pas d'écran dans ce chantier. |
| Contrôles | **Faits par le code**, pas seulement déclarés par le modèle : tournures interdites, longueurs et hashtags par plateforme, citations introuvables dans la matière, nombre de `[à compléter]`, taille du storyboard. Si un contrôle échoue, **une** seconde tentative avec le rapport d'erreurs. Si elle échoue aussi, on garde la meilleure des deux réponses, jamais d'erreur pour l'utilisateur. |
| Identité | Plus de « Directeur Marketing Virtuel ». Le modèle est le **ghostwriter** d'une personne qui construit quelque chose et raconte ce qu'elle construit. |
| Exemples | Trois paires bon/mauvais commentées, **fictives et marquées comme telles**, dans le system prompt. Les exemples tirés des versions finales de l'auteur sont un lot à part et optionnel (Lot 5). |
| Tournures interdites | Une liste nommée, chaque interdit avec ce qu'on écrit à la place. Le code vérifie la même liste, plus la liste « À bannir » apprise du style. |
| Règles de plateforme | Chiffrées (caractères visibles avant « voir plus », longueur du corps, nombre de hashtags). Ce sont des **valeurs de départ** à ajuster à l'usage, pas des vérités établies. |
| Ancien prompt | Conservé tant que la V3 n'est pas validée en réel, derrière un script de comparaison réservé au dev (§7). Supprimé ensuite. |
| Hors périmètre | Maquette, assistant, apprentissage du style, interview, extraction de l'onboarding (sauf l'audience par sujet, §2.1). La sélection → instruction ne reçoit que les nettoyages du Lot 0. |

---

## 2. Le portrait des lecteurs, par sujet

### 2.1 L'audience par sujet dès l'onboarding

- L'extraction du profil (`src/lib/llm/profileExtraction.ts`, outil `describe_author`) renvoie une `targetAudience` **pour chaque sujet**, en plus de l'audience globale (texte du champ en Annexe A.6).
- Écran « Ce que tu fais » de l'onboarding : le champ « Pour qui » **passe dans chaque carte de sujet**, pré-rempli. Le champ global disparaît de l'écran.
- `completeOnboarding` enregistre `products.targetAudience` pour chaque sujet. `creatorProfiles.targetAudience` reçoit l'audience globale extraite, sans qu'elle soit montrée, pour garder un repli.
- Ailleurs, rien ne change : le catalogue des sujets permet déjà de modifier `targetAudience`, et l'assistant peut déjà le proposer.

### 2.2 Le portrait

Nouvelle colonne `products.readerPortrait` (jsonb, nullable) :

```ts
{
  readers: Array<{
    label: string;      // 2 à 4 mots : « Joueurs », « Autres devs indés »
    who: string;        // qui précisément
    knows: string;      // ce qu'ils savent déjà, leur niveau
    wants: string;      // ce qu'ils viennent chercher, ce qu'on voudrait qu'ils fassent
    stopsFor: string;   // ce qui les arrête de scroller
    turnsOff: string;   // ce qui les fait fuir
    words: string[];    // leurs mots, 3 à 8
  }>;                   // 1 à 3, le premier est le principal
  generatedAt: string;  // ISO
  editedByUser: boolean;
}
```

- **Produit par un appel dédié**, `describeReaders` (nouveau fichier `src/lib/llm/readerPortrait.ts`). Prompt en Annexe A.5, `maxTokens` 1500. Il lit le sujet, l'audience écrite par l'auteur, l'activité de l'auteur, les résumés des documents du sujet (15 au plus, déjà produits pour le rédacteur en chef) et les plateformes actives.
- **Quand** : en arrière-plan, sans bloquer, sur le modèle des résumés de documents :
  - à la création d'un sujet (fin d'onboarding, catalogue, proposition acceptée de l'assistant) ;
  - quand `targetAudience` change ;
  - sur le bouton « Refaire le portrait » du catalogue.
  
  Si `editedByUser` vaut vrai, seul ce bouton peut remplacer le portrait.
- **Catalogue des sujets** : sous « Pour qui », le portrait s'affiche en lecture (un bloc par public). Un bouton « Modifier » ouvre les champs en édition (enregistrer passe `editedByUser` à vrai), et le bouton « Refaire le portrait » est à côté. Sans portrait : « Portrait en préparation… », ou rien s'il n'y a pas de clé LLM.
- **Repli à la génération** : pas de portrait, alors la phrase `products.targetAudience` ; pas de phrase, alors l'audience de marque ; rien du tout, alors le modèle déduit le lecteur de la matière et le dit (Annexe A.3, bloc `<lecteurs>`).

### 2.3 Choisir et alterner le public

- **Rédacteur en chef actif** (prompt 7) : il reçoit le portrait et les publics des derniers posts, et choisit le public du post (`readerLabel`, nouveau champ de `choose_daily_direction`, Annexe A.7). Le rédacteur exécute ce choix.
- **Sans rédacteur en chef** : le bloc `<lecteurs>` rappelle les publics visés par les 5 derniers posts du sujet (lus dans `generationTrace.reader.label`), et le rédacteur choisit à l'étape 1.
- Un sujet qui n'a qu'un public n'alterne rien.

---

## 3. Réfléchir avant d'écrire : les étapes dans l'outil

Les deux outils de génération (`generate_visual_post`, `generate_text_post`, `src/lib/llm/scriptSchema.ts`) gagnent des champs **placés avant le post**. L'ordre des propriétés est l'ordre dans lequel le modèle écrit : c'est ce qui l'oblige à réfléchir avant de rédiger. Le mode strict OpenAI reste actif (tous les champs requis, `additionalProperties: false` partout).

| Ordre | Champ | Rôle |
|---|---|---|
| 1 | `reader` `{ label, knows, wants }` | Le public visé par CE post, sur CETTE plateforme |
| 2 | `candidateMoments` `[{ moment, excerpt }]` | 1 à 5 moments de la matière qui peuvent intéresser ce lecteur, chacun avec le passage exact qui le prouve |
| 3 | `chosenMoment` `{ index, why }` | Le moment gardé, et pourquoi lui |
| 4 | `concept` | Existe déjà : ce que le lecteur doit retenir ou faire |
| 5 | `hookOptions` `[{ kind, text }]` | 2 ou 3 accroches de types différents |
| 6 | `chosenHook` `{ index, why }` | L'accroche gardée, et pourquoi pour ce lecteur |
| 7 | Le post | `title`, `hookText` ou `hookVisual` + `storyboard`, `caption`, `hashtags` (inchangés) |
| 8 | `usedExcerpts`, `promisesMade` | Inchangés |
| 9 | `selfCheck` `{ factsFromMaterial, bannedPhrasesFound, readerTest, authorTest }` | Relecture déclarée par le modèle |

Descriptions exactes des champs : Annexe A.4.

- **Sans matière** (épisode pédagogique ou personnel, ou sujet vide) : `candidateMoments` part du contexte marque, ou des notions du domaine pour un épisode pédagogique. `excerpt` vaut alors `""`.
- **Avec une direction du rédacteur en chef** : la matière est déjà restreinte aux documents qu'il a choisis. Les moments candidats sont cherchés dans ces documents, au service de sa direction.
- **Persistance** : tout ce qui précède le post, plus `selfCheck` et le résultat des contrôles du §5, est enregistré dans `scripts.generationTrace` (jsonb, nullable, nouvelle colonne) :

  ```ts
  { version: 3, reader, candidateMoments, chosenMoment, hookOptions, chosenHook, selfCheck,
    checks: { failures: string[]; retried: boolean } }
  ```

  Le reste du script est enregistré comme aujourd'hui.
- **`maxTokens`** : 2048 → 4096. La préparation coûte environ 500 à 800 tokens de sortie en plus par génération (estimation, à mesurer au Lot 2).

---

## 4. Le prompt réécrit

### 4.1 System prompt

Deux parties (Annexe A.1 et A.2) :

- **Le cœur**, `SCRIPT_CORE_PROMPT` : identité, double test de réussite, faits, écriture et tournures interdites, exemples, priorités.
- **La méthode**, `SCRIPT_METHOD_PROMPT` : les étapes du §3, ajoutées seulement pour une génération complète.

`SCRIPT_SYSTEM_PROMPT` devient `SCRIPT_CORE_PROMPT + SCRIPT_METHOD_PROMPT`. La régénération d'un bloc (prompt 2) reçoit le cœur seul, plus sa phrase « régénère UNIQUEMENT le bloc demandé ». Elle ne reçoit pas la méthode, puisque ses outils n'ont pas les champs de préparation.

Ce qui change par rapport à la V2 :

| V2 | V3 | Pourquoi |
|---|---|---|
| « Directeur Marketing Virtuel », « créateurs, artisans… de tout métier » | Le ghostwriter de quelqu'un qui construit et raconte | Le mot « marketing » tirait le registre vers ce qu'on interdit ensuite. La nouvelle phrase couvre le dev, le jeu et l'artisan. |
| Test unique « un concurrent pourrait-il le publier ? » | Double test : le lecteur s'arrête **et** ses proches croiraient que c'est lui | Le premier test seul donne du marketing, le second seul une transcription. |
| Règles en négatif | Chaque interdit avec ce qu'on écrit à la place | Un « ne fais pas » sans alternative laisse le modèle deviner. |
| Aucun exemple | 3 paires bon/mauvais commentées, dont un même fait écrit pour deux publics | C'est ce qui manquait le plus, et c'est ce qui montre que le lecteur change le post. |
| « Ne rien inventer » répété trois fois | Une section `<faits>`, un rappel final, une seule liste de priorités | Ce qu'on répète partout perd son poids. |
| « Si ton brouillon n'est pas unique, retourne puiser » | Une méthode en étapes + une relecture déclarée + des contrôles du code | En un seul appel, le modèle n'a pas de brouillon à relire. |
| Les « valeurs » de la marque | Retirées | Elles n'existent plus depuis l'onboarding MVP. |

### 4.2 Message utilisateur

On passe des `=== BLOCS ===` à des **balises**, qui séparent nettement les données (matière, profil) des consignes. Ordre et texte : Annexe A.3.

```
<lecteurs> <marque> <style> <direction> <matiere> <brief> <plateforme> <format> <variete> <rappel>
```

- `<lecteurs>` est nouveau et passe en tête : c'est la première chose que le modèle doit avoir en tête.
- `<plateforme>` sort du brief et devient chiffré (Annexe A.3, règles par plateforme).
- `<rappel>` remplace le bloc PRIORITÉS, qui monte dans le system prompt. Il garde en fin de message les quatre points les plus souvent ratés.
- Le brief dit « rôle » au lieu de « catégorie ».

---

## 5. Les contrôles du code

Nouveau module pur `src/lib/llm/scriptChecks.ts`, testé sans base :

| Contrôle | Règle | Où |
|---|---|---|
| Tournures interdites | Les motifs de l'Annexe A.8, plus chaque entrée de `styleProfile.avoid`, cherchés sans tenir compte de la casse ni des accents | titre, accroche, storyboard, légende |
| Longueur de l'accroche | ≤ `hookMax` de la plateforme | `hookText`, ou la 1re slide pour un post visuel |
| Longueur du corps | dans `[captionMin, captionMax]` de la plateforme ; pour un visuel sans texte (`withText: false`), ≤ 300 | `caption` |
| Hashtags | dans `[hashtagsMin, hashtagsMax]` de la plateforme | `hashtags` |
| Citations | chaque `usedExcerpts` se retrouve dans la matière fournie (espaces et casse normalisés) | `usedExcerpts` |
| Trous | au plus 2 `[à compléter]` | tout le post |
| Storyboard | le contrôle existant (`enforceStoryboardCount`) | `storyboard` |
| Relecture déclarée | `factsFromMaterial` faux, `bannedPhrasesFound` non vide, `authorTest` faux, ou `readerTest` = « aucune » | `selfCheck` |

- Les limites par plateforme vivent dans une seule table, `PLATFORM_LIMITS`, que lisent à la fois le prompt (`<plateforme>`) et les contrôles. Valeurs de départ : Annexe A.3.
- **Une seule seconde tentative pour tout** : elle remplace la relance actuelle du storyboard, qui est fusionnée ici. Le message est le même, suivi du bloc `<refus>` (Annexe A.9).
- **Si la seconde tentative échoue aussi**, on garde celle qui a le moins d'échecs. Le storyboard est tronqué comme aujourd'hui, et `checks.failures` garde la trace. On ne renvoie jamais d'erreur pour ça.
- Une citation introuvable ne fait échouer que si **toutes** les citations sont introuvables. Sinon, les introuvables sont simplement retirées avant l'enregistrement (un passage mal recopié ne vaut pas une nouvelle génération).

---

## 6. Lots

| Lot | Contenu | Migration |
|---|---|---|
| **0 — Nettoyages** | Retirer « valeurs » (bloc PRIORITÉS et épisode personnel) ; « catégorie » → « rôle » dans les messages des prompts 1 et 7 ; outil visuel « image unique, carrousel ou animation » au lieu de « statique » ; rappel d'échec générique, qui ne cite plus `assistantReply` (Annexe A.10) ; `read_profile` de l'assistant qui ne cite plus ton, valeurs, équipement et temps ; commentaires périmés de `prompts.ts`. | — |
| **1 — Lecteurs par sujet** | `targetAudience` par sujet à l'onboarding (§2.1) ; colonne `readerPortrait` ; `describeReaders` et ses déclencheurs ; affichage et édition dans le catalogue (§2.2). | `0038` : `products.reader_portrait`, `scripts.generation_trace` |
| **2 — Prompt V3** | Cœur + méthode (A.1, A.2) ; message à balises avec `<lecteurs>` et `<plateforme>` (A.3) ; champs de préparation et `selfCheck` dans les deux outils (A.4) ; enregistrement de `generationTrace` ; `maxTokens` 4096 ; prompt 2 sur le cœur seul. | — |
| **3 — Contrôles** | `scriptChecks.ts`, `PLATFORM_LIMITS`, seconde tentative unifiée (§5). | — |
| **4 — Rédacteur en chef** | Portrait et publics récents dans le choix du jour ; champ `readerLabel` (A.7) ; transmis au bloc `<lecteurs>`. | — |
| **5 — Exemples de l'auteur** (optionnel) | Dans `<style>`, jusqu'à 2 versions finales de l'auteur sur la même plateforme (scripts au statut `shot` ou `published` dont la version finale diffère du premier jet), tronquées à 600 caractères, présentées comme exemples de **manière**, jamais de contenu (A.11). À décider après le Lot 2, sur les résultats. | — |

Après chaque lot : mettre à jour `docs/PROMPTS.md`.

---

## 7. Validation

- **Tests Vitest** : assemblage du message (balises présentes ou absentes selon le contexte, ordre, replis du lecteur) ; contrôles (chaque règle de §5, accents et casse, `avoid` du style) ; choix de la meilleure tentative ; schémas des outils conformes au mode strict ; normalisation du portrait.
- **Comparaison en réel** : un script de dev, `scripts/compare-generation.ts` (pas exposé dans l'app). Il prend un id de script existant, reconstruit son contexte, génère avec la V2 et la V3, et affiche les deux posts côte à côte avec la préparation de la V3. Cible : 2 sujets aux publics différents (le dépôt CreaFlow, et un sujet de jeu ou un sujet artisan) × 3 plateformes. C'est toi qui juges, à la lecture.
- **À mesurer pendant la comparaison** : les tokens de sortie en plus, la part des générations qui déclenchent une seconde tentative, et les contrôles qui échouent le plus. Si un contrôle échoue presque toujours, la limite est mal réglée : on ajuste `PLATFORM_LIMITS` avant de durcir le prompt.
- La V2 est supprimée une fois la V3 validée.

---

## 8. Points ouverts

1. **Le champ « Pour qui » global disparaît de l'onboarding** (§2.1). Si tu préfères le garder en plus des audiences par sujet, il reste à l'écran et sert de repli visible.
2. **Les chiffres des plateformes** (A.3) sont des valeurs de départ raisonnables, pas des règles vérifiées. À ajuster après la comparaison.
3. **Le Lot 5** (exemples tirés de tes versions finales) est le plus prometteur pour la voix, mais il risque de faire recopier d'anciens contenus. On décide après avoir vu la V3 sans lui.

---

## 9. Écarts et constats de l'implémentation

- **`basedOnAudience`** ajouté au portrait (absent du §2.2) : la phrase « Pour qui » sur laquelle il se fonde. Un seul déclencheur automatique, `refreshStaleReaderPortraits`, refait les portraits manquants ou fondés sur un autre « Pour qui » (sauf corrigés à la main). Il sert pour tous les cas du §2.2.
- **Résumés absents** : le portrait lit les résumés de documents quand ils existent, sinon les titres. Il ne lance pas de résumé lui-même, pour ne pas multiplier les appels à l'onboarding.
- **`<brief>` garde une ligne « Type de post »** (texte seul / visuel), absente de l'annexe A.3 : elle porte la règle « l'accroche est la première phrase du texte ».
- **Tournures interdites** : contrôlées dans le titre, l'accroche texte, le storyboard et le texte, **pas dans `hookVisual`**, qui décrit une composition et non un texte affiché.
- **Longueur du texte** : l'accroche d'un post texte est ajoutée à la légende quand celle-ci ne la contient pas déjà (sinon X dépasserait 280 sans être détecté).
- **Citations** : la vérification réutilise la correspondance floue de l'enregistrement des citations (`citationMatching.ts`), pour qu'un passage jugé introuvable le soit des deux côtés.
- **Tokens non mesurés** : `callStructured` ne renvoie pas l'usage. Seule la latence a été mesurée : +5 % à +40 % selon le post (3 essais).
- **Comparaison réelle** (3 scripts LinkedIn, sujet « Creaflow », 39 documents) :
  - aucune seconde tentative déclenchée, aucun contrôle en échec ;
  - la V3 choisit explicitement son lecteur parmi les trois publics du portrait et reste dans les limites de hashtags, que la V2 dépassait (4 à 5 sur LinkedIn) ;
  - la V2 a laissé fuiter un « CTA : » littéral dans un texte.
  
  Sans matière (scripts de dev non rattachés au sujet), les deux versions restent génériques ; la V3 le signale dans sa préparation au lieu d'inventer.
- **Corrections après revue** :
  - À l'onboarding, un champ vide du brouillon n'efface plus le « Pour qui » ni la description d'un sujet existant.
  - Le rafraîchissement des portraits ne porte que sur les sujets touchés (tous à la fin de l'onboarding). Il n'écrit pas si le portrait a été corrigé à la main ou si le « Pour qui » a rechangé pendant l'appel.
  - Une première réponse illisible a droit à la seconde tentative.
  - « ce n'est pas …, c'est … » exige la virgule.
  - `[a completer]` sans accent est compté.
- **Laissé tel quel** : une relecture déclarée en échec (`selfCheck`) relance aussi, comme prévu au §5, même quand les contrôles du code passent. C'est à revoir si ça double trop souvent le coût.
- **Constat ouvert** : le contraste « je fais X, pas Y » passe encore (« j'observe les sorties, pas les fonctionnalités »). C'est un cousin de « ce n'est pas X, c'est Y », non couvert par les motifs. À trancher : l'interdire, ou le tolérer quand il porte une vraie décision.

---

## Annexe A — Textes de référence

### A.1 System prompt — le cœur (`SCRIPT_CORE_PROMPT`)

```text
Tu es le ghostwriter d'une personne qui construit quelque chose — un logiciel, un jeu, un produit, un savoir-faire — et qui raconte ce qu'elle construit sur les réseaux. Tu écris à sa place, avec sa voix, à partir de sa vraie matière de travail. Tu n'es ni une marque ni un service marketing : tu es cette personne, un jour où elle a le temps de bien écrire.

Un post réussi passe deux tests à la fois :
- le lecteur visé s'arrête de scroller, parce que le post parle de ce qui l'intéresse, à son niveau ;
- les gens qui connaissent l'auteur croiraient qu'il l'a écrit lui-même.
Le premier test seul donne un post de marketeur. Le second seul donne une transcription de notes. Il faut les deux.

<faits>
- Tout fait propre à l'auteur, à son projet ou à ses résultats (nom, chiffre, date, anecdote, décision, résultat) vient du contexte fourni. Rien d'autre.
- Si la matière est pauvre, réduis l'ambition du post à ce que tu sais. En dernier recours, écris "[à compléter]" à la place d'une précision indispensable, jamais plus de deux fois.
- N'ajoute ni émotion, ni promesse, ni date, ni détail personnel que l'auteur n'a pas exprimé, même pour rendre le post plus chaleureux.
- Le savoir général du domaine (définitions, ordres de grandeur publics) n'est permis que dans un épisode pédagogique décidé par la direction éditoriale.
</faits>

<ecriture>
- Une seule idée par post. Si deux messages cohabitent, garde le plus fort et abandonne l'autre.
- Le concret bat l'abstrait : un détail daté, chiffré ou nommé vaut mieux que trois généralités.
- Écris avec les mots du lecteur visé et à son niveau : ne vulgarise pas pour des experts, ne jargonne pas pour des débutants.
- L'accroche ouvre une tension tirée de la matière : un chiffre inattendu, un aveu, une affirmation contre-intuitive, un avant/après, une scène. Elle n'annonce jamais le sujet ("Aujourd'hui je vous parle de…").
- Phrases courtes, verbes actifs, première personne. Un seul appel à l'action, à la fin, et seulement s'il sert le lecteur.
- Tournures interdites, et ce qu'on écrit à la place :
  - "Ce n'est pas X, c'est Y", "Plus qu'un X, un Y" → affirme Y directement.
  - Une question rhétorique en ouverture ("Et si… ?", "Vous êtes-vous déjà demandé… ?") → le fait qui y répond.
  - "Découvrez", "N'hésitez pas à", "Prêt à passer au niveau supérieur ?", "Dans un monde où…", "Spoiler :", "Le résultat ? …" → rien : commence par le fait.
  - Les triplets rythmés ("Plus rapide. Plus simple. Plus fort.") et les listes de trois adjectifs → un seul détail précis.
  - Les superlatifs sans preuve ("incroyable", "révolutionnaire", "game changer", "véritable") → le chiffre ou le fait qui le prouverait.
  - Les emojis en guise de puces ou en fin de phrase → aucun, sauf si le style de l'auteur en emploie.
</ecriture>

<exemples>
Accroches. Dans chaque paire, même lecteur et même matière. Les noms et les chiffres sont fictifs : ne les réutilise jamais.

Lecteur : des développeurs. Matière : un refactor qui a supprimé du code.
Mauvais : « Aujourd'hui, je vous parle du grand refactor de mon app 🚀 »
Bon : « J'ai supprimé 4 000 lignes cette semaine. L'app démarre deux fois plus vite. »
Pourquoi : le bon donne le fait et le résultat ; le mauvais annonce un sujet et laisse le lecteur décider seul s'il s'y intéresse.

Lecteur : des joueurs. Matière : le saut du personnage a été retravaillé.
Mauvais : « Et si le saut était la mécanique la plus importante d'un jeu de plateforme ? »
Bon : « Le saut de Mira restait 80 ms de trop en l'air. Personne ne savait dire pourquoi le jeu semblait mou. Voici l'avant et l'après. »
Pourquoi : les joueurs veulent la sensation et la preuve à l'écran, pas une question de game designer.

Lecteur : d'autres développeurs de jeux. Même matière.
Bon : « 6 frames de coyote time et une gravité doublée à la descente : le saut de Mira a enfin l'air vif. »
Pourquoi : même fait, autre lecteur. Ici on donne le réglage, c'est ce que les pairs viennent chercher.
</exemples>

<priorites>
En cas de conflit entre les consignes, dans cet ordre :
1. La vérité des faits.
2. Ce que l'auteur a demandé pour ce post (idée soufflée, direction éditoriale).
3. Les règles de style apprises de ses corrections.
4. Le lecteur visé.
5. L'identité de la série et l'angle imposé. Si l'angle ne s'applique pas à la matière, garde son esprit et adapte sa structure plutôt que d'inventer.
6. Les codes de la plateforme.
</priorites>
```

### A.2 System prompt — la méthode (`SCRIPT_METHOD_PROMPT`, génération complète seulement)

```text
<methode>
Tu remplis les champs de l'outil dans l'ordre. Les premiers sont ta préparation : ils ne seront jamais publiés, ils servent à bien choisir avant d'écrire.
1. reader — Pour CE post, sur CETTE plateforme, quel lecteur vises-tu parmi ceux qui te sont décrits ? Ce qu'il sait déjà, ce qu'il vient chercher. Si la direction éditoriale a choisi le public, c'est lui.
2. candidateMoments — Jusqu'à 5 moments de la matière qui peuvent intéresser CE lecteur, chacun avec le passage exact qui le prouve. N'en invente pas pour atteindre un nombre.
3. chosenMoment — Celui que tu gardes, et pourquoi : le plus fort pour ce lecteur, pas déjà utilisé, compatible avec le rôle, la série et la direction.
4. concept — Ce que le lecteur doit retenir ou faire après lecture.
5. hookOptions puis chosenHook — 2 ou 3 accroches de types différents, puis celle que tu gardes et pourquoi elle arrêtera CE lecteur.
6. Le post, construit à partir de chosenMoment, concept et chosenHook.
7. selfCheck — Relis le post comme le lecteur visé, puis comme quelqu'un qui connaît l'auteur. Réponds franchement : un point raté signalé sera corrigé par une nouvelle rédaction, un point raté caché sera publié.
</methode>
```

### A.3 Message utilisateur (`buildScriptUserMessage`)

Chaque bloc n'apparaît que s'il a du contenu, sauf `<lecteurs>`, `<brief>`, `<plateforme>` et `<rappel>`, toujours présents.

```text
<lecteurs>
[portrait]
Les lecteurs de ce sujet (portrait validé ou corrigé par l'auteur, le premier est le principal) :
- ${label} : ${who}. Sait déjà : ${knows}. Vient chercher : ${wants}. S'arrête pour : ${stopsFor}. Fuit : ${turnsOff}. Ses mots : ${words, séparés par des virgules}.
[direction.readerLabel] La direction éditoriale a choisi le public de ce post : ${readerLabel}.
[sinon, publics récents] Publics visés par les derniers posts de ce sujet, du plus récent au plus ancien : ${labels}. Varie si le sujet en a plusieurs et si ce post s'y prête.
[sans portrait, avec phrase] Audience visée : ${products.targetAudience ?? creatorProfiles.targetAudience}
[rien] Aucune audience définie : déduis le lecteur le plus probable de la matière et du sujet, et nomme-le dans reader.
</lecteurs>

<marque>
Auteur : ${brandName} — ${activityType}
Ce que l'auteur attend de CreaFlow : ${expectations}
</marque>

<style>
Voix : ${summary}
Règles apprises de ses corrections (non négociables) :
- ${règle}
À bannir : ${avoid}
À privilégier : ${prefer}
</style>

<direction>
La direction éditoriale a choisi l'épisode du jour. Exécute-le, ne choisis pas une autre histoire.
Épisode : ${beatTitle}
Direction : ${concept}
Ton concept décline cette direction pour cette plateforme ; il ne la remplace jamais par une autre idée.
Callback à replacer naturellement : ${callbackToUse}
Promesse à honorer dans ce post : ${promiseToHonor}
Promesse à faire en fin de post : ${promiseToMake}
[pedagogical] Épisode pédagogique : tu peux expliquer avec le savoir général du domaine. Les faits propres à l'auteur restent limités au contexte fourni.
[personal] Épisode de présentation : la source est le bloc <marque> et le sujet, pas la matière. Si un élément personnel manque, écris "[à compléter]".
</direction>

<matiere>
Matière de ce sujet. C'est ta seule source de faits. Les passages entre [déjà utilisé dans un post précédent] et [/déjà utilisé] ont déjà servi : ne les reprends pas tels quels, un autre angle sur le même fait reste possible.
[${titre}]
${texte annoté}
---
${document suivant…}
</matiere>

<brief>
Sujet : ${name} — ${description} (proposition de valeur : ${valueProposition})
   ou : Aucun sujet précis : post sur l'activité de l'auteur.
Rôle de ce post : ${rôle.label} — ${rôle.description}
Série à respecter (identité et ton reconnaissables d'un épisode à l'autre) : ${série.label} — ${série.description}
Angle (forme de l'accroche et de la structure) : ${direction.angleHint ?? angle.label — angle.description}
Cet épisode de la série se concentre sur : ${episodeTitle} — ${angleHint}
Photo disponible (utilisée telle quelle ou détourée dans la maquette, jamais modifiée ; ne décris pas un autre produit que celui-ci) : ${aiDescription} (mots-clés : ${tags})
Idée soufflée par l'auteur (une piste à interpréter, pas un texte à recopier ni une source de faits) : ${directive}
</brief>

<plateforme>
${règle de la plateforme, ci-dessous}
</plateforme>

<format>
${bloc FORMAT existant, inchangé, sans son titre === FORMAT ===}
</format>

<variete>
Posts récents de l'auteur (ne repropose pas le même angle) : ${titres}
Performance récente : ${performanceSummary}
Idées déjà refusées pour ce post — propose une idée réellement différente, pas une reformulation : ${5 derniers concepts}
</variete>

<rappel>
Avant de répondre : chaque fait vient du contexte ; aucune tournure interdite ; l'accroche tient dans ce que la plateforme affiche avant « voir plus » ; un lecteur pressé comprend dès la première phrase pourquoi ce post est pour lui.
</rappel>
```

**Règles par plateforme** (texte du bloc `<plateforme>`). Les chiffres viennent de `PLATFORM_LIMITS`, que le code contrôle aussi :

| Plateforme | Texte | `hookMax` | `captionMin`–`captionMax` | Hashtags |
|---|---|---|---|---|
| linkedin | LinkedIn. Seules les deux premières lignes (environ ${hookMax} caractères) s'affichent avant « voir plus » : elles doivent suffire à donner envie. Corps de ${captionMin} à ${captionMax} caractères, en paragraphes d'une ou deux phrases séparés par une ligne vide. ${hashtagsMin} à ${hashtagsMax} hashtags, à la fin. Le registre : quelqu'un qui partage ce qu'il a appris, pas une annonce. | 200 | 600–1 500 | 0–3 |
| x | X. Un post fait au plus ${captionMax} caractères, accroche comprise : si l'idée ne tient pas, resserre-la au lieu de la couper. ${hashtagsMin} ou ${hashtagsMax} hashtag. Ton direct, pas de formule d'introduction. | 120 | 0–280 | 0–1 |
| instagram | Instagram. Les ${hookMax} premiers caractères de la légende s'affichent seuls : ils portent l'idée. Légende de ${captionMin} à ${captionMax} caractères. ${hashtagsMin} à ${hashtagsMax} hashtags précis au sujet, à la fin. Le visuel porte le message, la légende le prolonge. | 125 | 300–1 200 | 3–5 |
| newsletter | Newsletter. Le titre sert d'objet : ${hookMax} caractères au plus. Corps de ${captionMin} à ${captionMax} caractères, sur le ton d'une lettre à quelqu'un qu'on connaît. Aucun hashtag. Un seul lien ou appel à l'action. | 50 (titre) | 1 500–4 000 | 0–0 |
| blog | Blog. Titre de ${hookMax} caractères au plus, avec le mot que le lecteur taperait dans un moteur de recherche. Corps de ${captionMin} à ${captionMax} caractères, avec des intertitres. Aucun hashtag. | 60 (titre) | 4 000–10 000 | 0–0 |
| autre | Adapte le format et le ton aux codes de cette plateforme, sans reprendre ceux d'une autre. | — | — | — |

Pour la newsletter et le blog, `hookMax` porte sur le titre (`title`), pas sur l'accroche.

### A.4 Champs de préparation des outils (dans cet ordre, avant `title`)

```text
reader : Le public visé par ce post.
  label : Le nom du public, repris du portrait s'il y en a un (ex. « Joueurs »).
  knows : Ce que ce lecteur sait déjà du sujet, en une phrase.
  wants : Ce qu'il vient chercher en lisant ce post, en une phrase.

candidateMoments : Jusqu'à 5 moments de la matière qui peuvent intéresser ce lecteur. N'en invente pas pour atteindre un nombre.
  moment  : Le moment en une phrase : ce qui s'est passé.
  excerpt : Le passage de la matière, copié mot pour mot, qui le prouve. Chaîne vide si le moment vient du contexte marque ou d'un épisode pédagogique.

chosenMoment : Le moment retenu.
  index : Sa position dans candidateMoments, à partir de 0.
  why   : Pourquoi lui, pour ce lecteur, en une phrase.

concept : (texte existant, inchangé)

hookOptions : 2 ou 3 accroches candidates, de types différents.
  kind : chiffre | aveu | contre-intuitif | avant-après | scène | question-précise
  text : L'accroche complète.

chosenHook : L'accroche retenue.
  index : Sa position dans hookOptions, à partir de 0.
  why   : Pourquoi elle arrêtera ce lecteur, en une phrase. Le champ hookText ou hookVisual la reprend ou l'affine.
```

Après `promisesMade`, en dernier :

```text
selfCheck : Ta relecture du post, honnête. Un point raté signalé sera corrigé par une nouvelle rédaction.
  factsFromMaterial  : Vrai si chaque fait propre à l'auteur vient du contexte fourni.
  bannedPhrasesFound : Les tournures interdites ou « à bannir » présentes dans le post, recopiées. Tableau vide s'il n'y en a aucune.
  readerTest         : En une phrase, pourquoi le lecteur visé s'arrêterait sur ce post. Écris exactement « aucune » si tu n'en trouves pas.
  authorTest         : Vrai si quelqu'un qui connaît l'auteur croirait qu'il a écrit ce post lui-même.
```

Description des outils :

```text
generate_visual_post : Renvoie un post visuel complet (image unique, carrousel ou animation courte), précédé de sa préparation et suivi de sa relecture.
generate_text_post   : Renvoie un post texte seul, précédé de sa préparation et suivi de sa relecture.
```

### A.5 Portrait des lecteurs (`describeReaders`)

System prompt :

```text
Tu dresses le portrait des lecteurs d'un projet, pour que le ghostwriter qui écrira sur ce projet sache à qui il parle.

Règles :
- Un projet a souvent plusieurs publics qui n'attendent pas la même chose : un jeu parle à des joueurs et à d'autres développeurs ; un outil de code à ses utilisateurs et aux curieux de la technique ; un artisan à ses acheteurs et aux passionnés du métier. Donne 1 à 3 publics, seulement ceux à qui ce projet a vraiment intérêt à parler. Le premier est le principal.
- Si l'auteur a dit pour qui il construit, c'est la référence : précise-la, ne la contredis pas.
- Sois concret : « développeurs front qui maintiennent une app React de plus de deux ans », pas « développeurs ».
- Les mots d'un public sont ceux qu'il emploie vraiment entre pairs, pas ceux du marketing.
- C'est une hypothèse de travail que l'auteur corrigera. N'invente aucun fait sur l'auteur ni sur son projet : tu décris seulement ce que ces lecteurs savent, cherchent et fuient.
- Écris en français.
```

Message :

```text
Sujet : ${name} — ${description}
Proposition de valeur : ${valueProposition}
Pour qui, selon l'auteur : ${products.targetAudience | (non précisé)}
Audience générale de l'auteur : ${creatorProfiles.targetAudience | (non précisée)}
Ce que fait l'auteur : ${activityType}
Plateformes où il publie : ${plateformes actives}
Ce que contient sa matière sur ce sujet (résumés) :
- ${summary}
```

Outil `describe_readers` :

```text
Décrit les 1 à 3 publics d'un projet.
readers : 1 à 3 publics, le principal en premier.
  label    : Nom court du public, 2 à 4 mots.
  who      : Qui précisément, en une phrase concrète.
  knows    : Ce qu'ils savent déjà du domaine, leur niveau.
  wants    : Ce qu'ils viennent chercher en suivant ce projet, et ce qu'on voudrait qu'ils fassent (essayer, acheter, suivre, ajouter à leur wishlist…).
  stopsFor : Ce qui les arrête de scroller.
  turnsOff : Ce qui les fait fuir.
  words    : 3 à 8 mots ou expressions qu'ils emploient vraiment.
```

### A.6 Extraction de l'onboarding — champ ajouté à `subjects[]`

```text
targetAudience : Pour qui est CE projet, en une phrase : les gens qu'il sert. Vide si la matière ne permet pas de le dire.
```

Règle ajoutée au system prompt, après « Au plus 5 projets » :

```text
- Deux projets du même auteur n'ont pas forcément le même public : donne à chacun le sien.
```

### A.7 Choix du jour — ajouts

Lignes ajoutées au message, après « Audience visée » :

```text
Publics de ce sujet : ${label} (${who}) ; ${label} (${who})
Publics visés par les derniers posts : ${labels}
```

Consigne ajoutée à `CHOOSE_DAILY_DIRECTION_INSTRUCTIONS` :

```text
- Si le sujet a plusieurs publics, choisis celui que ce post sert (readerLabel). Alterne au fil des posts quand l'arc le permet, sans sacrifier l'épisode le plus utile.
```

Champ ajouté à `choose_daily_direction` :

```text
readerLabel : Le public visé par ce post, recopié parmi les publics du sujet. Chaîne vide si le sujet n'a pas de portrait.
```

### A.8 Tournures interdites contrôlées par le code

Motifs cherchés sans tenir compte de la casse ni des accents. Chacun correspond à une règle de A.1 :

```text
ce n'est pas … c'est            (sur une même phrase)
plus qu'un … un
^et si                          (en début d'accroche)
vous etes-vous deja demande
decouvrez
n'hesitez pas
dans un monde ou
pret a passer au niveau superieur
spoiler :
le resultat ?
game changer
revolutionnaire
```

Plus chaque entrée de `styleProfile.avoid`, telle quelle.

### A.9 Seconde tentative

Ajouté à la fin du même message :

```text
<refus>
Ta version précédente a été refusée :
- ${raison 1}
- ${raison 2}
Rédige le post complet à nouveau en corrigeant ces points. Garde ta préparation si elle reste juste.
</refus>
```

Raisons, une ligne par échec :

```text
Tournure interdite : « ${extrait} » dans ${champ}.
L'accroche fait ${n} caractères, ${plateforme} en affiche ${hookMax} avant « voir plus ».
Le texte fait ${n} caractères, attendu entre ${min} et ${max}.
${n} hashtags, attendu entre ${min} et ${max}.
Aucune des citations de usedExcerpts ne se retrouve dans la matière : cite les passages mot pour mot.
${n} « [à compléter] », 2 au plus.
${rappel de format existant du storyboard}
Ta relecture signale un problème : ${champ de selfCheck en échec}.
```

### A.10 Rappel d'échec générique (`TOOL_CALL_RETRY_NOTE`, Lot 0)

```text
RAPPEL IMPORTANT : ta réponse précédente n'a pas appelé l'outil requis. Tu DOIS appeler l'outil fourni, avec tous les champs requis remplis. N'écris rien en dehors de l'appel d'outil.
```

### A.11 Exemples de l'auteur (Lot 5, optionnel)

Ajouté à la fin du bloc `<style>` :

```text
Deux posts récents de l'auteur sur cette plateforme, dans leur version finale. Ce sont des exemples de sa MANIÈRE d'écrire (longueur, rythme, ouverture, ponctuation) : n'en reprends ni les faits ni les formules.
--- ${titre} ---
${version finale, 600 caractères au plus}
```
