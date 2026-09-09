# Architecture — un cœur, plusieurs verticales

Statut : décision prise le 2026-09-09. Les quatre chantiers sont faits ; le 4 reste une règle
permanente, mais elle est désormais gardée par un test.

## 1. Le problème

CreaFlow doit pouvoir décliner l'app de base en plusieurs produits adressant des métiers
différents — développeur (GitHub), artisan (Etsy/Shopify), entrepreneur (Notion) — sans que le
cœur cesse d'évoluer pour tout le monde, et sans dupliquer le code.

## 2. Ce qui distingue réellement une verticale

Constat contre-intuitif, et c'est lui qui dimensionne tout le reste : **le cœur est déjà
persona-agnostique sur le plan éditorial**. Les rôles (`src/lib/llm/categoryLabels.ts`) et les
séries (`src/lib/llm/seriesLabels.ts`) ne sont pas codés en dur : ils sont demandés au LLM à
partir du métier décrit par l'utilisateur. Un artisan obtient déjà des rôles d'artisan.

Ce qui distingue une verticale se réduit donc à quatre choses :

1. **le connecteur de matière** — GitHub, Etsy, Notion : d'où vient le corpus ;
2. **le parcours d'onboarding** — quelles étapes, dans quel ordre ;
3. **l'identité tierce** — GitHub sert d'authentification, pas seulement de source ;
4. **d'éventuels écrans propres** — aujourd'hui : aucun.

Corollaire : « artisan » et « entrepreneur » ne sont peut-être pas des verticales du tout, juste
des profils avec un connecteur différent. Tant que ça reste vrai, un registre de connecteurs et un
onboarding déclaratif suffisent — pas besoin d'apps dérivées.

## 3. Les options

Deux questions indépendantes, souvent confondues : **combien de déploiements** et **combien de
dépôts**.

### A. Registre runtime — 1 dépôt, 1 déploiement *(retenue)*

Le cœur définit des points d'extension typés. Chaque verticale est un module qui s'y enregistre.
La verticale est choisie **par utilisateur**, en base. Le cœur évolue pour tout le monde d'un coup.

- Coût faible.
- Permet à un même compte de cumuler plusieurs verticales (dev + Notion).
- Limite : une seule marque, un seul domaine, un seul pricing.

### B. Monorepo — 1 dépôt, N déploiements

`packages/core` + `apps/dev`, `apps/artisan`. Chaque app importe le cœur, avec son domaine, son
branding, ses prix.

- Coût moyen : build, CI, migrations partagées à orchestrer.
- Débloque les marques et les prix séparés.

### C. Fork depuis un template — N dépôts *(écartée)*

Trois mois après, le cœur ne peut plus évoluer : chaque amélioration doit être cherry-pickée dans
N forks qui ont divergé.

### Décision

**A maintenant, B seulement le jour où le business l'exige.** Le critère de bascule n'est pas
technique : c'est « CreaFlow pour développeurs » est-il un produit séparé (domaine, prix, page
d'accueil) ou un mode de CreaFlow ? Produit séparé → B. Mode → A.

A ne ferme pas B : un registre propre est exactement ce qui rend l'extraction en `packages/core`
faisable plus tard. L'inverse n'est pas vrai.

## 4. Les quatre chantiers

| # | Chantier | Statut |
|---|---|---|
| 1 | Registre de connecteurs de matière | ✅ fait |
| 2 | Onboarding déclaratif par verticale | ✅ fait |
| 3 | `users.onboardingTrack` → `users.vertical` | ✅ fait |
| 4 | Règle : une verticale n'ajoute pas de table | ✅ gardée par un test |

### Chantier 1 — Registre de connecteurs

`materialSources` était déjà une bonne abstraction (`type` + `config` jsonb + `externalId` +
`syncCursor`), mais son unique implémentation avait le nom du provider dans le nom du module.

