# Connecteurs Etsy, Shopify, Notion, Linear — et ce qu'est un « sujet » chez chacun

Statut : **Notion et Linear implémentés** (2026-09-09), non testés avec de vraies clés. Tout est
arbitré. Etsy et Shopify restent bloqués derrière une validation manuelle de leur plateforme
(§10) — démarches dans `docs/DEMANDES_ETSY_SHOPIFY.md`.

| Plateforme | Un sujet = | La matière = |
|---|---|---|
| GitHub *(existant)* | un dépôt | les `.md` + le journal de commits |
| Linear | un projet | la description du projet, ses *project updates*, les issues terminées |
| Notion | une page racine ou une base de données | le texte de la page et de ses sous-pages, ou les entrées de la base |
| Shopify | une collection | les fiches produits de la collection, les pages, les articles de blog |
| Etsy | une section de boutique | les fiches produits de la section, le « à propos », les avis clients |

## 1. Ce qui est demandé

Ajouter Etsy, Shopify, Notion et Linear à côté de GitHub. Comme GitHub, chacun sert **deux fois** :

1. **porte d'entrée** — « Continuer avec Notion » sur `/login` crée le compte et l'authentifie ;
2. **source de matière** — ce que la plateforme contient devient des sujets et leur corpus.

Ce point a été recadré en discussion et vaut d'être écrit noir sur blanc : ce ne sont **pas** de
simples sources qu'on branche depuis les paramètres, ce sont des fournisseurs d'identité au même
titre que GitHub. C'est ce qui distingue ce chantier d'un « ajouter quatre connecteurs » et ce qui
en fait le coût réel (§9).

## 2. Le contrat qu'un « sujet » impose

Avant de décider ce qu'est un sujet chez Etsy, il faut relire ce que le code en fait déjà.

Un sujet (`products` en base, « sujet » à l'écran — renommage visuel, `SPEC_MATIERE_EDITEUR.md`
§3.3) porte : un nom, une description, une proposition de valeur, une **audience propre**, un
**corpus de matière** (`sourceMaterials`), et les **séries** de contenu qui lui sont rattachées.
Il y en a **1 à 5 par compte** (`MAX_PRODUCTS = 5`, `src/lib/validation.ts:16`).

Conséquence directe, et c'est elle qui tranche tout le reste : le bon découpage n'est pas « ce que
l'API du fournisseur sait lister », c'est **ce dont on peut parler vingt fois sur plusieurs
semaines**. Trois critères pour valider un candidat :

1. **un nom et une description stables** — c'est ce qui devient `products.name` / `.description` ;
2. **une histoire qui s'accumule** — sans elle le corpus est figé, la série s'épuise en trois
   épisodes et la rotation d'angles n'a plus rien à faire tourner ;
3. **entre 1 et 5 par compte**, pas 200.

Le critère 2 est le plus dur à satisfaire, et c'est celui qu'on oublie en regardant une API.

## 3. Pourquoi GitHub tombe juste

Un dépôt coche les trois : un nom, une description, et surtout un **journal de commits** — une
histoire qui grossit toute seule. C'est le journal, plus que les `.md`, qui fait tenir le critère 2.
Un utilisateur en choisit jusqu'à cinq, ce qui tombe pile sur la limite.

C'est le mètre-étalon des quatre propositions qui suivent : à chaque fois, la question est « qu'est-ce
qui joue le rôle du dépôt, et qu'est-ce qui joue le rôle du journal de commits ? ».

## 4. Notion — un sujet = une page racine ou une base de données

| | |
|---|---|
| **Un sujet** | une page de premier niveau partagée avec l'intégration, ou une base de données |
| **La matière** | le texte de la page et de ses sous-pages ; pour une base, ses entrées |
| **Ce qui joue le journal de commits** | `last_edited_time` : une page Notion vivante bouge en permanence |

Quelqu'un qui tient ses notes dans Notion a typiquement trois à dix pages racines (« Produit »,
« Clients », « Journal »), ce qui tombe dans le bon ordre de grandeur. La sélection ressemble
exactement au choix de dépôts : on liste, l'utilisateur coche jusqu'à cinq.

Réserve : Notion ne montre à une intégration que ce qui lui a été **explicitement partagé**. Un
utilisateur qui n'a rien partagé verra une liste vide — il faut donc un message qui l'explique et
qui renvoie vers le partage, pas une page vide.

