import type { Platform, ScriptStatus, CalendarStatus } from "@/lib/design/tokens";

export class ApiClientError extends Error {}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiClientError(body?.error || `Erreur ${res.status}`);
  }
  return body as T;
}

const post = <T,>(path: string, data?: unknown) =>
  apiFetch<T>(path, { method: "POST", body: data !== undefined ? JSON.stringify(data) : undefined });
const put = <T,>(path: string, data: unknown) =>
  apiFetch<T>(path, { method: "PUT", body: JSON.stringify(data) });
const patch = <T,>(path: string, data: unknown) =>
  apiFetch<T>(path, { method: "PATCH", body: JSON.stringify(data) });
const del = <T,>(path: string) => apiFetch<T>(path, { method: "DELETE" });

export interface User {
  id: string;
  email: string;
}

/** Dépôt public proposé à l'étape « Projets » de l'onboarding dev et dans paramètres > Sujets.
 *  `alreadyConnected` : déjà source d'un sujet — affiché grisé, non re-sélectionnable. */
export interface GithubRepoOption {
  externalId: string;
  fullName: string;
  name: string;
  description: string | null;
  defaultBranch: string;
  language: string | null;
  pushedAt: string;
  alreadyConnected: boolean;
}

/** Candidat proposé par un connecteur, sous la forme générique que rend
 *  /api/connectors/[provider]/candidates. `hint` est composé par le connecteur : l'écran de
 *  sélection l'affiche sans jamais savoir de quel fournisseur il vient. */
export interface SourceCandidate {
  externalId: string;
  label: string;
  subjectName: string;
  subjectDescription: string | null;
  config: Record<string, unknown>;
  hint: string | null;
  alreadyConnected: boolean;
}

export interface SourceCandidateList {
  displayName: string;
  emptyMessage: string;
  footnote: string;
  candidates: SourceCandidate[];
}

/** Source connectée alimentant le corpus d'un sujet. */
export interface MaterialSource {
  id: string;
  productId: string;
  type: "github_repo" | "notion_page" | "linear_project";
  /** Nom lisible du fournisseur, fourni par le connecteur — l'UI ne le déduit pas de `type`. */
  connectorLabel: string;
  externalId: string;
  label: string;
  syncCursor: string | null;
  lastSyncedAt: string | null;
  status: "ok" | "error" | "needs_reconnect";
  lastError: string | null;
  createdAt: string;
}

export interface SyncReport {
  added: number;
  updated: number;
  unchanged: number;
  truncated: boolean;
}

export interface ConnectRepoResult {
  productId: string;
  sourceId: string;
  label: string;
  report: SyncReport | null;
  error: string | null;
}

export interface ContentCategory {
  id: string;
  userId: string;
  label: string;
  description: string;
  weight: number;
  archived: boolean;
  createdAt: string;
  /** Réseaux auxquels cette catégorie est restreinte ; vide = visible sur tous les réseaux. */
  platforms: Platform[];
  /** Aiguillage matière×catégorie (docs/SPEC_MATIERE_EDITEUR.md §5.3) — sous-représentée quand le corpus est sec. */
  materialHungry: boolean;
}

/** Forme légère d'une catégorie telle qu'embarquée (jointure) dans un Script ou une CalendarEntry. */
export interface ContentCategorySummary {
  id: string;
  label: string;
  description?: string;
}

export interface CreatorProfile {
  id: string;
  userId: string;
  brandName: string;
  activityType: string;
  tone: string | null;
  values: string | null;
  equipment: string[] | null;
  weeklyTimeAvailable: string | null;
  /** Audience de marque (docs/SPEC_PROMPT_GENERATION_TECH.md §5) — fallback pour Product.targetAudience. */
  targetAudience: string | null;
  styleProfile: {
    tone: string;
    sentenceLength: string;
    emojiUsage: string;
    vocabulary: string;
    summary: string;
  } | null;
  styleProfileUpdatedAt: string | null;
}