```
src/lib/connectors/
  types.ts          — le contrat SourceConnector
  errors.ts         — ConnectorRateLimitError, dont héritent les erreurs de quota
  github.ts         — l'implémentation GitHub
  githubMapping.ts  — traductions dépôt ↔ candidat, pures et testées à part
  registry.ts       — type de source → connecteur
src/lib/services/sourceConnectorService.ts   (ex-githubSourceService)
```

Le contrat :

```ts
interface SourceConnector<Meta> {
  type: MaterialSourceType;
  displayName: string;                                          // "GitHub" — remonté par l'API
  assertReady(userId): Promise<void>;                           // échoue AVANT de créer des sujets
  listCandidates(userId): Promise<ConnectorCandidate<Meta>[]>;  // ce qu'on peut brancher
  fetchDocuments(userId, source): Promise<FetchedDocuments>;    // ce que la source produit
  isAuthError(error): boolean;                                  // → status "needs_reconnect"
  emptyMessage: string;                                         // portés par lastError,
  truncatedMessage: string;                                     // formulés par le connecteur
}
```

`syncSource` et `createSourcesFromCandidates` ne mentionnent plus GitHub : ils résolvent le
connecteur depuis `source.type` et délèguent. Le diff, l'écriture des documents miroir, la mise à
jour du statut et le `markStaleForMaterialIngestion` restent dans le service — c'est le cœur.

Ce qui reste GitHub, et c'est normal : `src/lib/github/` (client HTTP, sélection des `.md`, journal
de commits), la route `/api/github/repos`, et `RepoPicker`. Un connecteur a le droit d'avoir sa
route et son UI de sélection ; il ne doit pas avoir sa logique de synchronisation.

`displayName` existe pour une raison précise : `ConnectedSources` affichait « accès perdu,
reconnecte GitHub » en dur dans un composant censé être générique. L'API renvoie désormais
`connectorLabel` avec chaque source, et l'UI n'a plus à déduire le fournisseur de `type`.

Ajouter Notion : écrire `src/lib/connectors/notion.ts`, l'enregistrer dans le registre, ajouter la
valeur à `materialSourceTypeEnum`. Aucun fichier du cœur à modifier.

**Fait le 2026-09-09** (Notion et Linear, `docs/SPEC_CONNECTEURS_ET_SUJETS.md`), et la prédiction
tenait pour la partie matière : les deux connecteurs se sont écrits sans toucher à `syncSource` ni
à `createSourcesFromCandidates`. Ce que le chantier 1 n'avait PAS prévu, en revanche :

- **l'identité.** Ces fournisseurs ne sont pas que des sources, ce sont des portes d'entrée. Il a
  fallu généraliser `github_accounts` en `oauth_accounts` et écrire un contrat
  `OAuthIdentityProvider` à côté de `SourceConnector` — deux rôles distincts, deux registres.
- **l'expiration des tokens.** GitHub était l'exception, pas la règle : son token ne périme jamais,
  ceux de Notion et Linear si (24 h côté Linear). Le rafraîchissement paresseux est devenu de la
  plomberie obligatoire.
- **l'écran de sélection.** `listCandidates` existait, mais aucune route ni écran générique ne s'y
  adossait. `RepoPicker` restant en place pour GitHub, il a fallu écrire `SourcePicker` et
  `/api/connectors/[provider]/candidates` à côté.

Le contrat gagne au passage `candidateHint` et `picker`, tous deux optionnels : ce sont les textes
qu'un écran générique ne peut pas inventer, portés par le connecteur pour la même raison que
`emptyMessage`.

### Chantier 2 — Onboarding déclaratif

`src/app/onboarding/page.tsx` branchait sur `track === "dev"` à six endroits : rendu de chaque
étape, garde de validation, avancement après le chat, affichage du bouton « Continuer », libellés
d'onglets. C'est ce coût-là qui explose à la troisième verticale.

