# Feature : Suggestions de hooks tendance par secteur

**Statut : brouillon en cours — section 1 validée, sections suivantes à définir.**

## Contexte

Idée initiale : proposer à l'utilisateur des hooks (accroches) actuellement tendance dans son
secteur d'activité au moment de générer un script (ex. le hook "Day X building something" qui
fonctionne bien en ce moment sur les posts dev).

## Décisions déjà validées avec l'utilisateur

1. **Pas de veille manuelle** — mauvaise UX. La recherche de trends doit être automatisée.
2. **Intégration UX** : liste de hooks proposée **avant génération** — l'utilisateur en choisit un
   (ou laisse l'IA choisir) avant que le script parte en génération. (Pas de suggestion a
   posteriori sous un script déjà généré — option écartée.)
3. **Fraîcheur des données** : liste **pré-calculée par secteur**, rafraîchie périodiquement et
   **mutualisée entre utilisateurs du même secteur** — pas de recherche web en direct à chaque
   ouverture d'écran (trop lent/cher).

## Section 1 — Vue d'ensemble du flux (proposée, en attente de confirmation finale)

- **Normalisation du secteur** : `creatorProfiles.activityType` est du texte libre aujourd'hui
  ("coach sportif", "coaching fitness", etc.). Pour que la mutualisation par secteur ait un sens,
  il faut le faire correspondre à une clé canonique (`sectorKey`). Proposition : une étape de
  classification LLM (même pattern que `callStructured`) exécutée une fois — à la finalisation de
  l'onboarding, ou paresseusement à la première demande de trends si le champ est vide — qui
  stocke le résultat sur un nouveau champ `creatorProfiles.sectorKey`.
  - Alternative plus simple (moins recommandée) : utiliser directement le texte brut
    `activityType` comme clé de cache. Beaucoup moins de mutualisation (peu de strings identiques
    mot pour mot), mais zéro travail de classification.
- **Recherche + extraction en 2 appels** :
  1. Appel LLM avec recherche web activée (grounding Gemini — déjà provider par défaut, quota
     gratuit) pour rassembler les tendances actuelles de hooks dans le secteur.
  2. Appel `callStructured` classique qui transforme cette réponse libre en liste structurée de
     hooks (label, description courte, exemple d'application).
  - Aucun provider n'a de recherche web branchée aujourd'hui dans `src/lib/llm` — c'est du travail
    neuf. `callStructured` ne fait que du JSON structuré, pas de grounding — d'où le découpage en
    2 appels plutôt que d'essayer de forcer recherche web + sortie structurée en un seul.
- **Cache + fraîcheur** : nouvelle table `sectorTrends` (sectorKey, hooks, `fetchedAt`). Au
  chargement de l'écran de génération, vérifier la fraîcheur (ex. > 7 jours) et déclencher un
  rafraîchissement **paresseux** si besoin.
  - **Important** : il n'y a **aucune infra cron dans ce repo**. Le pattern existant pour "rafraîchir
    périodiquement" est un déclenchement paresseux au montage de page — voir
    `src/app/api/performance/refresh/route.ts` (§7.5 de `docs/SPEC_METRIQUES_AUTO.md`), qui vérifie
    s'il faut rafraîchir plutôt que de dépendre d'un job planifié externe. À reprendre à l'identique
    pour rester cohérent avec le reste du code.
- **Intégration génération** : le hook choisi (ou "laisser l'IA choisir") est injecté dans le
  prompt de génération de script, comme `styleProfile.summary` l'est déjà aujourd'hui
  (`src/lib/llm/prompts.ts` → `buildScriptUserMessage`).

## Reste à définir avant plan d'implémentation

- Détail du schéma `sectorTrends` (jsonb vs lignes séparées par hook, champs exacts)
- Gestion des cas limites : secteur jamais vu (cold start, aucun cache) → recherche synchrone à la
  volée avec état de chargement, puis mise en cache pour la prochaine fois
- Gestion d'erreur si la recherche web échoue (fallback : pas de suggestion, génération classique)
- Tests
- Emplacement exact de l'UI (quel écran/composant affiche la liste de hooks avant génération —
  `GenerateForm.tsx` / `GenerateScriptModal.tsx` à examiner)

## État d'avancement de la conversation

Discussion mise en pause ici pour traiter l'autre feature (apprentissage du style d'écriture via
les éditions/commentaires de l'utilisateur sur les scripts). À reprendre ensuite.