**Proposition : on retient ce découpage.** Il n'y a pas d'alternative sérieuse.

## 5. Linear — un sujet = un projet

| | |
|---|---|
| **Un sujet** | un projet Linear |
| **La matière** | la description du projet, ses *project updates*, les issues terminées |
| **Ce qui joue le journal de commits** | les *project updates* et le flux d'issues fermées |

C'est l'analogue le plus direct du dépôt GitHub : un projet Linear a un nom, une description, un
état d'avancement, et une histoire qui s'écrit toute seule au fil des tickets. Les *project updates*
sont même mieux que des commits pour ce qu'on veut en faire — ce sont déjà des phrases écrites pour
être lues par un humain.

Alternative écartée : **une équipe = un sujet**. Trop grossier, une équipe n'a pas de sujet unique.

**Proposition : on retient le projet.**

## 6. Etsy et Shopify — le point qui a demandé un arbitrage

Ici l'analogie avec le dépôt casse. Une boutique n'a pas de « journal », et l'unité naturelle
(l'article vendu) existe par centaines. Trois découpages possibles, qui ne donnent pas le même
produit.

### Option A — la boutique entière = 1 sujet

- **Pour :** marche toujours, chez tout le monde, sans configuration. La matière est riche
  d'emblée (toutes les fiches, le « à propos », les avis).
- **Contre :** l'artisan n'a **qu'un seul sujet**. Tout son contenu parle de « ma boutique ». On
  perd la granularité qui fait l'intérêt du produit : impossible de dire « cette série parle de mes
  bagues, celle-là de mes colliers », et l'override d'audience par sujet ne sert plus à rien.

### Option B — une collection / section = 1 sujet

- **Pour :** tombe naturellement dans la fourchette 1-5. Une collection a un nom et une intention
  éditoriale (« Bagues de fiançailles ») ; c'est déjà presque une série.
- **Contre :** dépend d'un rangement que le vendeur a fait ou non. Les **collections Shopify** sont
  une brique centrale de la boutique, bien tenues chez la plupart des marchands. Les **sections
  Etsy** sont facultatives et souvent laissées vides ou fourre-tout — chez ces vendeurs-là, on n'a
  rien à proposer et l'onboarding tombe sur une liste vide.

### Option C — un article vendu = 1 sujet

- **Pour :** le plus proche de l'esprit du code (la table s'appelle littéralement `products`). Et
  « comment j'ai fabriqué ce collier » est objectivement du très bon contenu court.
- **Contre :** 50 à 300 articles pour 5 sujets — il faut faire choisir cinq pièces phares, ce qui
  est une décision éditoriale qu'on demande à quelqu'un qui vient de créer son compte. Et un
  article épuisé ou retiré rend le sujet caduc, avec sa série et son corpus.

### Décision — option B des deux côtés (arbitrée le 2026-09-09)

**Shopify → une collection. Etsy → une section de boutique.**

Le même découpage pour les deux, contre la recommandation initiale qui proposait l'article phare
côté Etsy. Ce qui fait pencher : un sujet est un objet éditorial **durable** (§2), et un article
épuisé emporterait sa série et son corpus avec lui. Une section survit à son catalogue.

Conséquence assumée, à traiter et non à découvrir en production : **une boutique Etsy sans sections
ne propose aucun sujet.** L'écran de sélection doit alors proposer la boutique entière comme sujet
unique — un repli explicite, pas une liste vide. Même repli côté Shopify pour une boutique sans
collection, où il sera bien plus rare.

Corollaire pour l'ingestion : les articles non rangés dans une section n'appartiennent à aucun
sujet et ne sont donc jamais lus. C'est le prix de ce découpage, et il est cohérent — de la matière
qui n'appartient à rien ne saurait de toute façon pas dans quel corpus aller.

## 7. Ce que ça implique côté identité

### 7.1 Chaque fournisseur doit donner un email vérifié — les quatre le donnent

`users.email` est `NOT NULL UNIQUE`, et le rattachement à un compte existant ne se fait **jamais**
sur un email non vérifié — sinon n'importe qui revendiquerait l'adresse d'un compte existant
(`src/lib/services/githubAuthService.ts`, `decideAccountResolution`). Cette règle vaut telle quelle
pour les quatre nouveaux fournisseurs.