```
src/lib/verticals/
  types.ts       — VerticalId, OnboardingStep, OnboardingStepContext
  shared.tsx     — les étapes fournies par le cœur (réseaux sociaux)
  creator.tsx    — parcours créateur
  sourceFirst.tsx — fabrique du parcours « source d'abord » (ex-dev.tsx), partagée par les
                    verticales nées d'un fournisseur d'identité tiers
  registry.ts    — VerticalId → VerticalDefinition
```

Une verticale déclare une liste ordonnée d'étapes :

```ts
interface OnboardingStep {
  id: string;
  label: string;                       // onglet, sans numéro — la page numérote
  title: string;
  intro: ReactNode;
  selfAdvancing?: boolean;             // l'étape porte son déclencheur : pas de « Continuer »
  validate?: (ctx) => string | null;   // message bloquant
  render: (ctx) => ReactNode;
}
```

La page ne connaît plus aucune verticale : elle lit `getVertical(track).onboarding`, rend
`steps[step - 1]`, et dérive de `steps.length` la barre de progression, les onglets et le libellé
du bouton final. `handleChatComplete` — qui valait `setStep(track === "dev" ? 3 : 2)` — devient
`ctx.advance()`, parce que dans les deux parcours ça voulait dire « l'étape suivante ».

Le contexte passé aux étapes est délibérément minuscule (`advance`, `connections`, `productCount`,
`onProductCountChange`) : tout état propre à une étape vit dans son composant. La saisie d'identité
créateur (chat + formulaire de repli) est devenue
`src/components/onboarding/CreatorIdentityStep.tsx`, qui possède ses six champs et son
enregistrement. Seule conséquence visible : en mode formulaire de repli, le bouton « Continuer »
est dans la carte plutôt que dans le pied de page.

Une verticale a deux registres, et il faut savoir lequel on touche :

- **`registry.ts` est client** — il rend du JSX. Il ne doit jamais importer de module serveur.
- **`server.ts` est serveur** — il lit la base. Il ne doit jamais être importé d'un composant, et
  ne doit pas importer `registry.ts`, ce qui tirerait l'arbre React dans le bundle serveur.

`server.ts` porte ce qui était le dernier branchement en dur sur la verticale : la route
`/api/onboarding/chat` choisissait le prompt avec un `vertical === "dev"`. Chaque verticale déclare
maintenant son tour de chat et le contexte qu'elle y injecte ; le contrat de sortie étant identique,
tout ce qui suit dans la route (fusion du profil, finalisation, persistance) ne les distingue pas.

`buildConnectedOnboardingContext`, qui lit la base, vit pour la même raison dans
`src/lib/services/connectedOnboardingContext.ts` et non dans `verticals/sourceFirst.tsx`.

Ajouter une verticale : écrire son module d'étapes, l'enregistrer. La page ne bouge pas.

**Vérifié le 2026-09-09** : l'ajout d'`artisan` et d'`entrepreneur` n'a effectivement pas touché
`src/app/onboarding/page.tsx` — hors une ligne, l'ajout de `connectedProvider` au contexte d'étape.

Ce point-là mérite d'être retenu, parce qu'il corrige une intuition du §2 : **la verticale ne suffit
pas à choisir le connecteur**. `dev` couvre GitHub et Linear ; c'est le fournisseur réellement
connecté (`oauth_accounts.provider`, remonté par `GET /api/profile`) qui décide du sélecteur. La
verticale choisit le parcours, pas la source.

Et les trois verticales issues d'un fournisseur tiers pointent délibérément vers la **même**
fabrique d'étapes (`sourceFirstVertical`) : écrire trois jeux de textes avant d'avoir un utilisateur
de chaque métier serait exactement l'abstraction devinée que le §5 met en garde contre.

### Chantier 3 — `onboardingTrack` → `vertical`

