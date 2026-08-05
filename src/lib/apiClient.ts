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
}

export interface Connection {
  platform: Platform;
  connected: boolean;
  connectedAt: string | null;
}

export interface PostingGoal {
  id: string;
  userId: string;
  platform: Platform;
  targetCountPerWeek: number;
}

export interface ContentSeries {
  id: string;
  userId: string;
  label: string;
  description: string;
  weight: number;
  archived: boolean;
  createdAt: string;
  categories: ContentCategorySummary[];
  /** Réseaux auxquels cette série est restreinte ; vide = visible sur tous les réseaux. */
  platforms: Platform[];
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
  updatedAt: string;
}

export interface Script {
  id: string;
  userId: string;
  productId: string | null;
  platform: Platform;
  title: string;
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
  series: ContentCategorySummary | null;
  status: ScriptStatus;
  createdAt: string;
  product?: Product | null;
  metrics?: PostMetrics | null;
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

export interface SourceFetchError {
  url: string;
  reason: string;
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
    | "posting_goal_update";
  targetId: string | null;
  payload: Record<string, unknown>;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
  resolvedAt: string | null;
}

export const api = {
  signup: (email: string, password: string) => post<{ user: User }>("/api/auth/signup", { email, password }),
  login: (email: string, password: string) => post<{ user: User }>("/api/auth/login", { email, password }),
  logout: () => post<{ ok: true }>("/api/auth/logout"),
  me: () => apiFetch<{ user: User | null }>("/api/auth/me"),

  getProfile: () => apiFetch<{ profile: CreatorProfile | null }>("/api/profile"),
  saveProfile: (data: {
    brandName: string;
    activityType: string;
    tone?: string;
    values?: string;
    equipment?: string[];
    weeklyTimeAvailable?: string;
  }) => post<{ profile: CreatorProfile }>("/api/profile", data),
  triggerStyleAnalysis: () => post<{ profile: CreatorProfile }>("/api/profile/style-analysis"),

  getContentCategories: () => apiFetch<{ categories: ContentCategory[] }>("/api/profile/content-categories"),
  generateContentCategories: () => post<{ categories: ContentCategory[] }>("/api/profile/content-categories"),
  saveContentCategories: (
    categories: Array<{ id?: string; label: string; description: string; weight: number; platforms: string[] }>
  ) => post<{ categories: ContentCategory[] }>("/api/profile/content-categories", { categories }),

  getContentSeries: () => apiFetch<{ series: ContentSeries[] }>("/api/series"),
  generateContentSeries: () => post<{ series: ContentSeries[] }>("/api/series"),
  saveContentSeries: (
    series: Array<{
      id?: string;
      label: string;
      description: string;
      weight: number;
      categoryIds: string[];
      platforms: string[];
    }>
  ) => post<{ series: ContentSeries[] }>("/api/series", { series }),

  getProducts: () => apiFetch<{ products: Product[] }>("/api/products"),
  createProducts: (
    items: Array<{ name: string; description?: string; valueProposition?: string; photoUrl?: string }>
  ) => post<{ products: Product[] }>("/api/products", items),
  updateProduct: (
    id: string,
    data: Partial<{ name: string; description: string; valueProposition: string; photoUrl: string }>
  ) => put<{ product: Product }>(`/api/products/${id}`, data),
  deleteProduct: (id: string) => del<{ ok: true }>(`/api/products/${id}`),

  getConnections: () => apiFetch<{ connections: Connection[] }>("/api/connections"),

  getPostingGoals: () => apiFetch<{ goals: PostingGoal[] }>("/api/posting-goals"),
  savePostingGoal: (platform: Platform, targetCountPerWeek: number) =>
    post<{ goal: PostingGoal }>("/api/posting-goals", { platform, targetCountPerWeek }),

  getCalendar: (month: string) =>
    apiFetch<{ entries: CalendarEntry[]; goals: PostingGoal[] }>(`/api/calendar?month=${month}`),
  generateCalendar: (month: string) => post<{ entries: CalendarEntry[] }>("/api/calendar/generate", { month }),
  placeScript: (scriptId: string, scheduledDate: string) =>
    post<{ entry: CalendarEntry }>("/api/calendar", { scriptId, scheduledDate }),
  updateCalendarEntryStatus: (id: string, status: CalendarStatus) =>
    patch<{ entry: CalendarEntry }>(`/api/calendar/${id}`, { status }),
  updateCalendarEntry: (id: string, data: { contentCategoryId?: string; seriesId?: string | null }) =>
    patch<{ entry: CalendarEntry }>(`/api/calendar/${id}`, data),
  deleteCalendarEntry: (id: string) => del<{ ok: true }>(`/api/calendar/${id}`),

  generateScriptForEntry: (calendarEntryId: string, contentType?: ContentType) =>
    post<{ script: Script }>("/api/scripts/generate", { calendarEntryId, contentType }),
  generateFreeformScript: (data: {
    platform: Platform;
    contentCategoryId: string;
    contentType: ContentType;
    productId?: string;
    scheduledDate?: string;
    seriesId?: string;
  }) => post<{ script: Script }>("/api/scripts", data),
  getScripts: (params?: { seriesId?: string }) =>
    apiFetch<{ scripts: Script[] }>(`/api/scripts${params?.seriesId ? `?seriesId=${params.seriesId}` : ""}`),
  getScript: (id: string) => apiFetch<{ script: Script }>(`/api/scripts/${id}`),
  regenerateScript: (id: string) => post<{ script: Script }>(`/api/scripts/${id}/regenerate`),
  updateScriptStatus: (id: string, status: ScriptStatus) =>
    patch<{ script: Script }>(`/api/scripts/${id}`, { status }),
  saveScriptMetrics: (
    id: string,
    data: Partial<{ views: number; likes: number; comments: number; shares: number }>
  ) => put<{ metrics: PostMetrics }>(`/api/scripts/${id}/metrics`, data),

  getOnboardingChat: () => apiFetch<{ messages: OnboardingMessage[]; complete: boolean }>("/api/onboarding/chat"),
  sendOnboardingMessage: (message: string) =>
    post<{ reply: string; complete: boolean }>("/api/onboarding/chat", { message }),

  getAssistantChat: () =>
    apiFetch<{ messages: OnboardingMessage[]; proposals: AssistantProposal[] }>("/api/assistant/chat"),
  sendAssistantMessage: (message: string, urls?: string[]) =>
    post<{ reply: string; proposals: AssistantProposal[]; sourceErrors?: SourceFetchError[] }>(
      "/api/assistant/chat",
      urls && urls.length > 0 ? { message, urls } : { message }
    ),
  resolveAssistantProposal: (id: string, action: "accept" | "reject", fields?: Record<string, unknown>) =>
    post<{ proposals: AssistantProposal[] }>(`/api/assistant/proposals/${id}/resolve`, { action, fields }),
};
