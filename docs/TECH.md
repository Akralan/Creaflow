# SPEC TECHNIQUE — CREAFLOW (à jour)

> Remplace `SPEC_POC.md` (spec technique de la phase POC) comme référence à jour sur le scope technique. `SPEC_POC.md` reste dans le repo comme archive historique — ne pas le mettre à jour, c'est ce document-ci qui reflète le code actuel. Le positionnement produit est dans `PRODUCT.md` — ce fichier ne traite que du "comment".

---

## 1. Rappel du périmètre

- **Plateforme :** Web uniquement, usage desktop.
- **Modules livrés :** A (Onboarding conversationnel), B (Moteur d'Idées & Scripts, anti-répétition), D (Calendrier Intelligent), E (Direction éditoriale & Assistant IA).
- **Hors périmètre :** Module C (Matrice de Recyclage de Contenu).
- **Réseaux couverts :** voir `PRODUCT.md` §2.2 / `src/lib/social/types.ts`.

---

## 2. Stack & Infrastructure

- **Moteur IA :** provider pluggable — `gemini` (par défaut), `anthropic` ou `groq`, sélectionné par `LLM_PROVIDER`. Voir `src/lib/llm/provider.ts`. Chaque appel structuré est tenté une 2e fois avec un rappel explicite dans le system prompt si le modèle ne respecte pas le format d'appel d'outil (fréquent chez certains modèles via Groq).
- **Frontend :** React / Next.js (App Router), interface web desktop (pas de responsive mobile).
- **Backend :** API routes Next.js co-localisées avec le frontend, pas de backend séparé.
- **Principe de conception API :** les routes sont pensées **par vue UI**, pas par entité pure — chaque écran se charge avec le moins d'appels possible (endpoints agrégés avec jointures Drizzle plutôt qu'un appel par entité liée).
- **Base de données :** PostgreSQL, ORM Drizzle (`src/db/schema.ts`).
- **Authentification :** email / mot de passe (bcrypt), session via cookie JWT (`src/lib/auth/`). Chaque utilisateur a son propre espace.
- **Intégrations réseaux sociaux :** APIs officielles par plateforme (TikTok Login Kit, Instagram Graph API, LinkedIn API, YouTube Data API v3, X API v2) pour TikTok/Instagram/LinkedIn/YouTube/X (`hasOAuth: true` dans le registre de plateformes, `src/lib/social/types.ts`). Les autres plateformes du registre sont "suivies" sans mécanique OAuth. L'échec de récupération des posts après connexion (ex : accès API restreint sur LinkedIn) n'invalide pas la connexion déjà enregistrée. Refresh de token **lazy à l'usage** pour toute plateforme dont le provider expose `refreshToken()` (`src/lib/services/socialConnectionService.ts`, calqué sur le pattern déjà utilisé pour Google Drive) — aucun cron n'existe dans ce repo. LinkedIn (métriques) et X (OAuth PKCE + métriques) sont posés côté code mais non activables en pratique : validation d'accès externe pour l'un, ouverture d'un compte de facturation pour l'autre — voir `docs/SPEC_METRIQUES_AUTO.md` §2.4/§2.5.

---

## 3. Modèle de données