Le nom mentait : la colonne pilote autre chose que l'onboarding (le prompt de chat, et demain le
choix du connecteur). Renommés ensemble, le type enum PostgreSQL et la colonne :
`onboarding_track` → `vertical`.

Deux choses à savoir pour le prochain renommage dans ce dépôt, parce qu'aucune migration n'en
contenait avant celle-ci :

- **`drizzle-kit generate` exige un TTY** pour demander « renommage, ou drop puis create ? ». Il
  échoue franchement dans un shell non interactif — donc pas de migration générée en CI ni depuis
  un agent. Il faut la lancer à la main, ou écrire la migration soi-même.
- La migration `0027` a donc été **écrite à la main** (SQL, snapshot et entrée de journal). La
  vérification qui compte : relancer `npm run db:generate` ensuite doit répondre « No schema
  changes, nothing to migrate ». Si le snapshot écrit à la main divergeait du schéma, c'est la
  migration SUIVANTE qui partirait en vrille, pas celle-ci.

Le choix d'une migration de renommage plutôt que de corriger `0026` — qui crée la colonne, et que
`CLAUDE.md` annonçait comme jamais appliquée — s'est révélé être le bon : **`0026` était en fait
déjà appliquée** sur la base de dev. Réécrire une migration commitée n'est sûr que si elle n'a été
appliquée nulle part ; ici, la base aurait divergé en silence. Leçon générale : un `ALTER ...
RENAME` est correct que la migration précédente ait été appliquée ou non, l'édition en place ne
l'est que dans un cas — et l'annotation « pas encore appliquée » d'un document n'est pas une
vérification.

Vérifié en base après `npm run db:migrate` : colonne `vertical` de type `vertical`, ancien nom et
ancien type disparus, et l'utilisateur `dev` existant toujours `dev` — c'est ce dernier point qui
prouve un vrai renommage plutôt qu'un `DROP` suivi d'un `ADD`, qui l'aurait remis au défaut.

### Chantier 4 — Une verticale n'ajoute pas de table

**Un seul schéma Drizzle, toujours.** Les spécificités d'une verticale passent par
`materialSources.config` (jsonb). Deux jeux de migrations divergents sont le vrai point de
non-retour : c'est ce qui transformerait l'option A en option C sans qu'on l'ait décidé.

Une règle qui ne vit que dans un document se fait enfreindre, et celle-ci ne se voit pas dans une
revue ligne à ligne — ajouter une colonne `vertical` à une table paraît anodin. Elle est donc
posée à deux endroits en plus d'ici :

- **`src/db/schemaInvariants.test.ts`**, qui introspecte le schéma Drizzle et vérifie que le type
  enum `vertical` n'est porté que par `users.vertical`, et que `materialSources.config` reste un
  `jsonb` ;
- **`src/db/schema.ts`**, en commentaire au point de tentation : sur `verticalEnum` et sur
  `config`, c'est-à-dire sous les yeux de qui s'apprêterait à enfreindre la règle.

Ce que le test NE peut pas dire : si une nouvelle table est « spécifique à une verticale ». La
frontière est un jugement — `oauth_accounts` est légitime, parce que c'est une table d'identité
tierce (§2, point 3), pas une table de verticale. Le test attrape la dérive mécanique ; la revue
garde le jugement.

Et c'est bien une SEULE table pour tous les fournisseurs, pas une par verticale : c'est ce qui a
permis d'ajouter Notion et Linear sans migration structurelle au-delà du renommage.

## 5. Garde-fou

Il n'existe aujourd'hui **qu'une** verticale réelle (dev) et une demi (creator). Une abstraction
dessinée pour trois cas dont deux sont hypothétiques se trompe presque toujours. Les chantiers 1 et
2 sont sûrs parce qu'ils nettoient du code existant, à comportement constant. Le reste — écrans
propres par verticale, tools d'assistant par verticale, pricing — se construira **en écrivant la
deuxième verticale**, pas avant.
