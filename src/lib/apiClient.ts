import type { ContentCategory, Platform, ScriptStatus, CalendarStatus } from "@/lib/design/tokens";

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

export interface CategoryLabelEntry {
  label: string;
  description: string;
  weight: number;
}

export interface CategoryLabels {
  vente: CategoryLabelEntry;
  coulisses: CategoryLabelEntry;
  educatif: CategoryLabelEntry;
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
  categoryLabels: CategoryLabels | null;
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

export interface StoryboardStep {
  planNumber: number;
  description: string;
}

export interface Script {
  id: string;
  userId: string;
  productId: string | null;
  platform: Platform;
  title: string;
  hookVisual: string;
  hookText: string;
  hookAudio: string;
  storyboard: StoryboardStep[];
  caption: string;
  hashtags: string[];
  soundRecommendation: string;
  contentCategory: ContentCategory;
  status: ScriptStatus;
  createdAt: string;
  product?: Product | null;
}

export interface CalendarEntry {
  id: string;
  userId: string;
  scriptId: string | null;
  platform: Platform;
  scheduledDate: string;
  contentCategory: ContentCategory;
  status: CalendarStatus;
  reminderSent: boolean;
  script: { id: string; title: string; status: ScriptStatus } | null;
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

  generateCategoryLabels: () => post<{ categoryLabels: CategoryLabels }>("/api/profile/category-labels"),
  saveCategoryLabels: (labels: CategoryLabels) =>
    post<{ categoryLabels: CategoryLabels }>("/api/profile/category-labels", labels),

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
  updateCalendarEntryStatus: (id: string, status: CalendarStatus) =>
    patch<{ entry: CalendarEntry }>(`/api/calendar/${id}`, { status }),

  generateScriptForEntry: (calendarEntryId: string) =>
    post<{ script: Script }>("/api/scripts/generate", { calendarEntryId }),
  generateFreeformScript: (data: { platform: Platform; contentCategory: ContentCategory; productId?: string }) =>
    post<{ script: Script }>("/api/scripts", data),
  getScript: (id: string) => apiFetch<{ script: Script }>(`/api/scripts/${id}`),
  regenerateScript: (id: string) => post<{ script: Script }>(`/api/scripts/${id}/regenerate`),
  updateScriptStatus: (id: string, status: ScriptStatus) =>
    patch<{ script: Script }>(`/api/scripts/${id}`, { status }),
};