export interface Product {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  valueProposition: string | null;
  photoUrl: string | null;
  /** Override d'audience par sujet (docs/SPEC_PROMPT_GENERATION_TECH.md §5) — null = fallback marque. */
  targetAudience: string | null;
}

export interface Connection {
  platform: Platform;
  connected: boolean;
  connectedAt: string | null;
  /** null si non connecté. "needs_reconnect" = refresh de token échoué, reconnexion requise. */
  status: "ok" | "needs_reconnect" | null;
  hasMetricsFetch: boolean;
}

export interface PostingGoal {
  id: string;
  userId: string;
  platform: Platform;
  targetCountPerWeek: number;
}

/** Un épisode du plan éditorial (docs/SPEC_REDACTEUR_EN_CHEF.md §2, Annexe B.5). */
export interface NarrativeBeat {
  id: string;
  title: string;
  kind: "material" | "pedagogical" | "personal";
  angleHint: string | null;
  focusDocIds: string[];
  status: "planned" | "drafted" | "published" | "skipped";
  scriptId: string | null;
  rationale: string;
}

export interface NarrativePromise {
  text: string;
  scriptId: string;
  madeAt: string;
}

/** État narratif du rédacteur en chef pour un sujet (docs/SPEC_REDACTEUR_EN_CHEF.md §2). */
export interface NarrativeState {
  id: string;
  userId: string;
  productId: string | null;
  seriesId: string | null;
  arcSummary: string | null;
  beats: NarrativeBeat[];
  openPromises: NarrativePromise[];
  callbacks: string[];
  formatContract: string | null;
  isStale: boolean;
  lastPlannedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContentSeries {
  id: string;
  userId: string;
  label: string;
  description: string;
  weight: number;
  archived: boolean;
  /** feuilleton = épisodes ordonnés (arc + beats) ; rendez_vous = épisodes autonomes, pas de
   *  planification (docs/SPEC_REDACTEUR_EN_CHEF.md §1). Défaut rendez_vous. */
  mode: "feuilleton" | "rendez_vous";
  createdAt: string;
  /** Rôle unique de la série (docs/SPEC_SERIES_ET_ROLES.md §1) — null uniquement pour des données
   *  antérieures à la migration, une telle série est ignorée par le calendrier. */
  category: ContentCategorySummary | null;
  /** Réseaux auxquels cette série est restreinte ; vide = visible sur tous les réseaux. */
  platforms: Platform[];
  /** null tant qu'aucune planification n'a eu lieu pour cette série (ou mode rendez_vous). */
  narrativeState: NarrativeState | null;
  /** Sujet dont cette série tire sa matière (sélecteur de sujet, docs/SPEC_REDACTEUR_EN_CHEF.md) —
   *  null si la série n'est rattachée à aucun sujet précis (matière de niveau marque). */
  product: { id: string; name: string } | null;
}

export interface StoryboardStep {
  planNumber: number;
  description: string;
}

export type ContentType = "video" | "visual" | "text";

export interface PostMetrics {
  id: string;
  scriptId: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  source: "manual" | "api";
  fetchedAt: string | null;
  updatedAt: string;
}

export interface PostMatchCandidate {
  id: string;
  scriptId: string;
  scriptTitle: string;
  platform: Platform;
  externalUrl: string;
  captionText: string | null;
  publishedAt: string | null;
  score: number;
  metrics: { views: number; likes: number; comments: number; shares: number };
  createdAt: string;
}

export interface Script {
  id: string;
  userId: string;
  productId: string | null;
  platform: Platform;
  /** Nullable : naissance paresseuse (§4.5) — la ligne peut naître avant qu'un titre n'existe. */
  title: string | null;
  /** Intention de génération (docs/SPEC_PROMPT_GENERATION_TECH.md §2) — non affiché à l'utilisateur
   *  en V1 (§6.4) ; présent ici seulement pour conditionner l'affichage du bouton "autre idée". */
  concept: string | null;
  contentType: ContentType;
  /** Présents seulement pour contentType "video" (et hookVisual/storyboard aussi pour "visual"). */
  hookVisual: string | null;
  hookText: string | null;
  hookAudio: string | null;
  storyboard: StoryboardStep[] | null;
  caption: string;
  hashtags: string[];
  soundRecommendation: string | null;
  contentCategory: ContentCategorySummary;
  /** Angle imposé (mécanisme anti-répétition) — présent uniquement sur la fiche détaillée (GET /api/scripts/:id). */
  angle?: { id: string; label: string; description: string } | null;
  series: ContentCategorySummary | null;
  status: ScriptStatus;
  /** "generated" (LLM) / "imported" (POST /api/scripts/import) / "manual" (naissance paresseuse éditeur). */
  origin: "generated" | "imported" | "manual";
  createdAt: string;
  updatedAt: string;
  product?: Product | null;
  metrics?: PostMetrics | null;
  /** Photo de marque utilisée comme référence, et image effectivement générée (contentType "visual"). */
  brandAssetId: string | null;
  generatedImageId: string | null;
  /** Présent (avec `url`) uniquement sur la fiche script détaillée (GET /api/scripts/:id). */
  generatedImage?: GeneratedImage | null;
  /** Matière utilisée pour ce script — présent uniquement sur la fiche détaillée. */
  citations?: Citation[];
  /** Id du beat du plan narratif dont ce script est issu (docs/SPEC_REDACTEUR_EN_CHEF.md §2/§4.1.6) —
   *  null hors chef ou détour hors plan assumé. */
  beatId: string | null;
  /** Titre du beat, résolu à la lecture — présent uniquement sur la fiche détaillée (GET /api/scripts/:id). */
  beatTitle?: string | null;
  /** Pourquoi le rédacteur en chef a placé ce beat ici — même résolution à la lecture que beatTitle. */
  beatRationale?: string | null;
  /** Angle recommandé par le plan pour cet épisode (distinct de l'angle anti-répétition imposé). */
  beatAngleHint?: string | null;
  /** Promesse que ce script s'est engagé à honorer, figée à la génération. */
  promiseHonored?: string | null;
  /** Callbacks de la série — détails familiers disponibles, pas un ciblage par script. */
  seriesCallbacks?: string[];
}

export interface SourceMaterial {
  id: string;
  userId: string;
  productId: string | null;
  kind: "paste" | "file" | "interview";
  title: string | null;
  rawText: string;
  /** Résumé orienté potentiel narratif (docs/SPEC_REDACTEUR_EN_CHEF.md §2/§3.1) — null tant que le
   *  résumeur ne l'a pas encore traité (résumé en cours). */
  summary: string | null;
  createdAt: string;
}

/** Citation post-génération (docs/SPEC_MATIERE_EDITEUR.md §3) — passage du corpus rapporté comme
 *  utilisé par le LLM à la génération, retrouvé dans le texte source par recherche approximative. */
export interface Citation {
  id: string;
  sourceMaterialId: string | null;
  sourceMaterialTitle?: string | null;
  scriptId?: string | null;
  scriptTitle?: string | null;
  excerpt: string;
  /** Position dans le texte source, présente uniquement sur la vue "citations d'un document". */
  matchStart?: number | null;
  matchLength?: number | null;
  /** Présent uniquement sur la vue "citations d'un script" (GET /api/scripts/:id). */
  matched?: boolean;
}

export interface CalendarEntry {
  id: string;
  userId: string;
  scriptId: string | null;
  platform: Platform;
  scheduledDate: string;
  contentCategory: ContentCategorySummary;
  series: ContentCategorySummary | null;
  status: CalendarStatus;
  reminderSent: boolean;
  script: { id: string; title: string; status: ScriptStatus } | null;
}

export interface OnboardingMessage {
  role: "user" | "assistant";
  content: string;
}

/** Séries générées à la fin du chat d'onboarding — l'utilisateur coche celles qu'il garde
 *  (composant SeriesPicker) avant de continuer, le reste est archivé via series-selection. */
export interface OnboardingSeriesProposal {
  id: string;
  label: string;
  description: string;
  mode: "feuilleton" | "rendez_vous";
  categoryLabel: string | null;
}

/** Fichier déposé dans la conversation de l'assistant, en attente d'être rangé en matière
 *  (docs/SPEC_ASSISTANT_AGENTIQUE.md §5.1). Le contenu ne remonte jamais côté client. */
export interface AssistantAttachment {
  id: string;
  filename: string;
  createdAt: string;
}

export interface AssistantProposal {
  id: string;
  userId: string;
  kind:
    | "product_create"
    | "product_update"
    | "series_create"
    | "series_update"
    | "category_create"
    | "category_update"
    | "angle_create"
    | "angle_update"
    | "posting_goal_update"
    | "material_create"
    | "material_update"
    | "material_delete"
    | "series_archive"
    | "category_archive"
    | "angle_archive"
    | "category_reweight"
    | "profile_update";
  targetId: string | null;
  payload: Record<string, unknown>;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
  resolvedAt: string | null;
}

export interface BrandAsset {
  id: string;
  userId: string;
  sourceType: "upload" | "google_drive";
  thumbnailUrl: string | null;
  status: "pending" | "ready" | "unreachable";
  aiDescription: string | null;
  tags: string[] | null;
  productId: string | null;
  createdAt: string;
}

export interface GeneratedImage {
  id: string;
  userId: string;
  scriptId: string | null;
  storageKey: string;
  url: string;
  mode: string;
  createdAt: string;
}

export interface QuotaStatus {
  allowed: boolean;
  used: number;
  limit: number;
  planName: string;
}

export interface BillingSubscription {
  plan: "starter" | "pro";
  planName: string;
  status: "trialing" | "active" | "past_due" | "canceled" | "unpaid" | "incomplete" | "incomplete_expired";
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface BillingInfo {
  subscription: BillingSubscription | null;
  quota: QuotaStatus;
  /** Pool distinct pour les micro-retouches de l'éditeur (docs/SPEC_MATIERE_EDITEUR.md §4.6). */
  microEditQuota: QuotaStatus;
  plans: Array<{ id: "starter" | "pro"; name: string; scriptsPerMonth: number }>;
}

export interface GoogleDriveConnection {
  connected: boolean;
  status: "ok" | "needs_reconnect" | null;
  driveAccountEmail: string | null;
  connectedAt: string | null;
}

export const api = {
  signup: (email: string, password: string) => post<{ user: User }>("/api/auth/signup", { email, password }),
  login: (email: string, password: string) => post<{ user: User }>("/api/auth/login", { email, password }),
  logout: () => post<{ ok: true }>("/api/auth/logout"),
  me: () => apiFetch<{ user: User | null }>("/api/auth/me"),
  /** Le bouton GitHub de /login n'est rendu que si les variables d'environnement sont présentes. */
  getGithubStatus: () => apiFetch<{ configured: boolean }>("/api/auth/github/status"),

  getGithubRepos: () => apiFetch<{ repos: GithubRepoOption[] }>("/api/github/repos"),
  connectGithubRepos: (repos: GithubRepoOption[]) =>
    post<{ results: ConnectRepoResult[] }>("/api/github/repos", { repos }),

  /** Fournisseurs d'identité configurés sur cet environnement — /login n'affiche que ceux-là. */
  getOAuthProviders: () => apiFetch<{ providers: Array<{ id: string; displayName: string }> }>("/api/auth/oauth/providers"),

  getSourceCandidates: (provider: string) =>
    apiFetch<SourceCandidateList>(`/api/connectors/${provider}/candidates`),
  connectSources: (provider: string, candidates: SourceCandidate[]) =>
    post<{ results: ConnectRepoResult[] }>(`/api/connectors/${provider}/candidates`, {
      candidates: candidates.map(({ externalId, label, subjectName, subjectDescription, config }) => ({
        externalId,
        label,
        subjectName,
        subjectDescription,
        config,
      })),
    }),

  getMaterialSources: (productId: string) =>
    apiFetch<{ sources: MaterialSource[] }>(`/api/material-sources?productId=${productId}`),
  syncMaterialSource: (id: string) => post<{ report: SyncReport }>(`/api/material-sources/${id}/sync`),
  /** Supprime aussi les documents miroir de la source — confirmer côté UI avant d'appeler. */
  deleteMaterialSource: (id: string) => del<{ ok: true }>(`/api/material-sources/${id}`),

  getProfile: () =>
    apiFetch<{
      profile: CreatorProfile | null;
      vertical: "creator" | "dev" | "artisan" | "entrepreneur";
      /** Fournisseurs auxquels ce compte est relié. C'est CETTE liste qui dit quel sélecteur
       *  afficher, pas la verticale — "dev" couvre GitHub comme Linear. */
      connectedProviders: Array<{ id: string; displayName: string }>;
      githubConnected: boolean;
    }>("/api/profile"),
  saveProfile: (data: {
    brandName: string;
    activityType: string;
    tone?: string;
    values?: string;
    equipment?: string[];
    weeklyTimeAvailable?: string;
    targetAudience?: string;
  }) => post<{ profile: CreatorProfile }>("/api/profile", data),
  triggerStyleAnalysis: () => post<{ profile: CreatorProfile }>("/api/profile/style-analysis"),

  getContentCategories: () => apiFetch<{ categories: ContentCategory[] }>("/api/profile/content-categories"),
  generateContentCategories: () => post<{ categories: ContentCategory[] }>("/api/profile/content-categories"),
  saveContentCategories: (
    categories: Array<{
      id?: string;
      label: string;
      description: string;
      weight: number;
      platforms: string[];
      materialHungry?: boolean;
    }>
  ) => post<{ categories: ContentCategory[] }>("/api/profile/content-categories", { categories }),

  getContentSeries: () => apiFetch<{ series: ContentSeries[] }>("/api/series"),
  generateContentSeries: () => post<{ series: ContentSeries[] }>("/api/series"),
  saveContentSeries: (
    series: Array<{
      id?: string;
      label: string;
      description: string;
      weight: number;
      categoryId: string;
      platforms: string[];
    }>
  ) => post<{ series: ContentSeries[] }>("/api/series", { series }),
  /** Bascule de mode et/ou sujet lié (docs/SPEC_REDACTEUR_EN_CHEF.md §7) — endpoint dédié plutôt que
   *  saveContentSeries : ce dernier archive toute série active omise du tableau soumis, inadapté à
   *  l'édition d'un ou deux champs depuis une carte de la bibliothèque. */
  updateSeriesFields: (id: string, fields: { mode?: "feuilleton" | "rendez_vous"; productId?: string | null }) =>
    patch<{ series: ContentSeries }>(`/api/series/${id}`, fields),

  /** Planifie/replanifie l'arc narratif d'un sujet (docs/SPEC_REDACTEUR_EN_CHEF.md §6) — crée l'état
   *  paresseusement. 409 si la cible est une série en mode rendez_vous. */
  planNarrative: (data: { productId?: string; seriesId?: string; directive?: string }) =>
    post<{ state: NarrativeState }>("/api/narrative/plan", data),
  /** Trouve ou crée un état narratif vide, sans planification (§5/§7, Lot B4) — utilisé pour le mode
   *  rendez_vous, où /narrative/plan refuse explicitement (409) mais où formatContract/callbacks
   *  doivent quand même pouvoir être édités à la main. */
  ensureNarrativeState: (data: { productId?: string; seriesId?: string }) =>
    post<{ state: NarrativeState }>("/api/narrative/ensure", data),
  /** Éditions manuelles de l'écran Direction (§6/§7) : arcSummary, formatContract, beats (réordonner/
   *  éditer/passer skipped), fermeture d'une promesse (closePromiseText), callbacks. */
  patchNarrativeState: (
    id: string,
    data: Partial<{
      arcSummary: string;
      formatContract: string | null;
      beats: NarrativeBeat[];
      callbacks: string[];
      closePromiseText: string;
    }>
  ) => patch<{ state: NarrativeState }>(`/api/narrative/${id}`, data),

  getProducts: () => apiFetch<{ products: Product[] }>("/api/products"),
  createProducts: (
    items: Array<{ name: string; description?: string; valueProposition?: string; photoUrl?: string }>
  ) => post<{ products: Product[] }>("/api/products", items),
  updateProduct: (
    id: string,
    data: Partial<{ name: string; description: string; valueProposition: string; photoUrl: string; targetAudience: string | null }>
  ) => put<{ product: Product }>(`/api/products/${id}`, data),
  deleteProduct: (id: string) => del<{ ok: true }>(`/api/products/${id}`),

  getConnections: () => apiFetch<{ connections: Connection[] }>("/api/connections"),

  getPostingGoals: () => apiFetch<{ goals: PostingGoal[] }>("/api/posting-goals"),
  savePostingGoal: (platform: Platform, targetCountPerWeek: number) =>
    post<{ goal: PostingGoal }>("/api/posting-goals", { platform, targetCountPerWeek }),

  getCalendar: (month: string) =>
    apiFetch<{ entries: CalendarEntry[]; goals: PostingGoal[] }>(`/api/calendar?month=${month}`),
  getCalendarEntry: (id: string) => apiFetch<{ entry: CalendarEntry }>(`/api/calendar/${id}`),
  generateCalendar: (month: string) => post<{ entries: CalendarEntry[] }>("/api/calendar/generate", { month }),
  placeScript: (scriptId: string, scheduledDate: string) =>
    post<{ entry: CalendarEntry }>("/api/calendar", { scriptId, scheduledDate }),
  updateCalendarEntryStatus: (id: string, status: CalendarStatus) =>
    patch<{ entry: CalendarEntry }>(`/api/calendar/${id}`, { status }),
  updateCalendarEntry: (id: string, data: { contentCategoryId?: string; seriesId?: string | null }) =>
    patch<{ entry: CalendarEntry }>(`/api/calendar/${id}`, data),
  deleteCalendarEntry: (id: string) => del<{ ok: true }>(`/api/calendar/${id}`),

  generateScriptForEntry: (calendarEntryId: string, contentType?: ContentType, productId?: string, directive?: string) =>
    post<{ script: Script }>("/api/scripts/generate", { calendarEntryId, contentType, productId, directive }),
  generateFreeformScript: (data: {
    platform: Platform;
    /** Role du post libre ; omis quand seriesId est fourni - le serveur derive alors le role de la
     *  serie (docs/SPEC_SERIES_ET_ROLES.md 4.2). */
    contentCategoryId?: string;
    contentType: ContentType;
    productId?: string;
    scheduledDate?: string;
    seriesId?: string;
    directive?: string;
  }) => post<{ script: Script }>("/api/scripts", data),
  getScripts: (params?: { seriesId?: string }) =>
    apiFetch<{ scripts: Script[] }>(`/api/scripts${params?.seriesId ? `?seriesId=${params.seriesId}` : ""}`),
  getScript: (id: string) => apiFetch<{ script: Script }>(`/api/scripts/${id}`),
  regenerateScript: (id: string) => post<{ script: Script }>(`/api/scripts/${id}/regenerate`),
  updateScriptStatus: (id: string, status: ScriptStatus) =>
    patch<{ script: Script }>(`/api/scripts/${id}`, { status }),
  patchScriptContent: (
    id: string,
    data: Partial<{
      title: string;
      hookVisual: string;
      hookText: string;
      hookAudio: string;
      storyboard: StoryboardStep[];
      caption: string;
      hashtags: string[];
      soundRecommendation: string;
    }>
  ) => patch<{ script: Script }>(`/api/scripts/${id}`, data),
  deleteScript: (id: string) => del<{ ok: true }>(`/api/scripts/${id}`),
  applySelectionInstruction: (
    id: string,
    data: { blockField: string; selectedText: string; instruction: string }
  ) => post<{ script: Script }>(`/api/scripts/${id}/micro-edit`, { action: "selection_instruction", ...data }),
  regenerateScriptBlock: (id: string, block: "hook" | "storyboard" | "caption" | "hashtags") =>
    post<{ script: Script }>(`/api/scripts/${id}/micro-edit`, { action: "block_regenerate", block }),
  /** "Autre idée, même brief" (docs/SPEC_PROMPT_GENERATION_TECH.md §6) — remplace tout le contenu du
   *  script en place, brief verrouillé. Confirmation à afficher côté appelant avant d'exécuter (§6.3).
   *  `directive` optionnelle (docs/SPEC_REDACTEUR_EN_CHEF.md Lot A) : idée soufflée par le créateur, ou
   *  commentaire pré-rempli par la bascule select-all ≥80 %. */
  newIdea: (id: string, data?: { directive?: string }) =>
    post<{ script: Script }>(`/api/scripts/${id}/new-idea`, data),
  importScript: (data: {
    platform: Platform;
    /** Role du post libre ; omis quand seriesId est fourni (docs/SPEC_SERIES_ET_ROLES.md 4.2). */
    contentCategoryId?: string;
    contentType: ContentType;
    productId?: string;
    seriesId?: string;
    scheduledDate?: string;
    calendarEntryId?: string;
    title?: string;
    caption?: string;
    hashtags: string[];
    hookVisual?: string;
    hookText?: string;
    hookAudio?: string;
    storyboard?: StoryboardStep[];
    soundRecommendation?: string;
  }) => post<{ script: Script }>("/api/scripts/import", data),

  getMaterials: (productId?: string) =>
    apiFetch<{ materials: SourceMaterial[] }>(`/api/materials${productId ? `?productId=${productId}` : ""}`),
  addPastedMaterial: (data: { productId?: string; title?: string; rawText: string }) =>
    post<{ material: SourceMaterial }>("/api/materials", data),
  deleteMaterial: (id: string) => del<{ ok: true }>(`/api/materials/${id}`),
  /** Édition manuelle du résumé (docs/SPEC_REDACTEUR_EN_CHEF.md §7) — devient la source de vérité,
   *  jamais regénérée automatiquement ensuite. `null` remet le document en attente de résumé. */
  updateMaterialSummary: (id: string, summary: string | null) =>
    patch<{ material: SourceMaterial }>(`/api/materials/${id}`, { summary }),
  getMaterialCitations: (id: string) => apiFetch<{ citations: Citation[] }>(`/api/materials/${id}/citations`),
  /** Où chaque document d'un sujet est consommé dans les plans — lecture seule, ne crée aucun état. */
  getMaterialUsage: (productId: string) =>
    apiFetch<{ usage: Record<string, { episode: number; beatTitle: string }> }>(
      `/api/materials/usage?productId=${productId}`
    ),
  uploadMaterialFile: async (file: File, productId?: string) => {
    const formData = new FormData();
    formData.append("file", file);
    if (productId) formData.append("productId", productId);
    const res = await fetch("/api/materials/upload", { method: "POST", body: formData });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new ApiClientError(body?.error || `Erreur ${res.status}`);
    return body as { material: SourceMaterial };
  },

  getInterviewChat: (productId?: string) =>
    apiFetch<{ messages: OnboardingMessage[] }>(`/api/materials/interview${productId ? `?productId=${productId}` : ""}`),
  sendInterviewMessage: (message: string, productId?: string) =>
    post<{ reply: string; extractedMaterial: string | null }>("/api/materials/interview", { message, productId }),

  /** "Série depuis la matière" (docs/SPEC_REDACTEUR_EN_CHEF.md §4.4) — crée le plan (NarrativeState)
   *  de la série, ne génère plus de scripts synchrones : la génération suit ensuite le flux normal. */
  generateSeriesFromMaterial: (data: {
    productId?: string;
    seriesId?: string;
    newSeries?: { label: string; description: string; categoryId: string; weight?: number };
  }) => post<{ series: ContentSeries; state: NarrativeState }>("/api/series/from-material", data),
  saveScriptMetrics: (
    id: string,
    data: Partial<{ views: number; likes: number; comments: number; shares: number }>
  ) => put<{ metrics: PostMetrics }>(`/api/scripts/${id}/metrics`, data),

  getOnboardingChat: () => apiFetch<{ messages: OnboardingMessage[]; complete: boolean }>("/api/onboarding/chat"),
  sendOnboardingMessage: (message: string) =>
    post<{ reply: string; complete: boolean; series: OnboardingSeriesProposal[] }>("/api/onboarding/chat", {
      message,
    }),
  applyOnboardingSeriesSelection: (keptIds: string[]) =>
    post<{ series: unknown[] }>("/api/onboarding/series-selection", { keptIds }),

  getAssistantChat: () =>
    apiFetch<{ messages: OnboardingMessage[]; proposals: AssistantProposal[]; attachments: AssistantAttachment[] }>(
      "/api/assistant/chat"
    ),
  sendAssistantMessage: (message: string) =>
    post<{ reply: string; proposals: AssistantProposal[]; attachments: AssistantAttachment[] }>("/api/assistant/chat", {
      message,
    }),
  uploadAssistantAttachment: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    // Pas d'en-tête Content-Type explicite : le navigateur doit fixer lui-même la frontière
    // multipart, ce que le helper `apiFetch` (JSON par défaut) ne permet pas.
    const res = await fetch("/api/assistant/attachments", { method: "POST", body: formData });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      throw new ApiClientError(body?.error || `Erreur ${res.status}`);
    }
    return body as { attachment: AssistantAttachment };
  },
  discardAssistantAttachment: (id: string) => del<{ ok: true }>(`/api/assistant/attachments/${id}`),
  resolveAssistantProposal: (id: string, action: "accept" | "reject", fields?: Record<string, unknown>) =>
    post<{ proposals: AssistantProposal[] }>(`/api/assistant/proposals/${id}/resolve`, { action, fields }),

