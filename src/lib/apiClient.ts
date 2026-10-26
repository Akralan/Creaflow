import type { PerformanceOverview } from "@/lib/performance/overview";
import type { Phase } from "@/lib/phases";
import type { Platform, ScriptStatus, CalendarStatus } from "@/lib/design/tokens";
import type { Form } from "@/lib/llm/postForms";

export class ApiClientError extends Error {
  constructor(
    message: string,
    /** HTTP status of the response, to tell an expired third-party access (409) from a real outage. */
    readonly status?: number
  ) {
    super(message);
  }
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiClientError(body?.error || `Error ${res.status}`, res.status);
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

/** What the Account tab displays — mirror of AccountSummary (accountService.ts), dates serialized. */
export interface AccountSummary {
  email: string;
  createdAt: string;
  providers: Array<{ id: string; displayName: string }>;
}

/** Public repository offered at the "Projects" step of dev onboarding and in settings > Topics.
 *  `alreadyConnected`: already the source of a topic — shown greyed out, not selectable again. */
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

/** Candidate offered by a connector, in the generic shape returned by
 *  /api/connectors/[provider]/candidates. `hint` is composed by the connector: the selection
 *  screen displays it without ever knowing which provider it comes from. */
export interface SourceCandidate {
  externalId: string;
  label: string;
  subjectName: string;
  subjectDescription: string | null;
  config: Record<string, unknown>;
  hint: string | null;
  alreadyConnected: boolean;
  /** The project already reading this candidate, when there is one. */
  connectedTo: { productId: string; productName: string } | null;
  /** Set by the Business context panel: the existing project this candidate joins. */
  productId?: string | null;
}

export interface SourceCandidateList {
  displayName: string;
  emptyMessage: string;
  footnote: string;
  candidates: SourceCandidate[];
}

/** Connected source feeding a topic's corpus. */
export interface MaterialSource {
  id: string;
  productId: string;
  type: "github_repo" | "notion_page" | "linear_project";
  /** Human-readable provider name, supplied by the connector — the UI does not derive it from `type`. */
  connectorLabel: string;
  externalId: string;
  label: string;
  syncCursor: string | null;
  lastSyncedAt: string | null;
  status: "ok" | "error" | "needs_reconnect";
  lastError: string | null;
  createdAt: string;
}

/** Events of a project counted by genre — the « Understand it » modal of Business context. */
export interface EventSummary {
  total: number;
  byGenre: Record<string, number>;
  unreadDocuments: number;
}

export interface SourceReadingStatus {
  documents: number;
  unread: number;
  events: number;
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
  /** Networks this category is restricted to; empty = visible on all networks. */
  platforms: Platform[];
  /** Material×category routing (docs/SPEC_MATIERE_EDITEUR.md §5.3) — under-represented when the corpus is dry. */
  materialHungry: boolean;
}

/** Light shape of a category as embedded (join) in a Script or a CalendarEntry. */
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
  /** "What do you expect from us?" (docs/SPEC_ONBOARDING_MVP.md §3). */
  expectations: string | null;
  /** Language of the generated posts ("en" | "fr"); null = the language of the notes. */
  language: string | null;
  /** Publishing days, ISO: 1 = Monday … 7 = Sunday. Never empty. */
  publishingDays: number[];
  /** X handle without the @, what the X numbers are read from (docs/SPEC_PERFORMANCE.md §4); null = none. */
  xHandle: string | null;
  /** Brand audience (docs/SPEC_PROMPT_GENERATION_TECH.md §5) — fallback for Product.targetAudience. */
  targetAudience: string | null;
  styleProfile: StyleProfile | null;
  styleProfileUpdatedAt: string | null;
  /** Brand identity of the mockups (docs/SPEC_DESIGN_HTML_SUR_IMAGE.md §2), null while nothing is defined. */
  brandKit?: BrandKit | null;
}

export interface BrandKit {
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  fontHeading: string | null;
  fontBody: string | null;
  logoAssetId: string | null;
}

export interface DesignTheme {
  palette: string[];
  fontHeading: string;
  fontBody: string;
  mood: string;
}

export interface DesignSlide {
  planNumber: number;
  /** HTML passed through the server-side allow-list — placeholders {{IMG:p1}} / {{LOGO}} not resolved. */
  html: string;
  exportKey: string | null;
  exportUrl: string | null;
}

export type DesignImageVariant = "original" | "cutout";

/** Photo of a mockup (docs/SPEC_COMPOSITION_VISUELLE.md §4), referenced by {{IMG:ref}} in the HTML. */
export interface DesignImage {
  ref: string;
  assetId: string;
  variant: DesignImageVariant;
  thumbnailUrl: string | null;
  /** The cutout is already computed (instant switch). */
  hasCutout: boolean;
}