```
User
- id, email, passwordHash, createdAt

OnboardingSession (1:1 avec User)
- id, userId
- messages (jsonb — historique complet du chat d'onboarding)
- extractedProfile (jsonb, nullable — champs de profil déduits au fil de la conversation)
- status (in_progress / complete)
- createdAt, updatedAt

AssistantSession (1:1 avec User)
- id, userId
- messages (jsonb — historique du chat assistant éditorial)
- createdAt, updatedAt

AssistantProposal (une ligne par proposition émise par l'assistant)
- id, userId
- kind (product_create / product_update / series_create / series_update /
        category_create / category_update / angle_create / angle_update / posting_goal_update /
        category_reweight)
- targetId (nullable — id de l'entité ciblée si action="update", pas de FK typée : la cible dépend de `kind`.
  Toujours null pour category_reweight, qui porte plusieurs catégories dans son payload, comme posting_goal_update.)
- payload (jsonb — contenu de la proposition)
- status (pending / accepted / rejected)
- createdAt, resolvedAt

Toutes les propositions sont générées par le LLM (`runAssistantChatTurnForUser`) sauf
category_reweight, produite par un calcul déterministe (`categoryReweightService.ts`, voir §5.7)
— même principe d'application que les autres : jamais automatique, toujours via
`POST /api/assistant/proposals/:id/resolve`.

CreatorProfile (1:1 avec User)
- id, userId
- brandName, activityType, tone, values (texte libre)
- equipment (array texte)
- weeklyTimeAvailable
- styleProfile (jsonb, nullable — résumé de style généré par IA à partir des InspirationVideo)
- styleProfileUpdatedAt

ContentCategory (rôle éditorial, ex: promotionnel / coulisses / éducatif — personnalisé par IA par utilisateur)
- id, userId
- label, description
- weight (int — % cible, normalisé à 100 sur l'ensemble des catégories actives d'un utilisateur)
- archived (bool)
- createdAt

ContentAngle (archétype de structure/hook réutilisable — bibliothèque anti-répétition)
- id, userId
- label, description
- archived (bool)
- createdAt

ContentSeries ("Direction" — format récurrent nommé, ex: "Le mythe du mercredi")
- id, userId
- label, description
- weight (int — % ABSOLU des créneaux, PAS normalisé à 100 comme ContentCategory.weight :
  la couverture série n'est jamais forcée à 100%, une partie du calendrier reste hors série)
- archived (bool)
- createdAt

ContentSeriesCategories (jointure N:N série ↔ catégories auxquelles elle appartient)
ContentCategoriesPlatforms (ciblage plateforme d'une catégorie — absence de ligne = toutes plateformes)
ContentSeriesPlatforms (ciblage plateforme d'une série — absence de ligne = toutes plateformes)

Product (catalogue, 3 à 5 par créateur — MIN_PRODUCTS/MAX_PRODUCTS dans src/lib/validation.ts)
- id, userId
- name, description, valueProposition, photoUrl

SocialConnection (OAuth par plateforme — tiktok/instagram/linkedin/youtube/x)
- id, userId
- platform, accessToken, refreshToken, platformUserId, connectedAt
- accessTokenExpiresAt (nullable — expiration inconnue/non exploitable pour certaines plateformes,
  ex. long-lived token Instagram ; dans ce cas pas de refresh proactif possible)
- status (ok / needs_reconnect — bascule needs_reconnect si le refresh échoue)
- lastMetricsFetchAt (nullable — repère de cadence, sert à la dédup 24h sur X)

InspirationVideo (posts récents récupérés après connexion OAuth, pour l'analyse de style)
- id, userId, platform
- externalUrl, captionText, metadata (jsonb), fetchedAt

PostMatchCandidate (rattachement post↔script en attente de confirmation — docs/SPEC_METRIQUES_AUTO.md §4)
- id, userId, scriptId (FK ON DELETE CASCADE)
- platform, platformPostId, externalUrl, captionText (nullable), publishedAt (nullable)
- score (real — score heuristique de matching, cf. §5.7)
- metrics (jsonb — {views, likes, comments, shares} capturées au moment du scan, évite un second
  appel API à la confirmation)
- status (pending / confirmed / dismissed — définitif dans les deux derniers cas, jamais reproposé)
- createdAt, resolvedAt
- contrainte unique (platform, platformPostId)

Script (fiche générée — Module B)
- id, userId
- productId (nullable, FK ON DELETE SET NULL)
- platform
- title, hookVisual, hookText, hookAudio (nullable — pertinents selon contentType)
- storyboard (jsonb, nullable — liste de {planNumber, description})
- caption, hashtags (array), soundRecommendation (nullable)
- contentCategoryId (FK NOT NULL vers ContentCategory)
- angleId (FK nullable, ON DELETE SET NULL vers ContentAngle — angle imposé par l'anti-répétition)
- seriesId (FK nullable, ON DELETE SET NULL vers ContentSeries)
- contentType (video / visual / text, défaut "video")
- status (draft / planned / shot / published)
- createdAt

ScriptGenerationEvent (une ligne par génération OU régénération — jamais mise à jour, jamais lue
ailleurs que par le quota de facturation)
- id, userId (FK ON DELETE CASCADE), scriptId (FK ON DELETE CASCADE vers Script)
- createdAt
Distincte de `Script.createdAt`, qui ne bouge jamais sur une régénération (mise à jour en place de
la même ligne) — voir §6.

PostMetrics (1:1 avec Script — vue courante, manuelle ou automatique)
- id, scriptId (unique, FK ON DELETE CASCADE)
- views, likes, comments, shares (int, défaut 0)
- source (manual / api — la re-pondération automatique ne considère jamais "manual")
- platformPostId (nullable — clé de rattachement, renseignée seulement en source="api")
- fetchedAt (nullable — date du dernier fetch API réussi)
- updatedAt

PostMetricsSnapshot (historique daté, jamais écrasé — résout l'absence d'historique de PostMetrics)
- id, scriptId (FK ON DELETE CASCADE)
- views, likes, comments, shares (int, défaut 0)
- source (manual / api)
- capturedAt

PostingGoal (objectif hebdo par plateforme — Module D)
- id, userId, platform, targetCountPerWeek (real)

CalendarEntry (Module D)
- id, userId
- scriptId (nullable, FK ON DELETE SET NULL)
- platform, scheduledDate
- contentCategoryId (FK NOT NULL vers ContentCategory)
- seriesId (FK nullable, ON DELETE SET NULL vers ContentSeries)
- status (planned / shot / published)
- reminderSent (bool — colonne présente, mécanisme de rappel non implémenté)
```