  getAssets: () => apiFetch<{ assets: BrandAsset[] }>("/api/assets"),
  uploadAssets: async (files: FileList | File[]) => {
    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append("files", file));
    // Pas d'en-tête Content-Type explicite : le navigateur doit fixer lui-même la frontière
    // multipart, ce que le helper `apiFetch` (JSON par défaut) ne permet pas.
    const res = await fetch("/api/assets", { method: "POST", body: formData });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      throw new ApiClientError(body?.error || `Erreur ${res.status}`);
    }
    return body as { assets: BrandAsset[] };
  },
  finalizeAssetPicker: (fileIds: string[]) => post<{ assets: BrandAsset[] }>("/api/assets/picker", { fileIds }),
  deleteAsset: (id: string) => del<{ ok: true }>(`/api/assets/${id}`),
  generateStagedImage: (data: { assetIds: string[]; instruction: string; scriptId?: string }) =>
    post<{ generatedImage: GeneratedImage }>("/api/assets/generate-image", data),

  getGoogleDriveConnection: () => apiFetch<GoogleDriveConnection>("/api/google-drive/connection"),
  connectGoogleDrive: (code: string) =>
    post<{ accessToken: string; status: string }>("/api/google-drive/connection", { code }),
  disconnectGoogleDrive: () => del<{ ok: true }>("/api/google-drive/connection"),

  getMatchCandidates: () => apiFetch<{ candidates: PostMatchCandidate[] }>("/api/performance/match-candidates"),
  refreshPerformance: () =>
    post<{ results: Array<{ platform: string; updated: number; candidatesCreated: number; error: string | null }> }>(
      "/api/performance/refresh"
    ),
  resolveMatchCandidate: (id: string, action: "confirm" | "dismiss") =>
    post<{ ok: true }>(`/api/performance/match-candidates/${id}/resolve`, { action }),

  getBillingInfo: () => apiFetch<BillingInfo>("/api/billing/subscription"),
  startCheckout: (plan: "starter" | "pro") => post<{ url: string }>("/api/billing/checkout", { plan }),
  openBillingPortal: () => post<{ url: string }>("/api/billing/portal"),
};