/** Mockup of a visual post (docs/SPEC_DESIGN_HTML_SUR_IMAGE.md §4, docs/SPEC_COMPOSITION_VISUELLE.md §4). */
export interface VisualDesign {
  id: string;
  scriptId: string;
  images: DesignImage[];
  /** The server has a background-removal provider configured. */
  cutoutAvailable: boolean;
  width: number;
  height: number;
  theme: DesignTheme;
  slides: DesignSlide[];
  status: "draft" | "stale" | "exported";
  lastInstruction: string | null;
  /** Animation (docs/SPEC_FORMAT_VISUEL_ET_ANIMATION.md): null for a static mockup. */
  durationMs: number | null;
  timeline: TimelineEntry[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface TimelineEntry {
  layerId: string;
  enter: "fade" | "slide-up" | "slide-left" | "zoom-in" | "typewriter";
  startMs: number;
  enterMs: number;
  exit: "fade" | "slide-down" | "slide-right" | "none" | null;
  exitAtMs: number | null;
}

/** Mirror of styleProfileSchema (src/lib/llm/styleProfile.ts). The lists may be missing on a
 *  profile stored before the learning work — read with `?? []`. */
export interface StyleProfile {
  tone: string;
  sentenceLength: string;
  emojiUsage: string;
  vocabulary: string;
  summary: string;
  rules?: StyleRule[];
  avoid?: string[];
  prefer?: string[];
  evidence?: { scriptCount: number; learnedAt: string | null };
}

export interface StyleRule {
  text: string;
  platform: string | null;
}

export interface StyleLearningStatus {
  /** Finalized scripts (shot/published) never read by a learning pass. */
  pendingScripts: number;
  lastLearnedAt: string | null;
  pendingProposalId: string | null;
}

export interface Product {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  valueProposition: string | null;
  photoUrl: string | null;
  /** Per-topic audience override (docs/SPEC_PROMPT_GENERATION_TECH.md §5) — null = brand fallback. */
  targetAudience: string | null;
  /** The problem the project solves — « The problem you solve » on the context screen. */
  problem?: string | null;
  /** Reader portrait (docs/SPEC_PROMPT_GENERATION_V3.md §2.2) — null until it is produced. */
  readerPortrait: ReaderPortrait | null;
  /** Où en est le projet (src/lib/phases.ts). */
  phase: Phase;
}

export interface PortraitReader {
  label: string;
  who: string;
  knows: string;
  wants: string;
  stopsFor: string;
  turnsOff: string;
  words: string[];
}

export interface ReaderPortrait {
  readers: PortraitReader[];
  generatedAt: string | null;
  editedByUser: boolean;
  basedOnAudience: string | null;
}

export interface Connection {
  platform: Platform;
  connected: boolean;
  connectedAt: string | null;
  /** null if not connected. "needs_reconnect" = token refresh failed, reconnection required. */
  status: "ok" | "needs_reconnect" | null;
  hasMetricsFetch: boolean;
}

export interface PostingGoal {
  id: string;
  userId: string;
  platform: Platform;
  targetCountPerWeek: number;
}

export interface StoryboardStep {
  planNumber: number;
  description: string;
}

export type ContentType = "visual" | "text";

/** Format of a visual post (docs/SPEC_FORMAT_VISUEL_ET_ANIMATION.md) — property of the script. */
export type VisualFormat = "single" | "carousel" | "animation";
export interface VisualFormatFields {
  visualFormat?: VisualFormat;
  /** Carousel: 2 to 10. */
  slideCount?: number;
  /** Animation: 5,000 to 15,000. */
  durationMs?: number;
  /** False = visual only, short caption; absent or true = a text post + visual. */
  withText?: boolean;
}

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
  /** Nullable: lazy creation (§4.5) — the row may be created before a title exists. */
  title: string | null;
  /** Generation intent (docs/SPEC_PROMPT_GENERATION_TECH.md §2) — not shown to the user
   *  in V1 (§6.4); present here only to condition display of the "another idea" button. */
  concept: string | null;
  contentType: ContentType;
  /** Format of the visual post — "single" outside contentType "visual". */
  visualFormat: VisualFormat;
  slideCount: number | null;
  durationMs: number | null;
  /** hookVisual/storyboard : posts visuels ; hookText : posts texte. */
  hookVisual: string | null;
  hookText: string | null;
  storyboard: StoryboardStep[] | null;
  caption: string;
  hashtags: string[];
  contentCategory: ContentCategorySummary;
  /** Imposed angle (anti-repetition mechanism) — present only on the detailed record (GET /api/scripts/:id). */
  angle?: { id: string; label: string; description: string } | null;
  series: ContentCategorySummary | null;
  status: ScriptStatus;
  /** "generated" (LLM) / "imported" (POST /api/scripts/import) / "manual" (lazy creation in the editor). */
  origin: "generated" | "imported" | "manual";
  createdAt: string;
  updatedAt: string;
  product?: Product | null;
  metrics?: PostMetrics | null;
  /** Brand photo found by semantic search at generation (contentType "visual") — suggested first for the mockup. */
  brandAssetId: string | null;
  /** Mockup of the visual post — detailed record only, null until one has been composed. */
  visualDesign?: VisualDesign | null;
  /** Material used for this script — present only on the detailed record. */
  citations?: Citation[];
  /** The event told (docs/SPEC_REDACTEUR_PAR_EVENEMENTS.md §5) — null outside a series with a reader. */
  eventId: string | null;
  /** Title and date of the event, resolved at read time — detailed record only. */
  eventTitle?: string | null;
  eventDate?: string | null;
  /** The form the writer declared (docs/FORMES_ET_GENRES.md): shown as FORM_LABELS[form], nothing for
   *  `episode`. Null on posts from before the chantier and on the V3 path. */
  form: Form | null;
}

export interface SourceMaterial {
  id: string;
  userId: string;
  productId: string | null;
  kind: "paste" | "file" | "interview";
  title: string | null;
  rawText: string;
  /** Summary oriented toward narrative potential (docs/SPEC_REDACTEUR_EN_CHEF.md §2/§3.1) — null until the
   *  summarizer has processed it (summary in progress). */
  summary: string | null;
  createdAt: string;
}

export type MaterialEventKind = "failure" | "decision" | "result" | "feedback" | "milestone";
export type MaterialEventDatePrecision = "day" | "month" | "unknown";

/** Pointeur sur la ligne de temps d'un sujet (docs/SPEC_EVENEMENT_POINTEUR.md §2) : un document,
 *  une ligne, une date. Aucun autre champ. */
export interface MaterialEvent {
  id: string;
  productId: string;
  /** YYYY-MM-DD, ou null quand la ligne ne porte pas de date. */
  date: string | null;
  line: number;
  sourceMaterialId: string;
  sourceMaterial?: { id: string; title: string | null } | null;
  createdAt: string;
}

export interface EventReadingReport {
  documents: number;
  documentsRead: number;
  /** Appels au modèle : une part de document par appel. */
  calls: number;
  pointers: number;
  /** Documents dont la lecture a échoué, laissés non lus pour la prochaine passe. */
  failed: number;
}

/** Post-generation citation (docs/SPEC_MATIERE_EDITEUR.md §3) — passage of the corpus reported as
 *  used by the LLM at generation, found in the source text by approximate search. */
export interface Citation {
  id: string;
  sourceMaterialId: string | null;
  sourceMaterialTitle?: string | null;
  scriptId?: string | null;
  scriptTitle?: string | null;
  excerpt: string;
  /** Position in the source text, present only on the "citations of a document" view. */
  matchStart?: number | null;
  matchLength?: number | null;
  /** Present only on the "citations of a script" view (GET /api/scripts/:id). */
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

/** What an empty slot will become: the episode planned by its series' plan and the linked project. */
export interface UpcomingPost {
  title: string | null;
  project: string | null;
}

/** Week-view slot: the post itself, to display it as a post and not a box. */
export interface WeekEntry extends Omit<CalendarEntry, "script"> {
  /** Empty slot only (null for a past slot). */
  upcoming?: UpcomingPost | null;
  script: {
    id: string;
    title: string | null;
    status: ScriptStatus;
    contentType: ContentType;
    visualFormat: VisualFormat;
    slideCount: number | null;
    durationMs: number | null;
    hookText: string | null;
    /** Beginning of the post text only. */
    caption: string | null;
    form: Form | null;
    /** First slide of the mockup (placeholders not resolved), null until it is composed. */
    preview: {
      html: string;
      width: number;
      height: number;
      slideCount: number;
      images: Array<{ ref: string; assetId: string; variant: DesignImageVariant }>;
    } | null;
  } | null;
}

export interface OnboardingMessage {
  role: "user" | "assistant";
  content: string;
}

/** Onboarding state (docs/SPEC_ONBOARDING_MVP.md §2) — `signedIn: false` on screen 1, before
 *  the first connection creates the account. */
export type OnboardingState =
  | { signedIn: false }
  | {
      signedIn: true;
      hasProfile: boolean;
      connectedProviders: Array<{ id: string; displayName: string }>;
      suggestedName: string;
      sources: Array<{ id: string; provider: string; providerLabel: string; label: string; productId: string }>;
      notes: Array<{ id: string; excerpt: string }>;
    };

/** Topic proposed by reading the material: `keys` = grouped `source:<id>` / `note:<id>`. */
export interface OnboardingSubjectDraft {
  name: string;
  description: string;
  /** "Who is it for" of this topic (docs/SPEC_PROMPT_GENERATION_V3.md §2.1). */
  targetAudience: string;
  keys: string[];
}

export interface OnboardingDraft {
  activityType: string;
  targetAudience: string;
  subjects: OnboardingSubjectDraft[];
  extracted: boolean;
  /** Readable reason when the AI reading failed. */
  failureReason: string | null;
}

/** A style learning pass waiting for approval (docs/SPEC_APPRENTISSAGE_STYLE.md §6.1). */
export interface StyleProposal {
  id: string;
  userId: string;
  kind: "style_profile_update";
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
  /** Cutout PNG, once computed (docs/SPEC_COMPOSITION_VISUELLE.md §2). */
  cutoutUrl: string | null;
  status: "pending" | "ready" | "unreachable";
  aiDescription: string | null;
  tags: string[] | null;
  productId: string | null;
  createdAt: string;
}

export interface QuotaStatus {
  allowed: boolean;
  used: number;
  limit: number;
  planName: string;
  /** What the counter counts: weeks of content (trial) or scripts (subscription). */
  unit: "weeks" | "scripts";
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
  /** Separate pool for the editor's micro-edits (docs/SPEC_MATIERE_EDITEUR.md §4.6). */
  microEditQuota: QuotaStatus;
  plans: Array<{ id: "starter" | "pro"; name: string; scriptsPerMonth: number }>;
}

export interface GoogleDriveConnection {
  connected: boolean;
  status: "ok" | "needs_reconnect" | null;
  driveAccountEmail: string | null;
  connectedAt: string | null;
}

/** /admin/quotas screen (docs/SPEC_QUOTAS_ADMIN.md). `custom` null = normal limit. */
export interface AdminAccountQuotas {
  userId: string;
  email: string;
  subscription: { plan: string; status: string } | null;
  scripts: { used: number; limit: number; planName: string; unit: "weeks" | "scripts"; custom: number | null };
  microEdits: { used: number; limit: number; planName: string; custom: number | null };
}

/** The animation of a post (docs/SPEC_ANIMATION_HTML_LIBRE.md): the whole sealed page, ready for an iframe. */
export interface PostAnimation {
  scriptId: string;
  document: string;
  durationMs: number;
  width: number;
  height: number;
  concept: string;
  beats: Array<{ fromMs: number; toMs: number; shows: string; motion: string }>;
}

export interface StartAnalysis {
  repo: { fullName: string; name: string; description: string | null; defaultBranch: string; language: string | null };
  card: { name: string; tagline: string; building: string; who: string; problem: string; phase: Phase; phaseReason: string };
  extracted: boolean;
  failureReason: string | null;
}

export interface StartCreateInput {
  repo: string;
  name: string;
  building: string;
  who: string;
  problem: string;
  /** Pourquoi la personne se met à publier — le sujet du post d'origine. */
  why?: string;
  days: number[];
  /** Où en est le projet : devinée par la carte, corrigée par la personne. */
  phase: Phase;
  email: string;
}

export const api = {
  signup: (email: string) => post<{ user: User }>("/api/auth/signup", { email }),
  /** Sends a sign-in link to this address. Always responds ok, whether or not the address is known. */
  requestLoginLink: (email: string) => post<{ ok: true }>("/api/auth/link/request", { email }),
  logout: () => post<{ ok: true }>("/api/auth/logout"),
  me: () => apiFetch<{ user: User | null }>("/api/auth/me"),
  // /start flow (docs/SPEC_ENTREE_PAR_LE_REPO.md): read a public repo, create the account from the card, sign in from the email link.
  startAnalyze: (repo: string) => post<StartAnalysis>("/api/start/analyze", { repo }),
  startCreate: (input: StartCreateInput) => post<{ ok: true }>("/api/start", input),
  startResend: (email: string) => post<{ ok: true }>("/api/start/resend", { email }),
  consumeLoginLink: (token: string) => post<{ ok: true; redirect: string }>("/api/auth/link", { token }),

  // Account tab (docs/SPEC_LEGAL_EMAIL_RGPD.md §4) — the person, not their brand.
  getAccount: () => apiFetch<{ account: AccountSummary }>("/api/account"),
  /** The body is the export file itself; the client offers it for download. */
  exportAccount: () => apiFetch<Record<string, unknown>>("/api/account/export"),
  deleteAccount: (confirmation: { emailConfirmation: string }) =>
    apiFetch<{ ok: true }>("/api/account", { method: "DELETE", body: JSON.stringify(confirmation) }),
  /** The GitHub button on /login is only rendered if the environment variables are present. */
  getGithubStatus: () => apiFetch<{ configured: boolean }>("/api/auth/github/status"),

  getGithubRepos: () => apiFetch<{ repos: GithubRepoOption[] }>("/api/github/repos"),
  connectGithubRepos: (repos: GithubRepoOption[]) =>
    post<{ results: ConnectRepoResult[] }>("/api/github/repos", { repos }),

  /** Identity providers configured on this environment — /login only shows those. */
  getOAuthProviders: () => apiFetch<{ providers: Array<{ id: string; displayName: string }> }>("/api/auth/oauth/providers"),

  getSourceCandidates: (provider: string) =>
    apiFetch<SourceCandidateList>(`/api/connectors/${provider}/candidates`),
  connectSources: (provider: string, candidates: SourceCandidate[]) =>
    post<{ results: ConnectRepoResult[] }>(`/api/connectors/${provider}/candidates`, {
      candidates: candidates.map(({ externalId, label, subjectName, subjectDescription, config, productId }) => ({
        externalId,
        label,
        subjectName,
        subjectDescription,
        config,
        ...(productId ? { productId } : {}),
      })),
    }),

  getMaterialSources: (productId: string) =>
    apiFetch<{ sources: MaterialSource[] }>(`/api/material-sources?productId=${productId}`),
  getEventSummary: (productId: string) => apiFetch<EventSummary>(`/api/events/summary?productId=${productId}`),
  /** Where the reading of a source stands: its documents, those not read yet, the events found so far. */
  getMaterialSourceStatus: (id: string) => apiFetch<SourceReadingStatus>(`/api/material-sources/${id}/status`),
  syncMaterialSource: (id: string) => post<{ report: SyncReport }>(`/api/material-sources/${id}/sync`),
  /** Also deletes the source's mirror documents — confirm on the UI side before calling. */
  deleteMaterialSource: (id: string) => del<{ ok: true }>(`/api/material-sources/${id}`),

  getProfile: () =>
    apiFetch<{
      profile: CreatorProfile | null;
      vertical: "creator" | "dev" | "artisan" | "entrepreneur";
      /** Providers this account is linked to. It is THIS list that says which selector
       *  to show, not the vertical — "dev" covers GitHub as well as Linear. */
      connectedProviders: Array<{ id: string; displayName: string }>;
      githubConnected: boolean;
      styleLearning: StyleLearningStatus;
    }>("/api/profile"),
  saveProfile: (data: {
    brandName: string;
    activityType: string;
    targetAudience?: string;
    expectations?: string;
    language?: string | null;
    publishingDays?: number[];
    xHandle?: string;
  }) => post<{ profile: CreatorProfile }>("/api/profile", data),
  /** Style learning pass (docs/SPEC_APPRENTISSAGE_STYLE.md). `proposalId` null = profile
   *  written directly (first analysis), otherwise a proposal to validate was created. */
  triggerStyleAnalysis: (options?: { includeLearned?: boolean }) =>
    post<{
      profile: CreatorProfile;
      styleLearning: StyleLearningStatus;
      proposalId: string | null;
      changeNotes: string;
      proposedStyleProfile: StyleProfile;
    }>("/api/profile/style-analysis", options ?? {}),
  updateStyleLists: (data: { rules?: StyleRule[]; avoid?: string[]; prefer?: string[] }) =>
    patch<{ styleProfile: StyleProfile }>("/api/profile/style", data),
  saveBrandKit: (data: BrandKit) => patch<{ brandKit: BrandKit }>("/api/profile/brand-kit", data),

  // Mockup of a visual post (docs/SPEC_DESIGN_HTML_SUR_IMAGE.md §5.3)
  createDesign: (scriptId: string, data: { assetIds: string[]; format?: string }) =>
    post<{ design: VisualDesign; rationale: string }>(`/api/scripts/${scriptId}/design`, data),
  addDesignImage: (scriptId: string, assetId: string) => post<{ design: VisualDesign; ref: string }>(`/api/scripts/${scriptId}/design/images`, { assetId }),
  instructDesign: (scriptId: string, data: { instruction: string; planNumber?: number | null }) =>
    post<{ design: VisualDesign; rationale: string }>(`/api/scripts/${scriptId}/design/instruct`, data),
  patchDesign: (
    scriptId: string,
    data: {
      slides?: { planNumber: number; html: string }[];
      theme?: DesignTheme;
      images?: { ref: string; assetId: string; variant: DesignImageVariant }[];
      timeline?: TimelineEntry[];
      durationMs?: number;
    }
  ) =>
    patch<{ design: VisualDesign }>(`/api/scripts/${scriptId}/design`, data),
  deleteDesign: (scriptId: string) => del<{ ok: true }>(`/api/scripts/${scriptId}/design`),
  exportDesign: async (scriptId: string, files: { planNumber: number; blob: Blob }[]) => {
    const formData = new FormData();
    for (const f of files) formData.append(`slide-${f.planNumber}`, f.blob, `slide-${f.planNumber}.png`);
    // Multipart: the browser sets the boundary itself (see uploadAssets).
    const res = await fetch(`/api/scripts/${scriptId}/design/export`, { method: "POST", body: formData });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new ApiClientError(body?.error || `Error ${res.status}`);
    return body as { design: VisualDesign };
  },
  getStyleProposal: () => apiFetch<{ proposal: StyleProposal | null }>("/api/profile/style/proposal"),
  resolveStyleProposal: (id: string, action: "accept" | "reject", fields?: Record<string, unknown>) =>
    post<{ proposal: StyleProposal | null }>(`/api/profile/style/proposal/${id}`, { action, fields }),

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



  getProducts: () => apiFetch<{ products: Product[] }>("/api/products"),
  createProducts: (
    items: Array<{ name: string; description?: string; valueProposition?: string; photoUrl?: string }>
  ) => post<{ products: Product[] }>("/api/products", items),
  updateProduct: (
    id: string,
    data: Partial<{ name: string; description: string; valueProposition: string; photoUrl: string; targetAudience: string | null; problem: string | null; phase: Phase }>
  ) => put<{ product: Product }>(`/api/products/${id}`, data),
  deleteProduct: (id: string) => del<{ ok: true }>(`/api/products/${id}`),
  regenerateReaderPortrait: (id: string) => post<{ readerPortrait: ReaderPortrait }>(`/api/products/${id}/reader-portrait`, {}),
  saveReaderPortrait: (id: string, readers: PortraitReader[]) =>
    put<{ readerPortrait: ReaderPortrait }>(`/api/products/${id}/reader-portrait`, { readers }),

  getConnections: () => apiFetch<{ connections: Connection[] }>("/api/connections"),

  getPostingGoals: () => apiFetch<{ goals: PostingGoal[] }>("/api/posting-goals"),
  savePostingGoal: (platform: Platform, active: boolean) =>
    post<{ goal: PostingGoal }>("/api/posting-goals", { platform, active }),

  getCalendar: (month: string) =>
    apiFetch<{ entries: CalendarEntry[]; goals: PostingGoal[] }>(`/api/calendar?month=${month}`),
  /** Week view: `to` exclusive, dates in YYYY-MM-DD format. */
  getCalendarWeek: (from: string, to: string, options?: { all?: boolean }) =>
    apiFetch<{
      entries: WeekEntry[];
      goals: PostingGoal[];
      authorName: string;
      hasLogo: boolean;
      /** First empty slot coming up outside the displayed strip: the "next post" card. */
      nextSlot: WeekEntry | null;
    }>(
      `/api/calendar?from=${from}&to=${to}${options?.all ? "&all=1" : ""}`
    ),
  /** Writes the post of an empty slot for both networks, in the background (the slots then read "generating"). */
  writePost: (entryId: string) => post<{ ok: true }>("/api/posts/write", { entryId }),
  /** « Prepare next week »: writes, in the background, every empty slot of the week starting `weekStart` (a Monday). */
  prepareWeek: (weekStart: string) => post<{ ok: true; posts: number }>("/api/weeks/prepare", { weekStart }),
  /** Adds or changes the visual of a post (image, carousel, animation); the text stays. Counts as a micro-edit. */
  setPostVisual: (scriptId: string, visual: VisualFormatFields) => post<{ ok: true; scriptId: string }>("/api/posts/visual", { scriptId, ...visual }),
  /** The animation of a post as the sealed page the browser plays, or null. */
  getPostAnimation: (scriptId: string) => apiFetch<{ animation: PostAnimation | null }>(`/api/posts/animation?scriptId=${scriptId}`),
  /** The model writes the animation of a post (a few tens of seconds). A micro-edit. */
  createPostAnimation: (scriptId: string, durationMs: number) => post<{ animation: PostAnimation }>("/api/posts/animation", { scriptId, durationMs }),
  /** The rendering test found something wrong: the model corrects its page. */
  revisePostAnimation: (scriptId: string, issues: string[]) => put<{ animation: PostAnimation }>("/api/posts/animation", { scriptId, issues }),
  removePostAnimation: (scriptId: string) => del<{ ok: true }>(`/api/posts/animation?scriptId=${scriptId}`),
  removePostVisual: (scriptId: string) => del<{ ok: true }>(`/api/posts/visual?scriptId=${scriptId}`),
  getCalendarEntry: (id: string) => apiFetch<{ entry: CalendarEntry }>(`/api/calendar/${id}`),
  placeScript: (scriptId: string, scheduledDate: string) =>
    post<{ entry: CalendarEntry }>("/api/calendar", { scriptId, scheduledDate }),
  updateCalendarEntryStatus: (id: string, status: CalendarStatus) =>
    patch<{ entry: CalendarEntry }>(`/api/calendar/${id}`, { status }),
  updateCalendarEntry: (id: string, data: { contentCategoryId?: string; seriesId?: string | null }) =>
    patch<{ entry: CalendarEntry }>(`/api/calendar/${id}`, data),
  deleteCalendarEntry: (id: string) => del<{ ok: true }>(`/api/calendar/${id}`),

  getAdminQuotas: (email: string) =>
    apiFetch<{ account: AdminAccountQuotas }>(`/api/admin/quotas?email=${encodeURIComponent(email)}`),
  setAdminQuotas: (data: { userId: string; scriptLimit: number | null; microEditLimit: number | null }) =>
    put<{ account: AdminAccountQuotas }>("/api/admin/quotas", data),

  generateScriptForEntry: (calendarEntryId: string, contentType?: ContentType, productId?: string, directive?: string, visual?: VisualFormatFields) =>
    post<{ script: Script }>("/api/scripts/generate", { calendarEntryId, contentType, productId, directive, ...visual }),
  generateFreeformScript: (data: {
    platform: Platform;
    /** Role of the free post; omitted when seriesId is provided - the server then derives the role from the
     *  series (docs/SPEC_SERIES_ET_ROLES.md 4.2). */
    contentCategoryId?: string;
    contentType: ContentType;
    productId?: string;
    scheduledDate?: string;
    seriesId?: string;
    directive?: string;
  } & VisualFormatFields) => post<{ script: Script }>("/api/scripts", data),
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
      storyboard: StoryboardStep[];
      caption: string;
      hashtags: string[];
    }>
  ) => patch<{ script: Script }>(`/api/scripts/${id}`, data),
  deleteScript: (id: string) => del<{ ok: true }>(`/api/scripts/${id}`),
  applySelectionInstruction: (
    id: string,
    data: { blockField: string; selectedText: string; instruction: string }
  ) => post<{ script: Script }>(`/api/scripts/${id}/micro-edit`, { action: "selection_instruction", ...data }),
  regenerateScriptBlock: (id: string, block: "hook" | "storyboard" | "caption" | "hashtags") =>
    post<{ script: Script }>(`/api/scripts/${id}/micro-edit`, { action: "block_regenerate", block }),
  /** "Another idea, same brief" (docs/SPEC_PROMPT_GENERATION_TECH.md §6) — replaces the whole content of the
   *  script in place, locked brief. Confirmation to display on the caller side before executing (§6.3).
   *  Optional `directive` (docs/SPEC_REDACTEUR_EN_CHEF.md Lot A): idea suggested by the creator, or
   *  comment pre-filled by the ≥80% select-all toggle. */
  newIdea: (id: string, data?: { directive?: string }) =>
    post<{ script: Script }>(`/api/scripts/${id}/new-idea`, data),
  importScript: (data: {
    platform: Platform;
    /** Role of the free post; omitted when seriesId is provided (docs/SPEC_SERIES_ET_ROLES.md 4.2). */
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
    storyboard?: StoryboardStep[];
  }) => post<{ script: Script }>("/api/scripts/import", data),