Vérifié le 2026-09-09, aucun des quatre ne bloque sur ce point (détail et sources en §10) :

| Fournisseur | D'où vient l'email | Vérifié ? |
|---|---|---|
| Notion | `owner.user.person.email` dans la réponse d'échange du jeton | oui, statut fourni |
| Linear | `viewer { email }` en GraphQL, scope `read` | oui |
| Etsy | scope `email_r` | oui |
| Shopify | `associated_user.email` du jeton *online* | oui, via `associated_user.email_verified` |

Le piège Shopify : `email` est **toujours** présent dans la réponse, `email_verified` ne l'est pas
toujours à `true`. Ne jamais rattacher un compte sur le seul champ `email` — c'est exactement le
scénario de prise de contrôle que `decideAccountResolution` interdit.

### 7.2 Quelle verticale pose une inscription Etsy ?

`users.vertical` vaut aujourd'hui `creator` ou `dev`, et choisit le parcours d'onboarding et le
prompt du chat (`ARCHITECTURE_VERTICALES.md`, chantier 2). GitHub pose `dev`.

Il a été tranché en discussion que les quatre nouveaux fournisseurs suivent **le même parcours que
GitHub** — choisir ses sujets, puis deux ou trois questions, puis les réseaux — et qu'on n'écrit pas
de textes par métier pour l'instant. Reste à décider ce qu'on inscrit en base :

- **soit** on ajoute `artisan` (Etsy, Shopify) et `entrepreneur` (Notion) à l'enum, les trois
  verticales pointant vers **le même** parcours, différenciable plus tard sans migration ;
- **soit** on ne touche à rien et tout le monde tombe sur `dev`, ce qui ferait mentir le nom — la
  faute exacte que le chantier 3 a corrigée en renommant `onboarding_track` en `vertical`.

**Proposition : la première.** Deux valeurs d'enum coûtent une ligne de migration ; un nom qui ment
coûte un chantier de renommage plus tard. **→ À arbitrer.**

Nuance à retenir : la verticale ne suffira pas à choisir quel sélecteur afficher (Linear et GitHub
seraient tous deux `dev`). L'écran doit lire **le fournisseur réellement connecté**, pas la
verticale.

### 7.3 Shopify ne se connecte pas comme les trois autres

L'OAuth Shopify part de **la boutique**, pas de la personne : l'URL d'autorisation est
`https://{boutique}.myshopify.com/admin/oauth/authorize`, donc il faut connaître le domaine
`.myshopify.com` **avant** de rediriger.

Conséquence concrète sur l'écran de connexion : « Continuer avec Shopify » ne peut pas être un
simple bouton comme les trois autres. Il lui faut un champ « quelle est l'adresse de ta
boutique ? » devant. C'est la seule asymétrie d'interface des cinq fournisseurs, et elle est
imposée par Shopify, pas par un choix de conception.

### 7.4 Les jetons expirent — sauf celui de GitHub

`github_accounts` n'a ni `refresh_token` ni date d'expiration, et c'est justifié : le jeton d'une
OAuth App GitHub classique ne périme pas. **Les quatre nouveaux fournisseurs périment**, sur des
échelles très différentes :

| Fournisseur | Durée du jeton d'accès | Rafraîchissement |
|---|---|---|
| GitHub | illimitée | sans objet |
| Linear | **24 heures** | jeton de rafraîchissement |
| Etsy | **1 heure** | jeton de rafraîchissement, 90 jours |
| Notion | limitée | jeton de rafraîchissement |
| Shopify (*offline*) | illimitée tant que l'app est installée | sans objet |

Le rafraîchissement paresseux devient donc de la plomberie **obligatoire**, pas une option — et
c'est ce qui condamne la table `github_accounts` dans sa forme actuelle (§8). Le modèle à reprendre
existe déjà : `getValidSocialAccessToken` dans `src/lib/services/socialConnectionService.ts`, qui
rafraîchit à l'usage et bascule la connexion en `needs_reconnect` quand le rafraîchissement échoue.

## 8. Ce que ça coûte, en gros

Le registre de connecteurs (`src/lib/connectors/`) et le service de synchronisation
(`sourceConnectorService`) sont déjà génériques et absorbent les quatre nouveaux sans modification —
c'est ce que le chantier 1 avait préparé. Deux morceaux, en revanche, sont taillés pour GitHub seul
et doivent être généralisés **une fois** :

