# SPEC — MÉMOIRE DES DERNIERS POSTS ET VEILLE D'INSPIRATION

> **Statut : implémenté (Lots A-C) le 2026-10-17** sur la branche `feature/prompt-generation-v3`, non mergé. Migrations `0039`-`0040` appliquées en base de dev. Veille et génération essayées en réel ; panneau « Inspirations » pas ouvert dans un navigateur. Écarts : §5.
>
> Rédigée à la suite de `docs/SPEC_PROMPT_GENERATION_V3.md`, dont elle reprend les conventions : préparation dans l'outil, contrôles du code, textes verbatim en annexe.
>
> **Objectif.** Deux ajouts au rédacteur :
> 1. **Il se souvient de ses derniers posts sur le sujet**, sous forme de fiches courtes. Il ne répète plus ses accroches et peut faire référence à un post passé.
> 2. **Il s'inspire de ce qui marche déjà pour ses publics.** Un agent de veille cherche sur le web, enregistre des fiches (lien + ce qu'on en apprend sur la forme). Ces fiches reviennent dans le prompt des posts suivants, et le rédacteur peut retirer celles qui ne servent pas.

---

## 1. Décisions tranchées

| Sujet | Décision |
| :--- | :--- |
| Mémoire | Une fiche par post, pour les **5 derniers scripts du même sujet** : date, plateforme, public visé, moment raconté, accroche mot pour mot et son type, phrase de fin. **Jamais le texte complet**, que le modèle recopierait. |
| Répétition | Contrôlée par le code : une accroche identique à une accroche récente (mêmes 6 premiers mots), ou un 3ᵉ post d'affilée qui ouvre sur le même type d'accroche, déclenche la seconde tentative. |
| Recherche web | **Jamais pendant la rédaction d'un post** : elle reste rapide, et les faits ne viennent que de la matière. La veille est un agent à part, par sujet. |
| Quand la veille tourne | **À la demande** (bouton du sujet), et **seule en arrière-plan** après une génération si la dernière veille du sujet date de plus de 7 jours. Pas de tâche planifiée. Désactivable avec `INSPIRATION_AUTO_REFRESH=false`. |
| Ce qu'une fiche contient | Le lien, le titre, ce qu'on y apprend sur la **forme** (format, structure, type d'accroche, rythme, sujet récurrent), le type (`format`, `accroche`, `structure`, `sujet`, `compte`), le public et la plateforme concernés. Pas de copie du contenu d'autrui. |
| Liens inventés | Écartés : un lien n'est gardé que s'il figure dans les sources réellement consultées par la recherche (citations de l'API). |
| Retrait par le rédacteur | **Immédiat, mais réversible** : la fiche passe « écartée », avec la raison. Tu la vois dans le sujet et tu peux la remettre. |
| Plafond | **10 fiches actives par sujet.** Au-delà, la plus ancienne jamais utilisée est écartée (« remplacée »). Une fiche montrée 8 fois sans servir est écartée (« jamais utilisée »). |
| Fournisseur | OpenAI, outil `web_search` de l'API Responses, en dur comme l'assistant (il ne dépend pas de `LLM_PROVIDER`). |
| Hors périmètre | La recherche pendant la rédaction ; la lecture de tes comptes LinkedIn ou X ; les métriques d'engagement des posts trouvés. |

---

## 2. La mémoire des derniers posts

- **Lecture** : `loadRecentPostCards(userId, productId, excludeScriptId)` lit les 5 derniers scripts du sujet, du plus récent au plus ancien.
  - Le **moment** et le **type d'accroche** viennent de la trace V3 (`generationTrace`). Ils sont absents pour un script plus ancien ou écrit à la main.
  - L'**accroche** est `hookText`, ou la 1re slide d'un post visuel.
  - La **fin** est la dernière phrase du texte, coupée à 160 caractères.
- **Message** : un bloc `<derniers_posts>`, placé avant `<variete>` (Annexe A.1).
- **Contrôle** (`scriptChecks.ts`) :
  - l'accroche choisie commence par les mêmes 6 mots qu'une accroche récente → échec ;
  - les deux posts les plus récents ont le même type d'accroche, et le post en cours aussi → échec.
  
  Texte des raisons : Annexe A.4.

---

## 3. La veille d'inspiration

### 3.1 Données

Nouvelle table `inspirations` :

| Colonne | Type | Rôle |
|---|---|---|
| `id`, `userId`, `productId` | uuid | Le sujet (cascade). |
| `url`, `title` | text | Le lien trouvé. |
| `insight` | text | Ce qu'on y apprend sur la forme, une ou deux phrases. |
| `kind` | text | `format`, `accroche`, `structure`, `sujet` ou `compte`. |
| `readerLabel`, `platform` | text, nullable | Le public et la plateforme concernés. |
| `status` | enum `active` / `dismissed` | |
| `dismissedBy` | text, nullable | `model`, `user` ou `system`. |
| `dismissReason` | text, nullable | La raison du retrait. |
| `shownCount`, `usedCount` | integer | Montrée dans un prompt, déclarée utile. |
| `createdAt`, `updatedAt` | timestamp | |

Plus `products.inspirationRefreshedAt` (timestamp, nullable), la date de la dernière veille du sujet.

### 3.2 L'agent de veille

Deux appels, dans `src/lib/llm/inspirationResearch.ts` :

1. **Recherche** (`callWebResearch`, nouveau, OpenAI en dur). Appel Responses avec l'outil `web_search`. Il renvoie un compte rendu en texte et la liste des sources réellement consultées (annotations `url_citation`). Prompt : Annexe A.2.
2. **Mise en fiches** (`callStructured`, outil `save_inspirations`, mode strict). Il transforme le compte rendu en 8 fiches au plus. Prompt : Annexe A.3.

Le service (`inspirationService.ts`) :
- garde seulement les liens présents dans les sources consultées ;
- écarte les doublons, y compris ceux que tu as déjà écartés ;
- applique le plafond de 10 ;
- met à jour `inspirationRefreshedAt`.

### 3.3 Dans la génération

- **Contexte** : les fiches actives du sujet (10 au plus), numérotées `i1`…`i10` pour le modèle. Leur `shownCount` augmente à chaque génération complète.
- **Message** : un bloc `<inspiration>`, placé après `<brief>` (Annexe A.1).
- **Outil** : deux champs de préparation après `chosenHook` :
  - `inspirationsUsed`, les références qui ont servi ;
  - `inspirationsToDrop` (`[{ ref, why }]`), celles qui ne servent pas ce sujet.
  
  Textes : Annexe A.5. Une ligne est ajoutée à la méthode.
- **Après enregistrement du script** : les fiches utiles voient leur `usedCount` augmenter ; les fiches à retirer passent « écartées » par le modèle, avec la raison ; les fiches montrées 8 fois sans servir passent « écartées » par le système. Une référence inconnue est ignorée.

### 3.4 Écran

Dans le catalogue des sujets, un bouton **« Inspirations »** à côté de « Lecteurs » :
- les fiches actives (lien, ce qu'on en apprend, public, plateforme, « utilisée N fois ») ;
- les fiches écartées, en gris, avec qui les a écartées et pourquoi, et le bouton « Remettre » ;
- « Supprimer » pour toute fiche ;
- un bouton « Lancer une veille », avec la date de la dernière.

Routes :
- `GET` et `POST /api/products/[id]/inspirations` (lister, lancer une veille) ;
- `PATCH` et `DELETE /api/inspirations/[id]` (écarter ou remettre, supprimer).

---

## 4. Lots

| Lot | Contenu |
|---|---|
| **A — Mémoire** | `loadRecentPostCards`, bloc `<derniers_posts>`, deux contrôles de répétition, tests. |
| **B — Veille** | Migration `0039` (table `inspirations`, `products.inspirationRefreshedAt`) ; `callWebResearch` ; agent en deux appels ; service ; routes ; écran ; relance après 7 jours. |
| **C — Inspiration dans la génération** | Bloc `<inspiration>`, champs `inspirationsUsed` / `inspirationsToDrop`, retours appliqués après enregistrement, tests. |

---

## 5. Écarts et constats de l'implémentation

- **Le retrait par le rédacteur demande deux signalements.** Premier essai réel : sur une génération, le modèle a signalé 4 à 5 fiches sur 8, avec des raisons propres au post (« ne correspond pas à l'angle retenu »), même après avoir précisé la consigne. Une fiche n'est donc écartée par le modèle qu'à la **2e génération** qui la signale (colonne `dropVotes`, migration `0040`). Une fiche qui sert remet le compteur à zéro. La consigne précise aussi qu'on ne retire pas une fiche parce qu'elle ne sert pas à ce post-ci (Annexes A.1 et A.5 mises à jour en conséquence dans le code).
- **La recherche est forcée** (`tool_choice: "required"`). En mode `auto`, le modèle a répondu une fois de mémoire, sans consulter de page : aucune source, donc zéro fiche.
- **Essai réel** (sujet « Creaflow », LinkedIn seul actif) :
  - 8 fiches en 20 secondes, toutes de vrais posts LinkedIn sur l'évaluation de prompts, chacune avec une leçon de forme ;
  - une génération en a utilisé 3 ou 4, sans contrôle en échec.
  
  Plusieurs fiches valorisent l'accroche polémique ou l'opposition « pratique visible contre pratique utile » : les tournures interdites restent contrôlées par le code.
- **Mémoire** : le rédacteur en chef lit maintenant les publics récents depuis les mêmes fiches que le rédacteur (`loadRecentPostCards`), au lieu d'une requête à part.
- **Export RGPD** : les fiches sont incluses (`subjectInspirations`).

---

## Annexe A — Textes de référence

### A.1 Blocs du message de génération

```text
<derniers_posts>
Les derniers posts de ce sujet, du plus récent au plus ancien. Ne reprends ni leurs accroches ni leurs fins. Si les deux derniers ouvrent sur le même type d'accroche, choisis-en un autre. Tu peux faire référence à l'un d'eux si ça sert l'histoire (« la semaine dernière… »), sans le répéter.
- ${date} · ${plateforme}${ · public : label} : ${moment ?}accroche${ [type]} « ${accroche} » · fin « ${fin} »
</derniers_posts>

<inspiration>
Ce qui marche déjà pour ces publics, trouvé en veille. Inspire-toi de la FORME (format, structure, type d'accroche, rythme), jamais du fond : n'en reprends ni chiffre, ni anecdote, ni formule. Tu n'es pas obligé d'en utiliser.
- [${ref}] (${public} · ${plateforme} · ${type}) ${insight} — ${url}
Dans ta préparation, inspirationsUsed liste celles qui t'ont servi, inspirationsToDrop celles qui ne servent pas ce sujet, avec la raison : elles seront retirées.
</inspiration>
```

Ligne ajoutée à `SCRIPT_METHOD_PROMPT`, après l'étape 5 :

```text
5 bis. inspirationsUsed et inspirationsToDrop — Si un bloc <inspiration> t'est fourni : celles qui t'ont servi pour la forme, et celles qui ne servent pas ce sujet. Tableaux vides sinon.
```

### A.2 Recherche (system prompt de `callWebResearch`)

```text
Tu fais de la veille pour le ghostwriter d'une personne qui construit quelque chose et le raconte sur les réseaux. Cherche sur le web ce qui fonctionne DÉJÀ auprès des publics décrits, sur les plateformes indiquées.

Ce que tu cherches :
- des exemples réels et précis : un post, un fil, un créateur, une newsletter, un devlog, un format nommé, qui marche visiblement auprès de ce public (réactions, reprises, communauté) ;
- ce qu'on peut en apprendre sur la FORME : le format, la structure, le type d'accroche, le rythme, les sujets qui reviennent.

Ce que tu écartes :
- les listes génériques (« 10 astuces pour percer sur LinkedIn »), le marketing de croissance, les conseils valables pour n'importe qui ;
- tout ce qui ne parle pas à ces publics précis.

Pour chaque trouvaille, donne le lien exact de la page consultée et, en une ou deux phrases, ce qu'on peut en apprendre pour écrire. Huit trouvailles au plus, les plus utiles d'abord. Écris en français.
```

Message :

```text
Sujet : ${name} — ${description}
Publics :
- ${label} : ${who}. Vient chercher : ${wants}.
   (sans portrait : « Pour qui : ${targetAudience} », ou « Public non défini : déduis-le du sujet. »)
Plateformes : ${plateformes actives}
Déjà en fiche (ne les repropose pas) : ${urls actives}
Déjà écartées, avec la raison (évite ce genre de trouvaille) : ${url} — ${raison} ; …
```

### A.3 Mise en fiches (`save_inspirations`)

System prompt :

```text
Tu transformes un compte rendu de veille en fiches d'inspiration pour un ghostwriter. Une fiche par trouvaille utile, huit au plus. Recopie les liens tels qu'ils apparaissent dans le compte rendu, n'en invente aucun. Une fiche dit ce qu'on apprend sur la FORME, pas un fait à réutiliser.
```

Outil :

```text
save_inspirations : Enregistre les fiches d'inspiration tirées de la veille.
items : Huit fiches au plus, les plus utiles d'abord.
  url         : Le lien exact, recopié du compte rendu.
  title       : Le titre de la page ou du post, court.
  insight     : Ce qu'on y apprend pour écrire (format, structure, type d'accroche, rythme, sujet récurrent), en une ou deux phrases.
  kind        : format | accroche | structure | sujet | compte
  readerLabel : Le public concerné, recopié parmi ceux donnés, ou chaîne vide.
  platform    : La plateforme concernée (linkedin, x, instagram, newsletter, blog), ou chaîne vide.
```

### A.4 Raisons de refus ajoutées (seconde tentative)

```text
L'accroche reprend celle d'un post récent (« ${accroche récente} ») : trouve une autre entrée.
Les deux derniers posts ouvraient déjà sur une accroche de type « ${type} » : choisis un autre type.
```

### A.5 Champs de préparation ajoutés (après `chosenHook`)

```text
inspirationsUsed   : Les références (i1, i2…) des fiches d'inspiration qui t'ont servi pour la forme. Tableau vide si aucune, ou s'il n'y a pas de bloc <inspiration>.
inspirationsToDrop : Les fiches qui ne servent pas ce sujet, à retirer. Tableau vide si aucune.
  ref : La référence (i1, i2…).
  why : Pourquoi elle ne sert pas, en une phrase.
```
