import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { assistantProposals, assistantSessions, creatorProfiles, postingGoals, products } from "@/db/schema";
import { runAssistantChatTurn, type AssistantMessage } from "@/lib/llm/assistantChat";
import { listActiveSeriesForUser, upsertSeriesItem } from "@/lib/services/seriesService";
import {
  listActiveCategoriesForUser,
  resolveCategoryLabelsToIds,
  saveCategoriesForUser,
} from "@/lib/services/categoryLabelsService";
import { listActiveAnglesForUser, upsertAngleItem } from "@/lib/services/angleService";
import { postingGoalPayloadSchema, savePostingGoalForUser } from "@/lib/services/postingGoalsService";
import { createProductsForUser, updateProductForUser } from "@/lib/services/productsService";
import { fetchSources } from "@/lib/services/urlFetchService";
import { ApiError } from "@/lib/api/errors";

const MAX_HISTORY_MESSAGES = 20;

export async function listPendingProposals(userId: string) {
  return db.query.assistantProposals.findMany({
    where: and(eq(assistantProposals.userId, userId), eq(assistantProposals.status, "pending")),
    orderBy: [asc(assistantProposals.createdAt)],
  });
}

export async function getAssistantChatState(userId: string) {
  const session = await db.query.assistantSessions.findFirst({ where: eq(assistantSessions.userId, userId) });
  return {
    messages: (session?.messages as AssistantMessage[] | undefined) ?? [],
    proposals: await listPendingProposals(userId),
  };
}

export async function runAssistantChatTurnForUser(userId: string, message: string, urls: string[] = []) {
  const [session, { sources, failures }, productList, activeSeries, activeCategories, activeAngles, goals, profile] =
    await Promise.all([
      db.query.assistantSessions.findFirst({ where: eq(assistantSessions.userId, userId) }),
      urls.length > 0 ? fetchSources(urls) : Promise.resolve({ sources: [], failures: [] }),
      db.query.products.findMany({ where: eq(products.userId, userId) }),
      listActiveSeriesForUser(userId),
      listActiveCategoriesForUser(userId),
      listActiveAnglesForUser(userId),
      db.query.postingGoals.findMany({ where: eq(postingGoals.userId, userId) }),
      db.query.creatorProfiles.findFirst({ where: eq(creatorProfiles.userId, userId), columns: { targetAudience: true } }),
    ]);

  // Le texte complet des pages ne sert que pour ce tour (via `sources` ci-dessous) — seul un
  // marqueur court est envoyé au modèle comme dernier message ET persisté dans l'historique,
  // pour ne jamais faire gonfler le transcript des tours suivants avec du texte scrappé.
  const storedContent =
    sources.length > 0 ? `${message}\n\n[+${sources.length} source(s) ajoutée(s) : ${sources.map((s) => s.url).join(", ")}]` : message;

  const priorMessages = (session?.messages as AssistantMessage[] | undefined) ?? [];
  const messagesWithUser: AssistantMessage[] = [...priorMessages, { role: "user", content: storedContent }];

  const result = await runAssistantChatTurn({
    history: messagesWithUser.slice(-MAX_HISTORY_MESSAGES),
    products: productList,
    series: activeSeries,
    categories: activeCategories,
    angles: activeAngles,
    postingGoals: goals.map((g) => ({ platform: g.platform, targetCountPerWeek: g.targetCountPerWeek })),
    currentTargetAudience: profile?.targetAudience ?? null,
    sources,
  });

  const messages: AssistantMessage[] = [...messagesWithUser, { role: "assistant", content: result.assistantReply }];
  if (session) {
    await db.update(assistantSessions).set({ messages, updatedAt: new Date() }).where(eq(assistantSessions.id, session.id));
  } else {
    await db.insert(assistantSessions).values({ userId, messages });
  }

  const rows: (typeof assistantProposals.$inferInsert)[] = [];

  for (const p of result.productProposals) {
    if (p.action === "update" && !p.targetId) continue; // update sans cible exploitable : ignoré
    rows.push({
      userId,
      kind: p.action === "create" ? "product_create" : "product_update",
      targetId: p.action === "update" ? p.targetId! : null,
      payload: { name: p.name, description: p.description ?? null, valueProposition: p.valueProposition ?? null },
    });
  }

  for (const s of result.seriesProposals) {
    if (s.action === "update" && !s.targetId) continue;
    const categoryIds = resolveCategoryLabelsToIds(s.categoryLabels, activeCategories);
    rows.push({
      userId,
      kind: s.action === "create" ? "series_create" : "series_update",
      targetId: s.action === "update" ? s.targetId! : null,
      payload: {
        label: s.label,
        description: s.description,
        weight: s.weight,
        categoryLabels: s.categoryLabels,
        categoryIds,
        platforms: s.platforms,
      },
    });
  }

  for (const c of result.categoryProposals) {
    if (c.action === "update" && !c.targetId) continue;
    rows.push({
      userId,
      kind: c.action === "create" ? "category_create" : "category_update",
      targetId: c.action === "update" ? c.targetId! : null,
      payload: { label: c.label, description: c.description, weight: c.weight, platforms: c.platforms },
    });
  }

  for (const a of result.angleProposals) {
    if (a.action === "update" && !a.targetId) continue;
    rows.push({
      userId,
      kind: a.action === "create" ? "angle_create" : "angle_update",
      targetId: a.action === "update" ? a.targetId! : null,
      payload: { label: a.label, description: a.description },
    });
  }

  for (const g of result.postingGoalProposals) {
    rows.push({
      userId,
      kind: "posting_goal_update",
      targetId: null,
      payload: { platform: g.platform, targetCountPerWeek: g.targetCountPerWeek },
    });
  }

  for (const p of result.profileProposals) {
    rows.push({
      userId,
      kind: "profile_update",
      targetId: null,
      payload: { targetAudience: p.targetAudience },
    });
  }

  if (rows.length > 0) {
    await db.insert(assistantProposals).values(rows);
  }

  return { reply: result.assistantReply, proposals: await listPendingProposals(userId), sourceErrors: failures };
}

const productPayloadSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  valueProposition: z.string().nullable().optional(),
});

const seriesPayloadSchema = z.object({
  label: z.string().min(1),
  description: z.string().min(1),
  weight: z.number().int().min(0).max(100),
  categoryLabels: z.array(z.string()).optional().default([]),
  categoryIds: z.array(z.string()).optional().default([]),
  platforms: z.array(z.string()).optional().default([]),
});

const categoryPayloadSchema = z.object({
  label: z.string().min(1),
  description: z.string().min(1),
  weight: z.number().int().min(5).max(90),
  platforms: z.array(z.string()).optional().default([]),
});

const anglePayloadSchema = z.object({
  label: z.string().min(1),
  description: z.string().min(1),
});

const profilePayloadSchema = z.object({
  targetAudience: z.string().min(1),
});

// Payload de category_reweight, produit par un calcul déterministe (categoryReweightService.ts),
// jamais par le LLM — cf. commentaire dans ce même service. `fields` permet à l'utilisateur
// d'éditer `items` avant validation (ex. ajuster l'ampleur d'un delta) : c'est le point d'entrée
// pour "je suis d'accord sur le sens mais pas l'ampleur" (docs/SPEC_METRIQUES_AUTO.md §6).
const categoryReweightPayloadSchema = z.object({
  items: z
    .array(
      z.object({
        targetId: z.string(),
        label: z.string(),
        previousWeight: z.number().int(),
        proposedWeight: z.number().int().min(5).max(90),
        sampleCount: z.number().int().optional(),
        categoryScore: z.number().optional(),
      })
    )
    .min(1),
  reasonSummary: z.string(),
});