- **`github_accounts`** — table d'identité tierce à un seul fournisseur (un `user_id` unique, une
  colonne `github_user_id`, pas de rafraîchissement). Elle doit devenir une table générique portant
  le nom du fournisseur, avec `refresh_token` et date d'expiration (§7.4).
- **`RepoPicker` et `/api/github/repos`** — l'écran de sélection et sa route. Le contrat de
  connecteur prévoit déjà `listCandidates`, il manque la route et l'écran génériques qui s'appuient
  dessus.

Après ça, chaque fournisseur est un petit module : un client HTTP, un adaptateur OAuth, une
implémentation de `SourceConnector`. Le gros du travail est dans la généralisation, pas dans les
quatre connecteurs.

### Décision — Notion et Linear d'abord (arbitrée le 2026-09-09)

Ce n'est plus un arbitrage de confort, c'est une contrainte externe : **Etsy et Shopify sont tous
deux bloqués derrière une validation manuelle de la plateforme** (§10), sur des délais qu'on ne
maîtrise pas. Notion et Linear n'ont aucune barrière de ce type.

L'ordre est donc :

1. la généralisation (§8) + **Notion** + **Linear**, testables le jour même ;
2. **Etsy** et **Shopify**, quand leurs validations sont obtenues.

Les démarches d'Etsy et de Shopify se lancent **en parallèle** de l'étape 1, pas après : ce sont
elles le chemin critique. Elles sont détaillées dans `docs/DEMANDES_ETSY_SHOPIFY.md`.

## 9. Ce qui ne change pas

- **Une verticale n'ajoute pas de table.** Le spécifique de chaque fournisseur passe par
  `materialSources.config` (jsonb) — domaine de boutique Shopify, identifiant de base Notion.
  Règle du chantier 4, gardée par `src/db/schemaInvariants.test.ts`.
- **La synchronisation reste générique.** Le diff, l'écriture des documents miroir, la gestion de
  statut et le `markStaleForMaterialIngestion` restent dans `sourceConnectorService` ; un connecteur
  ne connaît que sa source.
- **Un connecteur a le droit d'avoir sa route et son écran de sélection**, pas sa logique de
  synchronisation.

## 10. Ce que les API permettent réellement

Vérifié le 2026-09-09 contre la documentation des quatre plateformes. Cette section remplace la
liste de doutes de la version précédente du document.

### Etsy — techniquement bon, commercialement verrouillé

- **Le découpage en sections tient.** `getShopSections` est en production, et
  `getListingsByShopSectionId` (`GET /v3/application/shops/{shop_id}/shop-sections/listings`) rend
  les articles d'une section. Limite connue : cet endpoint ne prend pas de paramètre d'état, il ne
  rend que les articles actifs — pour les inactifs il faut passer par `getListingsByShop`.
- **PKCE obligatoire** sur chaque autorisation, code verifier de 43 à 128 caractères.
- **Jeton d'accès : 1 heure.** Jeton de rafraîchissement : 90 jours.
- **Trois paliers d'accès, deux revues manuelles.** *Seller App* (sa propre boutique, approbation
  quasi immédiate, usage commercial interdit) → *Personal App* (revue approfondie, échelle limitée)
  → *Commercial Access* (multi-vendeurs par consentement OAuth, **exige une Personal App déjà
  approuvée puis une revue commerciale séparée**). Au palier personnel, le plafond est de **5
  boutiques au total** — pas 5 par utilisateur.

C'est ce dernier point qui bloque : un SaaS qui sert des vendeurs quelconques a besoin du
*Commercial Access*, donc de deux validations successives.

### Shopify — aucune échappatoire à la revue

- **Compte Partner obligatoire** dans tous les cas.
- **Distribution publique** — installable par n'importe quel marchand, **soumise à la revue de
  l'App Store**. Nombre de boutiques illimité.
- **Distribution custom** — pas de revue, mais **une seule boutique** (ou les boutiques d'une même
  organisation Plus), par lien d'installation.
- **L'app « non listée » n'est pas une échappatoire** : elle a toujours une page de listing, avec
  une visibilité réduite, et passe la même revue. L'ancien mécanisme d'*unpublished app*, qui
  permettait l'installation sans approbation, est **supprimé depuis le 9 décembre 2019**.
