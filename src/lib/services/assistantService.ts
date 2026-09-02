import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  assistantAttachments,
  assistantProposals,
  assistantSessions,
  creatorProfiles,
  postingGoals,
  products,
} from "@/db/schema";
import { runAssistantChatTurn, type AssistantMessage } from "@/lib/llm/assistantChat";
import { ASSISTANT_READ_TOOLS, runAssistantReadTool } from "@/lib/services/assistantReadTools";
import { listActiveSeriesForUser, upsertSeriesItem } from "@/lib/services/seriesService";
import {
  listActiveCategoriesForUser,
  resolveCategoryLabelToId,
  saveCategoriesForUser,
} from "@/lib/services/categoryLabelsService";
import { listActiveAnglesForUser, upsertAngleItem } from "@/lib/services/angleService";
import { postingGoalPayloadSchema, savePostingGoalForUser } from "@/lib/services/postingGoalsService";
import { createProductsForUser, updateProductForUser } from "@/lib/services/productsService";
import {
  createFileMaterial,
  createInterviewMaterial,
  deleteMaterialForUser,
  updateMaterialForUser,
} from "@/lib/services/sourceMaterialService";
import { archiveSeriesForUser } from "@/lib/services/seriesService";
import { archiveAngleForUser } from "@/lib/services/angleService";
import { markStaleForMaterialIngestion } from "@/lib/services/narrativeDirector";
import { ApiError } from "@/lib/api/errors";

// Fenêtre d'historique bornée par le VOLUME et non par le nombre de messages
// (docs/SPEC_ASSISTANT_AGENTIQUE.md §6.5) : un plafond fixe à 20 messages coupait le début d'une
// conversation longue en silence, tout en laissant passer 20 pavés. On garde les messages les plus
// récents tant qu'ils tiennent dans le budget, avec un minimum de tours toujours conservé.
const MAX_HISTORY_CHARS = 24_000;
const MIN_HISTORY_MESSAGES = 6;

function recentHistory(messages: AssistantMessage[]): AssistantMessage[] {
  const kept: AssistantMessage[] = [];
  let total = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    total += messages[i].content.length;
    if (total > MAX_HISTORY_CHARS && kept.length >= MIN_HISTORY_MESSAGES) break;
    kept.unshift(messages[i]);
  }
  return kept;
}

/** Fichiers déposés et pas encore rangés en matière (docs/SPEC_ASSISTANT_AGENTIQUE.md §5.1). Le
 *  texte n'en sort jamais : seuls id et nom sont transmis au modèle. */
export async function listPendingAttachments(userId: string) {
  return db.query.assistantAttachments.findMany({
    where: and(eq(assistantAttachments.userId, userId), isNull(assistantAttachments.consumedAt)),
    orderBy: [asc(assistantAttachments.createdAt)],
    columns: { id: true, filename: true, createdAt: true },
  });
}

/** Retrait d'un fichier déposé mais pas encore rangé. Sans effet sur un fichier déjà consommé :
 *  celui-là est devenu un SourceMaterial, qui a sa propre suppression. */
export async function discardAttachment(userId: string, attachmentId: string) {
  const [deleted] = await db
    .delete(assistantAttachments)
    .where(
      and(
        eq(assistantAttachments.id, attachmentId),
        eq(assistantAttachments.userId, userId),
        isNull(assistantAttachments.consumedAt)
      )
    )
    .returning({ id: assistantAttachments.id });
  if (!deleted) {
    throw new ApiError(404, "Fichier introuvable ou déjà rangé.");
  }
  return deleted;
}

export async function createAttachment(userId: string, filename: string, rawText: string) {
  const text = rawText.trim();
  if (!text) {
    throw new ApiError(400, "Ce fichier est vide.");
  }
  const [row] = await db.insert(assistantAttachments).values({ userId, filename, rawText: text }).returning({
    id: assistantAttachments.id,
    filename: assistantAttachments.filename,
    createdAt: assistantAttachments.createdAt,
  });
  return row;
}

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
    attachments: await listPendingAttachments(userId),
  };
}