  // Timeline of a topic (docs/SPEC_REDACTEUR_PAR_EVENEMENTS.md §3).
  getEvents: (productId: string) =>
    apiFetch<{ events: MaterialEvent[]; unreadDocuments: number }>(`/api/events?productId=${productId}`),
  // RETIRÉS avec le chantier (docs/SPEC_EVENEMENT_POINTEUR.md §2) : un pointeur ne se crée ni ne
  // s'édite à la main, c'est une adresse produite par la lecture. Seule la suppression reste.
  deleteEvent: (id: string) => del<{ ok: true }>(`/api/events/${id}`),
  /** Lit les documents du sujet pas encore lus et enregistre leurs pointeurs. */
  readEvents: (productId: string) => post<{ report: EventReadingReport }>("/api/events/read", { productId }),
  getMaterials: (productId?: string) =>
    apiFetch<{ materials: SourceMaterial[] }>(`/api/materials${productId ? `?productId=${productId}` : ""}`),
  addPastedMaterial: (data: { productId?: string; title?: string; rawText: string }) =>
    post<{ material: SourceMaterial }>("/api/materials", data),
  deleteMaterial: (id: string) => del<{ ok: true }>(`/api/materials/${id}`),
  /** Manual edit of the summary (docs/SPEC_REDACTEUR_EN_CHEF.md §7) — becomes the source of truth,
   *  never regenerated automatically afterwards. `null` puts the document back to awaiting a summary. */
  updateMaterialSummary: (id: string, summary: string | null) =>
    patch<{ material: SourceMaterial }>(`/api/materials/${id}`, { summary }),
  getMaterialCitations: (id: string) => apiFetch<{ citations: Citation[] }>(`/api/materials/${id}/citations`),
  uploadMaterialFile: async (file: File, productId?: string) => {
    const formData = new FormData();
    formData.append("file", file);
    if (productId) formData.append("productId", productId);
    const res = await fetch("/api/materials/upload", { method: "POST", body: formData });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new ApiClientError(body?.error || `Error ${res.status}`);
    return body as { material: SourceMaterial };
  },