- **Identité** : le jeton *online* renvoie `associated_user` avec `email` et `email_verified`.
- **Depuis avril 2026, toute nouvelle app publique doit être bâtie exclusivement sur l'API GraphQL
  Admin** — l'API REST Admin est en fin de vie. Le client Shopify de ce repo devra donc être
  GraphQL d'emblée.

### Notion — rien ne bloque

- L'échange de jeton renvoie `owner.user.person.email` avec son statut de vérification, plus
  `workspace_id`, `workspace_name` et `bot_id`.
- Renvoie aussi un **jeton de rafraîchissement** : le jeton d'accès expire.
- Aucune revue préalable pour qu'une intégration publique soit autorisée par des tiers.
- Rappel de conception : une intégration ne voit que ce qui lui a été **explicitement partagé** (§4).

### Linear — rien ne bloque

- Scopes : `read` (toujours présent), `write`, `issues:create`, `comments:create`,
  `timeSchedule:write`, `admin`. `read` suffit ici.
- `viewer { id name email }` donne l'identité.
- **Jeton d'accès valide 24 heures**, à rafraîchir.
- Aucune revue préalable.

### Sources

- Etsy — [authentification et scopes](https://developers.etsy.com/documentation/essentials/authentication),
  [paliers d'accès et revue commerciale](https://vorplabs.com/agent-tools/etsy-api),
  [sections de boutique](https://github.com/gordonturner/etsy-open-api-client/blob/main/docs/ShopSectionApi.md)
- Shopify — [choisir un mode de distribution](https://shopify.dev/docs/apps/launch/distribution/select-distribution-method),
  [jetons d'accès](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens),
  [visibilité du listing](https://shopify.dev/docs/apps/launch/distribution/visibility)
- Notion — [échange de jeton](https://developers.notion.com/reference/create-a-token)
- Linear — [OAuth 2.0](https://linear.app/developers/oauth-2-0-authentication),
  [API GraphQL](https://linear.app/developers/graphql)

## 11. Décisions

| # | Point | État |
|---|---|---|
| 1 | §6 — découpage en sujets d'Etsy et Shopify | **tranché** : la section, la collection |
| 2 | §8 — ordre de livraison | **tranché** : Notion et Linear d'abord, contrainte externe |
| 3 | §7.2 — nouvelles valeurs de verticale | **tranché** : `artisan` et `entrepreneur` ajoutées, même parcours |

### Ce qui est fait

Notion et Linear sont implémentés (plan : `docs/superpowers/plans/2026-09-09-connecteurs-notion-linear.md`).
Migration `0028` écrite à la main, appliquée et vérifiée en base de dev — la ligne GitHub existante
a survécu avec `provider = 'github'`, ce qui prouve un renommage et non un `DROP` suivi d'un
`CREATE`.

Ce que le cadrage n'avait pas vu, et qui vaut d'être noté pour Etsy et Shopify :

- **le contrat de connecteur a dû s'élargir** de deux champs optionnels, `candidateHint` et
  `picker` — les textes qu'un écran de sélection générique ne peut pas inventer. Portés par le
  connecteur pour la même raison que `emptyMessage` : ils parlent de SA source ;
- **`ConnectorCandidate<Meta>` exige un alias de type, pas une `interface`.** Seul un alias porte la
  signature d'index implicite qui le rend assignable au `Record<string, unknown>` du registre. Le
  piège se voit à la compilation, pas à la relecture ;
- **la verticale ne suffit pas à choisir le sélecteur**, puisque `dev` couvre GitHub et Linear.
  C'est `connectedProviders` qui décide. Le §7.2 le pressentait, l'implémentation l'a confirmé.

Reste à vérifier manuellement, avec de vraies clés : le trajet OAuth complet des deux fournisseurs,
et le rafraîchissement du token Linear après 24 h (liste complète en fin de plan).

## 12. Documents liés

- `docs/DEMANDES_ETSY_SHOPIFY.md` — les démarches à mener auprès des deux plateformes pour ne pas
  rester plafonné.
- `docs/superpowers/plans/2026-09-09-connecteurs-notion-linear.md` — le plan d'implémentation de
  l'étape 1.