### Relation Script ↔ CalendarEntry

Les deux entités sont indépendantes mais reliées par `CalendarEntry.scriptId` (nullable) :

- **Flux principal (mis en avant dans l'UX) :** le calendrier auto-génère des créneaux typés (catégorie + éventuellement série) sans script. L'utilisateur déclenche la génération du script depuis le créneau (`POST /api/scripts/generate`), qui vient remplir `scriptId`.
- **Flux secondaire :** un script peut être généré librement via le Module B sans créneau (`POST /api/scripts`, avec `scheduledDate` optionnel pour le placer directement), ou un script déjà généré non planifié peut être attaché à une date après coup (`POST /api/calendar`).

Aucune contrainte `NOT NULL` ne force l'un ou l'autre sens.

### Invariant de poids : ContentCategory vs ContentSeries

- `ContentCategory.weight` est **normalisé à 100** sur l'ensemble des catégories actives d'un utilisateur (`normalizeCategoryWeights`, `renormalizeCategoryWeights` dans `src/lib/services/categoryLabelsService.ts` / `calendarService.ts`) : ajouter/modifier une catégorie réajuste automatiquement les autres.
- `ContentSeries.weight` est un **pourcentage absolu et indépendant** (0 à 60 par série côté génération IA, 0 à 100 en édition manuelle) : les séries actives "piquent" des créneaux sur le mix de catégories sans qu'aucune somme ne soit forcée à 100 — une partie du calendrier reste toujours hors série.

---

## 4. Vues UI & Endpoints associés

### Authentification
- `POST /api/auth/signup`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`.

### Onboarding (Module A) — chat conversationnel (`/onboarding`)
- `GET /api/onboarding/chat` — historique des messages + statut (`complete`).
- `POST /api/onboarding/chat` `{ message }` — envoie un message utilisateur, fait tourner l'IA (`runOnboardingChatTurn`), fusionne les champs extraits sur l'état accumulé (`mergeExtractedProfile` — n'écrase jamais un champ connu par une valeur vide), et **si `complete=true`**, déclenche automatiquement `finalizeOnboarding` : persiste `CreatorProfile`, génère catégories + angles + séries (si aucune n'existe déjà), crée les `PostingGoal` par défaut sur les plateformes suggérées. Un seul aller-retour.
- `GET/PUT/DELETE /api/products`, `/api/products/:id` — catalogue produits (3 à 5, bulk POST accepté).
- `GET /api/auth/:platform/connect` → redirection OAuth (state + returnTo en cookies httpOnly) ; `GET /api/auth/:platform/callback` → crée/rafraîchit la `SocialConnection`, récupère les posts récents (`InspirationVideo`), **puis déclenche automatiquement `updateStyleProfileForUser`** — aucun appel supplémentaire requis depuis le front. Un échec de récupération des posts n'invalide pas la connexion.
- `POST /api/profile/style-analysis` — force un recalcul manuel du `style_profile`.

### Direction éditoriale (Module E) — écran `/direction`
- `GET/POST /api/profile/content-categories` — `GET` liste les catégories actives ; `POST` avec corps régénère intégralement via IA (`generateCategoriesForUser`, archive l'ancien jeu actif) ; `POST` avec corps `{ categories: [...] }` valide et sauvegarde une édition manuelle (`saveCategoriesForUser`, poids renormalisés).
- `GET/POST /api/series` — même pattern pour les séries récurrentes (`generateSeriesForUser` / `saveSeriesForUser`), dépend des catégories déjà actives.
- Les angles n'ont pas d'endpoint dédié exposé séparément dans ce document — gérés via `src/lib/services/angleService.ts` (`generateAnglesForUser`, `upsertAngleItem`), appelés à l'onboarding et depuis l'écran Direction.
- `GET/POST /api/posting-goals` — objectifs de fréquence hebdomadaire par plateforme.

### Assistant éditorial (Module E) — écran `/assistant`
- `GET /api/assistant/chat` — historique des messages + propositions en attente.
- `POST /api/assistant/chat` `{ message, urls? }` (jusqu'à 3 URLs) — fait tourner l'IA (`runAssistantChatTurn`) avec en contexte l'état actuel complet (produits, catégories, angles, séries, objectifs) et le contenu des URLs fournies (`urlFetchService`) ; peut renvoyer jusqu'à 5 propositions par type (produit, catégorie, angle, série, objectif), jamais de suppression, jamais d'action sur le calendrier lui-même.
- `POST /api/assistant/proposals/:id/resolve` `{ action: "accept"|"reject", fields? }` — applique (avec édition optionnelle des champs) ou rejette une proposition individuelle.

### Calendrier mensuel (Module D) — vue principale `/calendar`
- `GET /api/calendar?month=YYYY-MM` — endpoint agrégé : `CalendarEntry` du mois avec script lié (`{id, title, status}` ou `null`), catégorie et série jointes, + `PostingGoal` par plateforme. Un seul appel.
- `POST /api/calendar/generate` `{ month }` — génère les créneaux du mois : répartit les créneaux par plateforme selon `PostingGoal`, pondère par les poids de catégories actives ciblant cette plateforme (renormalisés), applique en plus les séries actives ciblant cette plateforme comme overrides sur une partie des créneaux (`distributeSeriesOverrides`). Échoue si un mois est déjà généré, si aucun objectif ou aucune catégorie n'est configuré(e).
- `POST /api/calendar` `{ scriptId, scheduledDate }` — place un script déjà généré et non planifié sur une date.
- `PATCH /api/calendar/:id` `{ status?, contentCategoryId?, seriesId? }` — modification manuelle d'un créneau.
- `DELETE /api/calendar/:id` — supprime un créneau, uniquement s'il n'a pas encore de script généré.
- `POST /api/scripts/generate` `{ calendarEntryId, contentType? }` — génère le script d'un créneau existant (type de contenu par défaut déduit de la plateforme si omis), crée `Script`, met à jour `CalendarEntry.scriptId`. Échoue si le créneau a déjà un script.

### Fiche Script (Module B) — vue détail `/scripts/:id`
- `GET /api/scripts/:id` — script complet, produit/catégorie/série/métriques joints.
- `GET /api/scripts?seriesId=` — liste des scripts de l'utilisateur, filtrable par série.
- `POST /api/scripts` `{ platform, contentCategoryId, contentType, productId?, scheduledDate?, seriesId? }` — génération libre (flux secondaire), place directement au calendrier si `scheduledDate` fourni.
- `POST /api/scripts/:id/regenerate` — régénère le script en conservant catégorie/plateforme/type/série, avec un nouvel angle recalculé par l'anti-répétition.
- `PATCH /api/scripts/:id` `{ status }` — changement de statut manuel.
- `PUT /api/scripts/:id/metrics` `{ views?, likes?, comments?, shares? }` — upsert manuel des métriques (`PostMetrics`, `source` forcé à `"manual"`). Cohabite avec la récupération automatique (`source="api"`) — nécessaire pour Newsletter/Blog/Slack/Autre et pour LinkedIn/X tant qu'ils ne sont pas débloqués.

### Performance & rééquilibrage (Module D/E) — écran `/performance`
- `POST /api/performance/refresh` — point de déclenchement lazy (aucun cron dans ce repo, `docs/SPEC_METRIQUES_AUTO.md` §7.5) : fetch les métriques de chaque plateforme connectée avec `hasMetricsFetch` (`fetchAndMatchPostsForUser`, par plateforme, via `Promise.allSettled` — l'échec d'une plateforme n'affecte jamais les autres), puis évalue une seule fois `maybeGenerateCategoryReweightProposal` (agrège le signal sur toutes les plateformes). Appelé au montage de la page.
- `GET /api/performance/match-candidates` — candidats de rattachement `pending` en attente de confirmation, triés par score.
- `POST /api/performance/match-candidates/:id/resolve` `{ action: "confirm"|"dismiss" }` — `confirm` upsert `PostMetrics` (`source="api"`) depuis les métriques déjà capturées sur le candidat + insère un `PostMetricsSnapshot` ; `dismiss` marque le candidat comme définitivement écarté. Les deux statuts sont terminaux.

### Paramètres / connexions sociales — écran `/settings`
- `GET /api/connections` — statut de connexion par plateforme, un seul appel : `connected`, `status` (`ok`/`needs_reconnect`/`null`), `hasMetricsFetch`. Les plateformes affichées sont l'union des `PostingGoal` définis et des `SocialConnection` existantes ; avant tout onboarding, retombe sur les plateformes à OAuth du registre.

---

## 5. Architecture des Prompts

Tous les appels IA passent par `callStructured` (`src/lib/llm/provider.ts`) : sortie forcée en JSON strict via function/tool calling, avec retry automatique (rappel explicite dans le system prompt) si le modèle répond en texte libre au lieu d'appeler l'outil.

### 5.1 Génération de script (Module B) — `src/lib/llm/generateScript.ts` + `prompts.ts`
- **Prompt système statique** (`SCRIPT_SYSTEM_PROMPT`) — rôle ("Directeur Marketing Virtuel de CreaFlow"), règles de structure générales (hook, découpage en étapes réalisables, cohérence de ton).
- **Contexte dynamique par appel** (`buildScriptUserMessage`, `buildGenerationContext` dans `scriptService.ts`) — profil créateur, `style_profile` (résumé, pas le brut), produit si applicable, règles spécifiques à la plateforme (`PLATFORM_RULES`), catégorie de contenu visée, **série récurrente** si applicable (directive forte sur l'identité de la série), **angle imposé** par l'anti-répétition, type de contenu (`CONTENT_TYPE_GUIDANCE` : vidéo / visuel / texte), sujets récents à éviter (15 derniers scripts, ou 10 derniers de la même série), résumé de performance récente.
- **Sortie forcée en JSON strict** — un des 3 tools selon `contentType` (`generate_video_script` / `generate_visual_post` / `generate_text_post`, `scriptSchema.ts`), schéma correspondant aux colonnes de `Script` pertinentes pour ce type.

### 5.2 Anti-répétition par angles — `src/lib/services/angleService.ts`
Cœur du mécanisme : `pickAngleForScript(userId, contentCategoryId, excludeScriptId?)` sélectionne l'angle actif le **moins récemment utilisé** par l'utilisateur dans la catégorie visée (`selectLeastRecentlyUsedAngle`, sur les 30 derniers scripts angle-non-null de la catégorie). Dégradation gracieuse : `null` si aucun angle actif (utilisateur legacy, avant génération d'angles). L'angle est injecté dans le prompt comme directive de structure/hook, invisible pour l'utilisateur final.

### 5.3 Chat d'onboarding — `src/lib/llm/onboardingChat.ts`
Un seul tool (`update_onboarding_profile`) renvoie à la fois la réponse conversationnelle (`assistantReply`), les champs de profil déduits **cumulés depuis le début de la conversation** (pas seulement les nouveaux), et un booléen `complete` (vrai dès que nom/activité, temps disponible et au moins une plateforme suggérée sont connus). Une question à la fois, jamais de formulaire déguisé, aucune hypothèse sur le type d'activité (vidéo/produit physique).

### 5.4 Chat assistant éditorial — `src/lib/llm/assistantChat.ts`
Un seul tool (`update_assistant_conversation`) renvoie la réponse conversationnelle + jusqu'à 5 propositions par type (produits, catégories, angles, séries, objectifs de fréquence), chacune `create` ou `update` (jamais `delete`). Le contexte injecté inclut l'état complet actuel (ids exacts pour les cibles d'`update`, libellés exacts de catégories pour le rattachement des séries) et, si fournies, des sources web extraites (`urlFetchService`, jusqu'à 3 URLs). Contrainte explicite : ne jamais inventer d'info non fournie, ne jamais agir sur le calendrier lui-même.

### 5.5 Analyse de style — `src/lib/llm/styleProfile.ts`
Un appel dédié (`analyzeStyle`) résume les légendes des `InspirationVideo` récupérées après connexion OAuth en un `StyleProfile` structuré (ton, longueur de phrase, usage d'emojis, vocabulaire, résumé de 2-3 phrases). Déclenché automatiquement au callback OAuth (si des posts sont récupérés) et manuellement via `POST /api/profile/style-analysis`. Le résumé (pas le texte brut) est réinjecté à chaque génération de script — coût réduit, cohérence de ton stable.

### 5.6 Suggestion de catégories / angles / séries (direction éditoriale initiale)
- `src/lib/llm/categoryLabels.ts` — 2 à 6 catégories adaptées au métier décrit (pas de triptyque fixe imposé), poids normalisés à 100 après génération.
- `src/lib/llm/angleLabels.ts` — 4 à 8 angles/archétypes de structure (pas des sujets), réutilisés par l'anti-répétition.
- `src/lib/llm/seriesLabels.ts` — 0 à 5 séries récurrentes nommées, chacune rattachée à une ou plusieurs catégories actives par leur libellé exact ; liste vide acceptée si le métier ne s'y prête pas.

Ces trois générations sont déclenchées automatiquement à la fin de l'onboarding (`finalizeOnboarding`, dans cet ordre : catégories → angles → séries, les séries dépendant des catégories) et peuvent être régénérées manuellement depuis l'écran Direction (l'ancien jeu actif est archivé, pas supprimé).

### 5.7 Récupération automatique des métriques & re-pondération (Module D/E)

Implémente `docs/SPEC_METRIQUES_AUTO.md` — pas d'appel LLM sur ce chemin, calcul déterministe de bout en bout (même esprit que §5.2 et la performance summary de génération de script).

**Rattachement post↔script** (`src/lib/services/postMatchingService.ts`, fonctions pures testées sans DB) : `scorePostMatch` combine 50% proximité de date (vs `CalendarEntry.scheduledDate` du script, fenêtre de 7 jours) et 50% similarité Jaccard des captions (tokens normalisés, hashtags/URLs retirés). Seuil de proposition `0.35`. Un candidat au-dessus du seuil est inséré dans `PostMatchCandidate` ; la confirmation/rejet utilisateur est définitive (jamais reproposé pour ce `(platform, platformPostId)`).

**Orchestration du fetch** (`src/lib/services/postMetricsFetchService.ts`, `fetchAndMatchPostsForUser(userId, platform)`) : refresh de token lazy (`socialConnectionService.getValidSocialAccessToken`), appel `provider.fetchPostMetrics`, mise à jour directe des posts déjà rattachés (+ `PostMetricsSnapshot`), matching heuristique pour les posts inconnus. Dédup configurable par plateforme (`MIN_REFETCH_INTERVAL_HOURS`, 24h pour X uniquement — seule plateforme payante à l'appel).

**Mécanique de re-pondération** (`src/lib/services/categoryReweightService.ts`) — répond aux risques de sur-réaction et d'emballement identifiés en `docs/SPEC_METRIQUES_AUTO.md` §6 :
1. Taux d'engagement `(likes+comments+shares)/max(views,1)` par script, uniquement `PostMetrics.source="api"` (jamais la saisie manuelle non vérifiée).
2. Z-score par rapport à la moyenne/écart-type de **sa plateforme** (`computeCategoryPlatformSignals`) — rend TikTok et LinkedIn comparables. Seuil minimal `MIN_SAMPLES_PER_CATEGORY_PLATFORM=5` par couple (catégorie, plateforme), plus haut que le `MIN_SAMPLES_FOR_SIGNAL=3` de la performance summary de génération de script (donnée structurelle persistante vs. phrase de prompt réversible).
3. Agrégation inter-plateforme par catégorie (`aggregateCategorySignals`, moyenne pondérée par échantillon plafonnée à `PLATFORM_SAMPLE_CAP=20` par plateforme) — nécessaire car `ContentCategory.weight` est un champ global, pas par plateforme. Minimum `MIN_COMPARABLE_CATEGORIES=2` catégories avec signal pour produire une proposition.
4. Delta plafonné (`MAX_DELTA_PER_CYCLE=8` points, protège contre un pic ponctuel) puis amorti (`DAMPING_FACTOR=0.5`, protège contre la dérive cumulative cycle après cycle), poids final borné à `[MIN_CATEGORY_WEIGHT=10, MAX_CATEGORY_WEIGHT=90]`.
5. Cooldown `COOLDOWN_DAYS=14` entre deux propositions `category_reweight` (dérivé de `AssistantProposal.createdAt`, tout statut confondu — pas de nouvelle colonne).

`maybeGenerateCategoryReweightProposal(userId)` est appelé une seule fois par `POST /api/performance/refresh`, après le fetch de toutes les plateformes connectées. Portée limitée à `ContentCategory.weight` pour cette itération — `selectLeastRecentlyUsedAngle` (§5.2) et `ContentSeries.weight` ne sont pas concernés, laissés comme point de branchement futur explicite.

---

## 6. Facturation (Stripe)

Self-service, mode `subscription` Stripe Checkout — pas d'intégration Stripe.js côté client, le front redirige vers `session.url` et revient sur `/settings?tab=billing`.

- **Plans** (`src/lib/billing/plans.ts`) : `starter` (30 scripts/mois) et `pro` (150 scripts/mois). Les montants ne sont jamais en dur dans le code — seul l'ID du Stripe Price est référencé, via `STRIPE_PRICE_STARTER`/`STRIPE_PRICE_PRO`.
- **Essai gratuit** : pas de ligne `subscriptions` tant que l'utilisateur n'a jamais payé — quota `FREE_TRIAL_SCRIPT_LIMIT=5` générations **à vie** (pas de reset), compté sur `ScriptGenerationEvent` (`src/lib/services/billingService.ts`).
- **Source de vérité** : Stripe uniquement. `subscriptions` (`src/db/schema.ts`) n'est jamais écrite par une route utilisateur, seulement par le webhook (`POST /api/billing/webhook`) sur `checkout.session.completed`, `customer.subscription.updated` et `customer.subscription.deleted`. Le rattachement `userId` passe par `client_reference_id` (session Checkout) et `subscription_data.metadata.userId`/`metadata.plan` (posés à la création, jamais recalculés depuis un price id).
- **Pas de changement de plan self-service en v1** : le Customer Portal (`POST /api/billing/portal`) couvre moyen de paiement / factures / résiliation, pas le changement de plan — `subscriptions.plan` ne serait plus fiable si Stripe le modifiait sans passer par nos metadata. `POST /api/billing/checkout` refuse (409) tant qu'un abonnement existant n'est pas dans un statut terminal (`canceled`/`incomplete_expired`) — sinon un 2e Checkout créerait un 2e customer/2e subscription Stripe orphelins.
- **Quota** : `enforceScriptQuota(userId)` appelé en tête de `POST /api/scripts`, `POST /api/scripts/generate` et `POST /api/scripts/:id/regenerate` — compte les `ScriptGenerationEvent` créés depuis `currentPeriodStart` (abonnement actif) ou depuis toujours (essai gratuit), lève une `ApiError(402)` au-delà de la limite du plan. Une régénération compte comme une génération (voir `ScriptGenerationEvent` en §3) : `createScriptRecord`/`updateScriptRecord` (`scriptService.ts`) insèrent l'événement dans la même transaction que l'écriture du script.
- **Limite connue acceptée** : le check de quota et l'écriture de l'événement ne sont pas atomiques (l'appel LLM a lieu entre les deux) — deux requêtes concurrentes du même utilisateur peuvent ponctuellement dépasser la limite de quelques unités. Documenté dans `enforceScriptQuota` (`billingService.ts`).
- **Non couvert par cette itération** : quota sur la génération d'images IA (`POST /api/assets/generate-image`, coût Gemini comparable à un script), plans annuels, changement de plan self-service, emails transactionnels de facturation (facture, échec de paiement, fin d'essai).

---

## 7. Sécurité (headers, rate limiting, CORS)

- **Headers HTTP** (`next.config.ts`, appliqués à toutes les routes) : CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (caméra/micro/géoloc désactivés — l'app n'en a jamais besoin), `Strict-Transport-Security`.
- **CSP sans nonce** : l'app utilise `style={{}}` (styles inline React) partout plutôt que des classes CSS générées — un CSP à base de nonce casserait tout l'attribut `style` sans une réécriture complète en CSS-in-JS/nonce-aware. `style-src` garde donc `'unsafe-inline'` ; `script-src` reste strict (`'self'` + domaines Google du Picker). `img-src` inclut dynamiquement l'origine de `R2_PUBLIC_BASE_URL` (résolue au chargement de `next.config.ts`).
- **Pas de CORS permissif sur `/api/*`, volontairement** : aucun `Access-Control-Allow-Origin` n'est posé. C'est un choix, pas un oubli — l'app n'expose pas d'API publique consommée par un autre origin, et l'absence de header CORS fait que la politique same-origin par défaut du navigateur bloque déjà la lecture des réponses par un site tiers. Ajouter un header CORS permissif réduirait la sécurité au lieu de l'améliorer. Combiné à `sameSite: "lax"` sur le cookie de session (`src/lib/auth/session.ts`), qui empêche déjà l'envoi du cookie sur une requête POST cross-site, la protection CSRF de base est couverte sans code dédié.
- **Rate limiting** (`src/lib/services/rateLimitService.ts`) : fenêtre fixe backée Postgres (`rate_limit_buckets`), pas de Redis dans l'infra actuelle. Compteur incrémenté par upsert sur `(scope, identifier, fenêtre)`, purge paresseuse des fenêtres expirées (probabiliste, pas de cron dans ce repo — même philosophie que le reste de l'app). `enforceScriptQuota` (facturation) et le rate limiting sont deux mécanismes distincts et complémentaires : l'un borne le coût mensuel par abonnement, l'autre borne le débit de requêtes par minute (anti-spam/anti-brute-force), indépendamment du quota.
  - `POST /api/auth/login` : 10/15min par IP + 5/15min par email (double limite : IP contre le spam générique, email contre le credential stuffing ciblé depuis plusieurs IP).
  - `POST /api/auth/signup` : 5/heure par IP (anti-création massive de comptes).
  - Génération de script (`POST /api/scripts`, `POST /api/scripts/generate`, `POST /api/scripts/:id/regenerate`) : 20/min par utilisateur, scope partagé entre les 3 routes (sinon la limite se contournerait en alternant entre elles).
  - Chats IA (`POST /api/onboarding/chat`, `POST /api/assistant/chat`) : 20/min par utilisateur.
  - `POST /api/profile/style-analysis` : 5/min par utilisateur (déclenchement manuel, usage rare).
  - `POST /api/assets/generate-image` : 10/min par utilisateur.
  - `POST /api/profile/content-categories` et `POST /api/series` (branche régénération IA uniquement, pas l'édition manuelle) : 5/min par utilisateur chacun.
  - **Non couvert par cette itération** : les routes `/api/billing/*` (checkout, portail, webhook) n'ont pas encore ce traitement — à ajouter dans un prochain chantier.
- **IP client** : lue depuis `X-Forwarded-For` (posé par la plateforme d'hébergement — Vercel, Railway, etc.). Si l'en-tête est absent (self-hosting direct sans proxy devant l'app), `getClientIp` renvoie `null` et le check par IP est **sauté** plutôt que d'utiliser une valeur de repli type "unknown" : un bucket partagé par tous les clients sans IP bloquerait tous les visiteurs légitimes dès qu'un seul dépasse la limite (déni de service auto-infligé). Sur `/api/auth/login`, le check par email reste actif dans ce cas ; sur `/api/auth/signup`, aucun filet ne reste (accepté en v1, cas de déploiement non standard).

---

## 9. Monitoring (Sentry, logs structurés)

- **Optionnel par défaut** : sans `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN`, `Sentry.init()` tourne avec `dsn: undefined` — aucun événement envoyé, aucune erreur, l'app fonctionne normalement (comportement documenté du SDK, pas une branche conditionnelle codée à la main).
- **Fichiers** (convention Next.js 15+, `src/` car le repo utilise ce dossier) : `src/instrumentation.ts` (`register()` charge la config par runtime, `onRequestError = Sentry.captureRequestError` capture les erreurs serveur non gérées — Server Components, Route Handlers, Server Actions), `src/instrumentation-client.ts` (init côté navigateur + `onRouterTransitionStart`), `src/sentry.server.config.ts` / `src/sentry.edge.config.ts` (init par runtime).
- **Pas de Session Replay** : volontairement non activé (`Sentry.replayIntegration()`) — ça enregistre l'écran de l'utilisateur, ce que `src/app/legal/confidentialite/page.tsx` ne couvre pas encore. À activer seulement après avoir mis à jour la politique de confidentialité (et probablement un bandeau de consentement).
- **Pas de `withSentryConfig` dans `next.config.ts`** : pas d'upload de source maps ni de tunneling en v1 — éviterait de exiger `SENTRY_AUTH_TOKEN`/org/projet pendant chaque build local. Conséquence : les stack traces vues dans Sentry seront minifiées tant que ce n'est pas ajouté (à faire une fois le projet Sentry créé, probablement dans le chantier CI/CD).
- **Logger structuré** (`src/lib/logger.ts`) : remplace les `console.error`/`console.log` ad hoc dispersés dans le code. `logger.debug/info/warn/error` émettent une ligne JSON (level, message, timestamp, contexte). `logger.error` fait aussi remonter à Sentry — `captureException` s'il y a une vraie exception JS, sinon `captureMessage` (ex. une anomalie de données détectée sans throw, comme un webhook Stripe sans metadata attendue). `logger.warn` ne remonte jamais à Sentry (ex. signature webhook invalide — du bruit de scanner/bot attendu, pas un incident).
  - **Angle mort connu** : `POST /api/billing/webhook` logue toute signature invalide en `warn` (donc sans alerte Sentry), pour ne pas noyer Sentry sous le bruit des scanners/bots qui tapent l'URL au hasard. Mais si `STRIPE_WEBHOOK_SECRET` est un jour désynchronisé du secret actif côté Stripe (rotation oubliée), **100% des webhooks échoueraient silencieusement** de la même façon, sans qu'aucune alerte ne se déclenche — les abonnements cesseraient de se synchroniser sans signal automatique. Pas de détection différenciée en v1 (nécessiterait un compteur d'échecs consécutifs ou une vérification périodique côté Stripe) — à surveiller manuellement après toute rotation de secret, ou à durcir plus tard.
- **`handleApiError`** (`src/lib/api/errors.ts`) logue via `logger.error` uniquement la branche générique 500 (erreur non anticipée) — `ApiError`/`ZodError`/`UnauthorizedError` sont un fonctionnement normal de l'API, pas des incidents.
- **Error boundaries** : `src/app/error.tsx` (tout le contenu sauf le root layout) et `src/app/global-error.tsx` (root layout uniquement, cas rarissime — doc Next.js : rendu de document séparé, sans les styles/polices globaux, d'où les styles en dur). Les deux capturent via `Sentry.captureException` dans un `useEffect`.
- **Non couvert par cette itération** : upload de source maps, alerting configuré côté Sentry (seuils, intégrations Slack/email — à faire côté dashboard Sentry, pas dans le code), dashboards de métriques produit (hors périmètre — ça, c'est Phase 4 analytics).

---

## 10. Décisions ouvertes

- Faut-il étendre `enforceScriptQuota` (ou une variante) à la génération d'images IA (`POST /api/assets/generate-image`), qui a un coût LLM comparable à un script mais n'est pour l'instant pas quotée ?
- Le portail Stripe doit-il à terme permettre un changement de plan self-service (nécessiterait de résoudre `plan` depuis le price id à chaque event plutôt que depuis metadata figée à la création) ?
- Durée/modalités d'un essai avec carte bancaire (`trial_period_days` Stripe) en complément ou remplacement de l'essai gratuit sans carte actuel (5 scripts à vie) ?
- Le rate limiting fenêtre fixe (pas glissante) autorise un dépassement ponctuel jusqu'à ~2x la limite affichée à cheval sur deux fenêtres — acceptable pour de l'anti-abus, à revoir si un besoin de précision plus strict apparaît.
- Faut-il migrer le rate limiting vers Redis/Upstash si l'app passe en déploiement multi-instance à fort trafic (la version Postgres reste correcte mais ajoute une requête DB par appel) ?
- `withSentryConfig` (upload de source maps) à ajouter une fois un projet Sentry réel créé — probablement au moment du chantier CI/CD, pour l'intégrer à la pipeline de build plutôt qu'en config locale.
