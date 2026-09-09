# Architecture — un cœur, plusieurs verticales

Statut : décision prise le 2026-09-09. Chantiers 1 et 2 implémentés, 3 et 4 à faire.

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
| 3 | `users.onboardingTrack` → `users.vertical` | à faire |
| 4 | Règle : une verticale n'ajoute pas de table | ⚠️ règle à tenir |

### Chantier 1 — Registre de connecteurs

`materialSources` était déjà une bonne abstraction (`type` + `config` jsonb + `externalId` +
`syncCursor`), mais son unique implémentation avait le nom du provider dans le nom du module.

```
src/lib/connectors/
  types.ts       — le contrat SourceConnector
  github.ts      — l'implémentation GitHub
  registry.ts    — type de source → connecteur
src/lib/services/sourceConnectorService.ts   (ex-githubSourceService)
```

Le contrat :

```ts
interface SourceConnector<Meta> {
  type: MaterialSourceType;
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

Ajouter Notion : écrire `src/lib/connectors/notion.ts`, l'enregistrer dans le registre, ajouter la
valeur à `materialSourceTypeEnum`. Aucun fichier du cœur à modifier.

### Chantier 2 — Onboarding déclaratif

`src/app/onboarding/page.tsx` branchait sur `track === "dev"` à six endroits : rendu de chaque
étape, garde de validation, avancement après le chat, affichage du bouton « Continuer », libellés
d'onglets. C'est ce coût-là qui explose à la troisième verticale.

```
src/lib/verticals/
  types.ts       — VerticalId, OnboardingStep, OnboardingStepContext
  shared.tsx     — les étapes fournies par le cœur (réseaux sociaux)
  creator.tsx    — parcours créateur
  dev.tsx        — parcours développeur
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

Contrainte à respecter : `src/lib/verticals/` est du code **client** (il rend du JSX). Il ne doit
jamais importer de module serveur — c'est pourquoi `buildDevOnboardingContext`, qui lit la base,
vit dans `src/lib/services/devOnboardingContext.ts` et non dans `verticals/dev.tsx`. La verticale
dev est donc à cheval sur deux dossiers ; c'est assumé tant qu'il n'y en a qu'une.

Ajouter une verticale : écrire son module d'étapes, l'enregistrer. La page ne bouge pas.

### Chantier 3 — `onboardingTrack` → `vertical`

Le nom ment déjà : la colonne pilote autre chose que l'onboarding (le prompt de chat, et demain le
choix du connecteur). Renommage `users.onboarding_track` → `users.vertical`, avec migration.
Reporté pour garder les chantiers 1 et 2 relisibles isolément.

### Chantier 4 — Une verticale n'ajoute pas de table

**Un seul schéma Drizzle, toujours.** Les spécificités d'une verticale passent par
`materialSources.config` (jsonb). Deux jeux de migrations divergents sont le vrai point de
non-retour : c'est ce qui transformerait l'option A en option C sans qu'on l'ait décidé.

## 5. Garde-fou

Il n'existe aujourd'hui **qu'une** verticale réelle (dev) et une demi (creator). Une abstraction
dessinée pour trois cas dont deux sont hypothétiques se trompe presque toujours. Les chantiers 1 et
2 sont sûrs parce qu'ils nettoient du code existant, à comportement constant. Le reste — écrans
propres par verticale, tools d'assistant par verticale, pricing — se construira **en écrivant la
deuxième verticale**, pas avant.