export async function runAssistantChatTurnForUser(userId: string, message: string) {
  const [session, attachments, productList, activeSeries, activeCategories, activeAngles, goals, profile] =
    await Promise.all([
      db.query.assistantSessions.findFirst({ where: eq(assistantSessions.userId, userId) }),
      listPendingAttachments(userId),
      db.query.products.findMany({ where: eq(products.userId, userId) }),
      listActiveSeriesForUser(userId),
      listActiveCategoriesForUser(userId),
      listActiveAnglesForUser(userId),
      db.query.postingGoals.findMany({ where: eq(postingGoals.userId, userId) }),
      db.query.creatorProfiles.findFirst({ where: eq(creatorProfiles.userId, userId), columns: { targetAudience: true } }),
    ]);

  // Les fichiers déposés depuis le dernier échange sont mentionnés dans le message persisté : le fil
  // garde la trace de ce qui a été joint, sans que le texte du fichier n'entre jamais dans le
  // transcript (docs/SPEC_ASSISTANT_AGENTIQUE.md §5.1).
  const justAttached = attachments.filter((a) => !session?.updatedAt || a.createdAt > session.updatedAt);
  const storedContent =
    justAttached.length > 0
      ? `${message}\n\n[fichier(s) joint(s) : ${justAttached.map((a) => a.filename).join(", ")}]`
      : message;

  const priorMessages = (session?.messages as AssistantMessage[] | undefined) ?? [];
  const messagesWithUser: AssistantMessage[] = [...priorMessages, { role: "user", content: storedContent }];

  const turn = await runAssistantChatTurn({
    history: recentHistory(messagesWithUser),
    attachments: attachments.map((a) => ({ id: a.id, filename: a.filename })),
    readTools: ASSISTANT_READ_TOOLS,
    onReadTool: (name, input) => runAssistantReadTool(userId, name, input),
    products: productList,
    series: activeSeries,
    categories: activeCategories,
    angles: activeAngles,
    postingGoals: goals.map((g) => ({ platform: g.platform, targetCountPerWeek: g.targetCountPerWeek })),
    currentTargetAudience: profile?.targetAudience ?? null,
  });

  const result = turn.proposals;
  // La boucle agentique rend toujours un texte, sauf réponse vide du modèle après un appel d'outil :
  // on ne stocke jamais un message assistant vide, l'historique serait illisible au tour suivant.
  const reply =
    turn.reply.trim() ||
    "J'ai enregistré des propositions dans le panneau à droite — dis-moi ce que tu en penses.";

  const messages: AssistantMessage[] = [...messagesWithUser, { role: "assistant", content: reply }];
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
      payload: {
        name: p.name,
        description: p.description ?? null,
        valueProposition: p.valueProposition ?? null,
        targetAudience: p.targetAudience ?? null,
      },
    });
  }

  for (const s of result.seriesProposals) {
    if (s.action === "update" && !s.targetId) continue;
    // Un rôle unique par série (docs/SPEC_SERIES_ET_ROLES.md §1). Un libellé qui ne résout pas
    // laisse categoryId à null : l'utilisateur choisit le rôle à l'acceptation (400 sinon).
    const categoryId = resolveCategoryLabelToId(s.categoryLabel, activeCategories);
    rows.push({
      userId,
      kind: s.action === "create" ? "series_create" : "series_update",
      targetId: s.action === "update" ? s.targetId! : null,
      payload: {
        label: s.label,
        description: s.description,
        weight: s.weight,
        categoryLabel: s.categoryLabel,
        categoryId,
        platforms: s.platforms,
        ...(s.mode ? { mode: s.mode } : {}),
        // Omis par le modèle = rattachement inchangé (assistantChat.ts) : on ne persiste rien
        // plutôt qu'un null, qui détacherait la série de sa source de matière à l'acceptation.
        // productName est un libellé d'affichage pour le panneau de validation (le client n'a pas
        // la liste des sujets sous la main) — ignoré à l'application, comme categoryLabel.
        ...(s.productId
          ? { productId: s.productId, productName: productList.find((p) => p.id === s.productId)?.name ?? null }
          : {}),
      },
    });
  }

  for (const c of result.categoryProposals) {
    if (c.action === "update" && !c.targetId) continue;
    rows.push({
      userId,
      kind: c.action === "create" ? "category_create" : "category_update",
      targetId: c.action === "update" ? c.targetId! : null,
      payload: {
        label: c.label,
        description: c.description,
        weight: c.weight,
        platforms: c.platforms,
        ...(c.materialHungry !== undefined ? { materialHungry: c.materialHungry } : {}),
      },
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

  for (const m of turn.materialProposals) {
    rows.push({
      userId,
      kind: m.action === "create" ? "material_create" : m.action === "update" ? "material_update" : "material_delete",
      targetId: m.materialId ?? null,
      payload: {
        productId: m.productId ?? null,
        productName: m.productId ? (productList.find((p) => p.id === m.productId)?.name ?? null) : null,
        title: m.title ?? null,
        text: m.text ?? null,
        attachmentId: m.attachmentId ?? null,
      },
    });
  }

  for (const a of turn.archiveProposals) {
    // Le libellé est figé dans le payload pour l'affichage : le panneau de validation ne charge pas
    // les séries ni les angles, et un élément archivé entre-temps n'aurait plus de nom à montrer.
    const label =
      a.kind === "series"
        ? activeSeries.find((s) => s.id === a.targetId)?.label
        : a.kind === "category"
          ? activeCategories.find((c) => c.id === a.targetId)?.label
          : activeAngles.find((x) => x.id === a.targetId)?.label;
    rows.push({
      userId,
      kind: a.kind === "series" ? "series_archive" : a.kind === "category" ? "category_archive" : "angle_archive",
      targetId: a.targetId,
      payload: { label: label ?? null, reason: a.reason ?? null },
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

  return { reply, proposals: await listPendingProposals(userId), attachments: await listPendingAttachments(userId) };
}

const productPayloadSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  valueProposition: z.string().nullable().optional(),
  targetAudience: z.string().nullable().optional(),
});

const seriesPayloadSchema = z.object({
  label: z.string().min(1),
  description: z.string().min(1),
  weight: z.number().int().min(0).max(100),
  categoryLabel: z.string().optional(),
  categoryId: z.string().nullable().optional(),
  platforms: z.array(z.string()).optional().default([]),
  mode: z.enum(["feuilleton", "rendez_vous"]).optional(),
  // Absent = rattachement inchangé (jamais de détachement implicite, cf. assistantChat.ts).
  productId: z.string().optional(),
});

const categoryPayloadSchema = z.object({
  label: z.string().min(1),
  description: z.string().min(1),
  weight: z.number().int().min(5).max(90),
  platforms: z.array(z.string()).optional().default([]),
  // Absent = valeur actuelle du rôle conservée (cf. resolveProposal).
  materialHungry: z.boolean().optional(),
});

const anglePayloadSchema = z.object({
  label: z.string().min(1),
  description: z.string().min(1),
});

const profilePayloadSchema = z.object({
  targetAudience: z.string().min(1),
});

const materialPayloadSchema = z.object({
  productId: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  text: z.string().nullable().optional(),
  attachmentId: z.string().nullable().optional(),
});

const archivePayloadSchema = z.object({
  label: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
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

/** Vérifie qu'un sujet appartient bien à l'utilisateur avant de l'utiliser comme cible : le payload
 *  vient du LLM, mais `fields` est librement éditable côté client avant acceptation. */
async function resolveOwnedProductId(userId: string, productId: string | null | undefined): Promise<string | null> {
  if (!productId) return null;
  const product = await db.query.products.findFirst({
    where: and(eq(products.id, productId), eq(products.userId, userId)),
    columns: { id: true },
  });
  if (!product) {
    throw new ApiError(404, "Sujet introuvable.");
  }
  return product.id;
}

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
  // Le résumé d'un document de matière est produit hors de la requête, par la route via after() —
  // convention du repo : aucun service n'importe next/server (cf. api/materials/upload).
  let summarizeMaterialId: string | null = null;

  if (proposal.kind === "product_create") {
    const data = productPayloadSchema.parse(merged);
    await createProductsForUser(userId, [
      {
        name: data.name,
        description: data.description ?? undefined,
        valueProposition: data.valueProposition ?? undefined,
        targetAudience: data.targetAudience ?? undefined,
      },
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
      targetAudience: data.targetAudience ?? undefined,
    });
  } else if (proposal.kind === "series_create" || proposal.kind === "series_update") {
    const data = seriesPayloadSchema.parse(merged);
    const categoryId =
      data.categoryId ??
      (data.categoryLabel ? resolveCategoryLabelToId(data.categoryLabel, await listActiveCategoriesForUser(userId)) : null);
    if (!categoryId) {
      throw new ApiError(400, "Choisis un rôle pour cette série avant de l'accepter.");
    }
    // Le payload du LLM est contraint par un enum d'ids existants, mais `fields` est librement
    // éditable par l'utilisateur avant acceptation : on revérifie l'appartenance du sujet, comme le
    // fait updateSeriesFields pour la porte d'édition directe.
    if (data.productId) {
      const product = await db.query.products.findFirst({
        where: and(eq(products.id, data.productId), eq(products.userId, userId)),
        columns: { id: true },
      });
      if (!product) {
        throw new ApiError(404, "Sujet introuvable.");
      }
    }

    await db.transaction(async (tx) => {
      const seriesId = await upsertSeriesItem(tx, userId, {
        id: proposal.kind === "series_update" ? (proposal.targetId ?? undefined) : undefined,
        label: data.label,
        description: data.description,
        weight: data.weight,
        categoryId,
        platforms: data.platforms,
        mode: data.mode,
        // Absent = inchangé : ne jamais passer `null`, ça détacherait la série de sa matière.
        ...(data.productId ? { productId: data.productId } : {}),
      });
      if (!seriesId) {
        throw new ApiError(404, "Série introuvable.");
      }
    });
  } else if (proposal.kind === "category_create" || proposal.kind === "category_update") {
    const data = categoryPayloadSchema.parse(merged);
    const active = await listActiveCategoriesForUser(userId);

        // materialHungry est restitué pour CHAQUE rôle, y compris ceux que la proposition ne touche pas :
    // saveCategoriesForUser réécrit la liste entière et retombe sur `false` pour tout champ absent
    // (docs/SPEC_MATIERE_EDITEUR.md §5.3) — l'omettre remettait à zéro l'aiguillage matière×rôle de
    // tout le compte à chaque acceptation.
    let nextItems: Array<{
      id?: string;
      label: string;
      description: string;
      weight: number;
      platforms: string[];
      materialHungry: boolean;
    }>;
    if (proposal.kind === "category_update") {
      if (!proposal.targetId) {
        throw new ApiError(400, "Proposition invalide : cible manquante.");
      }
      if (!active.some((c) => c.id === proposal.targetId)) {
        throw new ApiError(404, "Catégorie introuvable.");
      }
      nextItems = active.map((c) =>
        c.id === proposal.targetId
          ? {
              id: c.id,
              label: data.label,
              description: data.description,
              weight: data.weight,
              platforms: data.platforms,
              materialHungry: data.materialHungry ?? c.materialHungry,
            }
          : {
              id: c.id,
              label: c.label,
              description: c.description,
              weight: c.weight,
              platforms: c.platforms,
              materialHungry: c.materialHungry,
            }
      );
    } else {
      nextItems = [
        ...active.map((c) => ({
          id: c.id,
          label: c.label,
          description: c.description,
          weight: c.weight,
          platforms: c.platforms,
          materialHungry: c.materialHungry,
        })),
        {
          label: data.label,
          description: data.description,
          weight: data.weight,
          platforms: data.platforms,
          materialHungry: data.materialHungry ?? false,
        },
      ];
    }

    if (nextItems.length < 2 || nextItems.length > 6) {
      throw new ApiError(400, "Le nombre de rôles actifs doit rester entre 2 et 6.");
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
      materialHungry: c.materialHungry,
    }));

    if (nextItems.length < 2 || nextItems.length > 6) {
      throw new ApiError(400, "Le nombre de rôles actifs doit rester entre 2 et 6.");
    }
    await saveCategoriesForUser(userId, nextItems);
  } else if (proposal.kind === "material_create") {
    const data = materialPayloadSchema.parse(merged);
    const productId = await resolveOwnedProductId(userId, data.productId);

    // Deux portes (docs/SPEC_ASSISTANT_AGENTIQUE.md §5) : un fichier déposé dans la conversation,
    // dont le texte n'a jamais transité par le modèle, ou une extraction conversationnelle.
    let material;
    if (data.attachmentId) {
      const attachment = await db.query.assistantAttachments.findFirst({
        where: and(
          eq(assistantAttachments.id, data.attachmentId),
          eq(assistantAttachments.userId, userId),
          isNull(assistantAttachments.consumedAt)
        ),
      });
      if (!attachment) {
        throw new ApiError(404, "Fichier introuvable ou déjà rangé.");
      }
      material = await createFileMaterial(userId, {
        productId,
        title: data.title?.trim() || attachment.filename,
        rawText: attachment.rawText,
      });
      await db
        .update(assistantAttachments)
        .set({ consumedAt: new Date() })
        .where(eq(assistantAttachments.id, attachment.id));
    } else {
      if (!data.text?.trim()) {
        throw new ApiError(400, "Cette matière n'a pas de contenu à enregistrer.");
      }
      // kind="interview" : extraite d'une conversation, ni collée ni importée — même provenance que
      // l'interview-chat (docs/SPEC_MATIERE_EDITEUR.md §3.7).
      material = await createInterviewMaterial(userId, { productId, title: data.title, rawText: data.text });
    }

    await markStaleForMaterialIngestion(userId, productId);
    summarizeMaterialId = material.id;
  } else if (proposal.kind === "material_update") {
    if (!proposal.targetId) {
      throw new ApiError(400, "Proposition invalide : cible manquante.");
    }
    const data = materialPayloadSchema.parse(merged);
    const updated = await updateMaterialForUser(userId, proposal.targetId, {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.text ? { rawText: data.text } : {}),
      ...(data.productId !== undefined ? { productId: await resolveOwnedProductId(userId, data.productId) } : {}),
    });
    // Le résumé a été invalidé si le texte a changé (updateMaterialForUser) : on le refait produire.
    if (updated && !updated.summary) {
      summarizeMaterialId = updated.id;
    }
  } else if (proposal.kind === "material_delete") {
    if (!proposal.targetId) {
      throw new ApiError(400, "Proposition invalide : cible manquante.");
    }
    await deleteMaterialForUser(userId, proposal.targetId);
  } else if (proposal.kind === "series_archive") {
    if (!proposal.targetId) {
      throw new ApiError(400, "Proposition invalide : cible manquante.");
    }
    archivePayloadSchema.parse(merged);
    await archiveSeriesForUser(userId, proposal.targetId);
  } else if (proposal.kind === "angle_archive") {
    if (!proposal.targetId) {
      throw new ApiError(400, "Proposition invalide : cible manquante.");
    }
    archivePayloadSchema.parse(merged);
    await archiveAngleForUser(userId, proposal.targetId);
  } else if (proposal.kind === "category_archive") {
    if (!proposal.targetId) {
      throw new ApiError(400, "Proposition invalide : cible manquante.");
    }
    archivePayloadSchema.parse(merged);
    const active = await listActiveCategoriesForUser(userId);
    if (!active.some((c) => c.id === proposal.targetId)) {
      throw new ApiError(404, "Catégorie introuvable.");
    }
    // Archivage par omission : on repasse par saveCategoriesForUser pour conserver ses deux garde-fous
    // — refus si le rôle est encore porté par une série active, et renormalisation des poids à 100%.
    const nextItems = active
      .filter((c) => c.id !== proposal.targetId)
      .map((c) => ({
        id: c.id,
        label: c.label,
        description: c.description,
        weight: c.weight,
        platforms: c.platforms,
        materialHungry: c.materialHungry,
      }));
    if (nextItems.length < 2) {
      throw new ApiError(400, "Le nombre de rôles actifs doit rester entre 2 et 6.");
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
  return { proposals: await listPendingProposals(userId), summarizeMaterialId };
}