export async function resolveProposal(
  userId: string,
  proposalId: string,
  action: "accept" | "reject",
  fields?: Record<string, unknown>
) {
  const proposal = await db.query.assistantProposals.findFirst({
    where: and(eq(assistantProposals.id, proposalId), eq(assistantProposals.userId, userId)),
  });
  if (!proposal) {
    throw new ApiError(404, "Proposition introuvable.");
  }
  if (proposal.status !== "pending") {
    throw new ApiError(400, "Cette proposition a déjà été traitée.");
  }

  if (action === "reject") {
    await db.update(assistantProposals).set({ status: "rejected", resolvedAt: new Date() }).where(eq(assistantProposals.id, proposal.id));
    return { proposals: await listPendingProposals(userId) };
  }

  const merged = { ...(proposal.payload as Record<string, unknown>), ...(fields ?? {}) };

  if (proposal.kind === "product_create") {
    const data = productPayloadSchema.parse(merged);
    await createProductsForUser(userId, [
      { name: data.name, description: data.description ?? undefined, valueProposition: data.valueProposition ?? undefined },
    ]);
  } else if (proposal.kind === "product_update") {
    if (!proposal.targetId) {
      throw new ApiError(400, "Proposition invalide : cible manquante.");
    }
    const data = productPayloadSchema.parse(merged);
    await updateProductForUser(userId, proposal.targetId, {
      name: data.name,
      description: data.description ?? undefined,
      valueProposition: data.valueProposition ?? undefined,
    });
  } else if (proposal.kind === "series_create" || proposal.kind === "series_update") {
    const data = seriesPayloadSchema.parse(merged);
    const categoryIds =
      data.categoryIds.length > 0
        ? data.categoryIds
        : resolveCategoryLabelsToIds(data.categoryLabels, await listActiveCategoriesForUser(userId));

    await db.transaction(async (tx) => {
      const seriesId = await upsertSeriesItem(tx, userId, {
        id: proposal.kind === "series_update" ? (proposal.targetId ?? undefined) : undefined,
        label: data.label,
        description: data.description,
        weight: data.weight,
        categoryIds,
        platforms: data.platforms,
      });
      if (!seriesId) {
        throw new ApiError(404, "Série introuvable.");
      }
    });
  } else if (proposal.kind === "category_create" || proposal.kind === "category_update") {
    const data = categoryPayloadSchema.parse(merged);
    const active = await listActiveCategoriesForUser(userId);

    let nextItems: Array<{ id?: string; label: string; description: string; weight: number; platforms: string[] }>;
    if (proposal.kind === "category_update") {
      if (!proposal.targetId) {
        throw new ApiError(400, "Proposition invalide : cible manquante.");
      }
      if (!active.some((c) => c.id === proposal.targetId)) {
        throw new ApiError(404, "Catégorie introuvable.");
      }
      nextItems = active.map((c) =>
        c.id === proposal.targetId
          ? { id: c.id, label: data.label, description: data.description, weight: data.weight, platforms: data.platforms }
          : { id: c.id, label: c.label, description: c.description, weight: c.weight, platforms: c.platforms }
      );
    } else {
      nextItems = [
        ...active.map((c) => ({ id: c.id, label: c.label, description: c.description, weight: c.weight, platforms: c.platforms })),
        { label: data.label, description: data.description, weight: data.weight, platforms: data.platforms },
      ];
    }

    if (nextItems.length < 2 || nextItems.length > 6) {
      throw new ApiError(400, "Le nombre de catégories actives doit rester entre 2 et 6.");
    }
    await saveCategoriesForUser(userId, nextItems);
  } else if (proposal.kind === "angle_create" || proposal.kind === "angle_update") {
    const data = anglePayloadSchema.parse(merged);
    if (proposal.kind === "angle_update" && !proposal.targetId) {
      throw new ApiError(400, "Proposition invalide : cible manquante.");
    }
    const result = await upsertAngleItem(userId, {
      id: proposal.kind === "angle_update" ? (proposal.targetId ?? undefined) : undefined,
      label: data.label,
      description: data.description,
    });
    if (!result) {
      throw new ApiError(404, "Angle introuvable.");
    }
  } else if (proposal.kind === "category_reweight") {
    const data = categoryReweightPayloadSchema.parse(merged);
    const active = await listActiveCategoriesForUser(userId);
    const proposedById = new Map(data.items.map((i) => [i.targetId, i.proposedWeight]));

    // Toutes les catégories actives sont renvoyées (requis par saveCategoriesForUser), celles
    // absentes du payload gardent leur poids actuel — seules les catégories avec un signal
    // suffisant (cf. categoryReweightService.ts) apparaissent dans `items`.
    const nextItems = active.map((c) => ({
      id: c.id,
      label: c.label,
      description: c.description,
      weight: proposedById.get(c.id) ?? c.weight,
      platforms: c.platforms,
    }));

    if (nextItems.length < 2 || nextItems.length > 6) {
      throw new ApiError(400, "Le nombre de catégories actives doit rester entre 2 et 6.");
    }
    await saveCategoriesForUser(userId, nextItems);
  } else if (proposal.kind === "profile_update") {
    const data = profilePayloadSchema.parse(merged);
    // Une seule cible possible (le CreatorProfile de l'utilisateur, forcément déjà créé — l'assistant
    // n'est accessible qu'après l'onboarding) : pas d'upsert à gérer, contrairement aux autres kinds.
    await db.update(creatorProfiles).set({ targetAudience: data.targetAudience }).where(eq(creatorProfiles.userId, userId));
  } else {
    // posting_goal_update
    const data = postingGoalPayloadSchema.parse(merged);
    await savePostingGoalForUser(userId, data.platform, data.targetCountPerWeek);
  }

  await db.update(assistantProposals).set({ status: "accepted", resolvedAt: new Date() }).where(eq(assistantProposals.id, proposal.id));
  return { proposals: await listPendingProposals(userId) };
}