  getInterviewChat: (productId?: string) =>
    apiFetch<{ messages: OnboardingMessage[] }>(`/api/materials/interview${productId ? `?productId=${productId}` : ""}`),
  sendInterviewMessage: (message: string, productId?: string) =>
    post<{ reply: string; extractedMaterial: string | null }>("/api/materials/interview", { message, productId }),

  saveScriptMetrics: (
    id: string,
    data: Partial<{ views: number; likes: number; comments: number; shares: number }>
  ) => put<{ metrics: PostMetrics }>(`/api/scripts/${id}/metrics`, data),

  getOnboardingState: () => apiFetch<OnboardingState>("/api/onboarding/state"),
  addOnboardingNotes: (text: string) => post<{ note: { id: string; excerpt: string } }>("/api/onboarding/notes", { text }),
  draftOnboardingProfile: (name: string) => post<{ draft: OnboardingDraft }>("/api/onboarding/draft", { name }),
  completeOnboarding: (data: {
    name: string;
    activityType: string;
    targetAudience?: string;
    expectations?: string;
    publishingDays: number[];
    platforms: string[];
    subjects: Array<{ name: string; description?: string; targetAudience?: string; keys: string[] }>;
  }) => post<{ ok: true }>("/api/onboarding/complete", data),

  getAssets: () => apiFetch<{ assets: BrandAsset[]; cutoutAvailable: boolean }>("/api/assets"),
  cutoutAsset: (id: string) => post<{ asset: BrandAsset }>(`/api/assets/${id}/cutout`, {}),
  uploadAssets: async (files: FileList | File[]) => {
    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append("files", file));
    // No explicit Content-Type header: the browser must set the multipart boundary
    // itself, which the `apiFetch` helper (JSON by default) does not allow.
    const res = await fetch("/api/assets", { method: "POST", body: formData });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      throw new ApiClientError(body?.error || `Error ${res.status}`, res.status);
    }
    return body as { assets: BrandAsset[] };
  },
  finalizeAssetPicker: (fileIds: string[]) => post<{ assets: BrandAsset[] }>("/api/assets/picker", { fileIds }),
  deleteAsset: (id: string) => del<{ ok: true }>(`/api/assets/${id}`),

  getGoogleDriveConnection: () => apiFetch<GoogleDriveConnection>("/api/google-drive/connection"),
  connectGoogleDrive: (code: string) =>
    post<{ accessToken: string; status: string }>("/api/google-drive/connection", { code }),
  disconnectGoogleDrive: () => del<{ ok: true }>("/api/google-drive/connection"),

  getMatchCandidates: () => apiFetch<{ candidates: PostMatchCandidate[] }>("/api/performance/match-candidates"),
  getPerformanceOverview: () => apiFetch<PerformanceOverview>("/api/performance/overview"),
  setXHandle: (handle: string) => put<{ xHandle: string | null }>("/api/performance/x-handle", { handle }),
  refreshPerformance: () =>
    post<{ results: Array<{ platform: string; updated: number; linked: number; failed: number; candidatesCreated: number; error: string | null }> }>(
      "/api/performance/refresh"
    ),
  resolveMatchCandidate: (id: string, action: "confirm" | "dismiss") =>
    post<{ ok: true }>(`/api/performance/match-candidates/${id}/resolve`, { action }),

  getBillingInfo: () => apiFetch<BillingInfo>("/api/billing/subscription"),
  startCheckout: (plan: "starter" | "pro") => post<{ url: string }>("/api/billing/checkout", { plan }),
  openBillingPortal: () => post<{ url: string }>("/api/billing/portal"),
};
