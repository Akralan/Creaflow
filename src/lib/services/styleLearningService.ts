import { and, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { assistantProposals, creatorProfiles, inspirationVideos, scripts } from "@/db/schema";
import { ApiError } from "@/lib/api/errors";
import {
  MAX_CORRECTIONS_PER_PASS,
  MAX_SAMPLES_PER_PASS,
  diffScript,
  learnStyle,
  type ScriptTextColumns,
  type StyleCorrection,
  type StyleSample,
} from "@/lib/llm/styleLearning";
import { parseStoredStyleProfile, styleProfileSchema, type StyleProfile } from "@/lib/llm/styleProfile";

/**
 * Passe d'apprentissage du style (docs/SPEC_APPRENTISSAGE_STYLE.md §5). Paresseuse, jamais
 * planifiée : déclenchée par un geste utilisateur (bouton, bandeau) ou à la connexion d'un compte
 * social quand aucun profil n'existe encore.
 */

const FINALIZED_STATUSES = ["shot", "published"] as const;

/** Seuil à partir duquel les écrans suggèrent de relancer l'analyse (§2, décision ouverte 1). */
export const STYLE_LEARNING_SUGGESTION_THRESHOLD = 5;

export interface StyleLearningStatus {
  /** Scripts finalisés jamais lus par une passe. */
  pendingScripts: number;
  lastLearnedAt: string | null;
  pendingProposalId: string | null;
}

export async function getStyleLearningStatus(userId: string): Promise<StyleLearningStatus> {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(scripts)
    .where(and(eq(scripts.userId, userId), inArray(scripts.status, [...FINALIZED_STATUSES]), isNull(scripts.styleLearnedAt)));
  const profile = await db.query.creatorProfiles.findFirst({
    where: eq(creatorProfiles.userId, userId),
    columns: { styleProfile: true, styleProfileUpdatedAt: true },
  });
  const pending = await db.query.assistantProposals.findFirst({
    where: and(
      eq(assistantProposals.userId, userId),
      eq(assistantProposals.kind, "style_profile_update"),
      eq(assistantProposals.status, "pending")
    ),
    columns: { id: true },
  });
  const stored = parseStoredStyleProfile(profile?.styleProfile);
  return {
    pendingScripts: count,
    lastLearnedAt: stored?.evidence.learnedAt ?? profile?.styleProfileUpdatedAt?.toISOString() ?? null,
    pendingProposalId: pending?.id ?? null,
  };
}

function textColumns(row: typeof scripts.$inferSelect): ScriptTextColumns {
  return {
    title: row.title,
    hookVisual: row.hookVisual,
    hookText: row.hookText,
    hookAudio: row.hookAudio,
    caption: row.caption,
    hashtags: row.hashtags,
    storyboard: (row.storyboard as { planNumber: number; description: string }[] | null) ?? null,
    soundRecommendation: row.soundRecommendation,
  };
}

function sampleText(row: typeof scripts.$inferSelect): string {
  const parts = [
    row.title,
    row.hookText,
    row.caption,
    ...(((row.storyboard as { description: string }[] | null) ?? []).map((s) => s.description)),
  ].filter((p): p is string => Boolean(p && p.trim()));
  return parts.join("\n");
}

export interface LearningCorpus {
  corrections: StyleCorrection[];
  samples: StyleSample[];
  /** Ids de tous les scripts lus (corrections, échantillons, et scripts identiques à leur premier jet). */
  readScriptIds: string[];
  /** Légendes d'inspiration, en repli si rien d'autre. */
  captions: string[];
}

/**
 * Sélection du corpus (§2 « sources d'apprentissage »). `includeLearned` rejoue aussi les scripts
 * déjà marqués — pour reconstruire un profil à la main.
 */
export async function selectLearningCorpus(userId: string, options: { includeLearned: boolean }): Promise<LearningCorpus> {
  const baseWhere = and(eq(scripts.userId, userId), inArray(scripts.status, [...FINALIZED_STATUSES]));
  const learnedFilter = options.includeLearned ? undefined : isNull(scripts.styleLearnedAt);

  const generated = await db.query.scripts.findMany({
    where: and(baseWhere, eq(scripts.origin, "generated"), isNotNull(scripts.firstDraftSnapshot), learnedFilter),
    orderBy: desc(scripts.updatedAt),
    limit: MAX_CORRECTIONS_PER_PASS * 2,
  });
  const authored = await db.query.scripts.findMany({
    where: and(baseWhere, inArray(scripts.origin, ["imported", "manual"]), learnedFilter),
    orderBy: desc(scripts.updatedAt),
    limit: MAX_SAMPLES_PER_PASS,
  });

  const corrections: StyleCorrection[] = [];
  const readScriptIds: string[] = [];
  for (const row of generated) {
    readScriptIds.push(row.id);
    if (corrections.length >= MAX_CORRECTIONS_PER_PASS) continue;
    const diffs = diffScript(row.firstDraftSnapshot as ScriptTextColumns, textColumns(row));
    if (diffs.length === 0) continue;
    corrections.push({ platform: row.platform, contentType: row.contentType, diffs });
  }
  const samples: StyleSample[] = [];
  for (const row of authored) {
    readScriptIds.push(row.id);
    const text = sampleText(row);
    if (text) samples.push({ platform: row.platform, contentType: row.contentType, text });
  }

  const videos = await db.query.inspirationVideos.findMany({
    where: eq(inspirationVideos.userId, userId),
    columns: { captionText: true },
  });
  const captions = videos.map((v) => v.captionText).filter((c): c is string => Boolean(c));

  return { corrections, samples, readScriptIds, captions };
}

export interface StyleLearningPassResult {
  styleProfile: StyleProfile;
  changeNotes: string;
  /** Null quand le profil a été écrit directement (aucun profil à protéger). */
  proposalId: string | null;
}

/**
 * Lance une passe : lit le corpus, appelle le modèle, puis soit crée une proposition à valider (cas
 * normal), soit écrit directement quand aucun profil n'existe encore — il n'y a alors rien à
 * écraser, et demander de valider une première analyse serait de la friction pour rien.
 */
export async function runStyleLearningPass(
  userId: string,
  options: { includeLearned?: boolean } = {}
): Promise<StyleLearningPassResult> {
  const profile = await db.query.creatorProfiles.findFirst({ where: eq(creatorProfiles.userId, userId) });
  if (!profile) {
    throw new ApiError(400, "Profil créateur introuvable.");
  }
  const currentProfile = parseStoredStyleProfile(profile.styleProfile);
  const corpus = await selectLearningCorpus(userId, { includeLearned: options.includeLearned ?? false });

  // Repli : sans aucun script exploitable, les légendes d'inspiration restent une source de voix.
  const samples = [...corpus.samples];
  if (corpus.corrections.length === 0 && samples.length === 0) {
    for (const caption of corpus.captions.slice(0, MAX_SAMPLES_PER_PASS)) {
      samples.push({ platform: "inspiration", contentType: "caption", text: caption });
    }
  }
  if (corpus.corrections.length === 0 && samples.length === 0) {
    throw new ApiError(
      400,
      "Rien à analyser pour l'instant : finalise (tourné ou publié) au moins un script corrigé ou écrit par toi, ou connecte un compte social."
    );
  }

  const scriptCount = (currentProfile?.evidence.scriptCount ?? 0) + corpus.readScriptIds.length;
  const result = await learnStyle({ currentProfile, corrections: corpus.corrections, samples, scriptCount });

  if (corpus.readScriptIds.length > 0) {
    await db
      .update(scripts)
      .set({ styleLearnedAt: new Date() })
      .where(and(eq(scripts.userId, userId), inArray(scripts.id, corpus.readScriptIds)));
  }

  if (!currentProfile) {
    await applyStyleProfile(userId, result.styleProfile);
    return { ...result, proposalId: null };
  }

  // Une seule proposition de style en attente : la nouvelle remplace la précédente (§5.2 point 6).
  await db
    .update(assistantProposals)
    .set({ status: "rejected", resolvedAt: new Date() })
    .where(
      and(
        eq(assistantProposals.userId, userId),
        eq(assistantProposals.kind, "style_profile_update"),
        eq(assistantProposals.status, "pending")
      )
    );
  const [proposal] = await db
    .insert(assistantProposals)
    .values({
      userId,
      kind: "style_profile_update",
      targetId: null,
      payload: { styleProfile: result.styleProfile, changeNotes: result.changeNotes },
    })
    .returning({ id: assistantProposals.id });
  return { ...result, proposalId: proposal.id };
}

export async function applyStyleProfile(userId: string, styleProfile: StyleProfile): Promise<void> {
  await db
    .update(creatorProfiles)
    .set({ styleProfile, styleProfileUpdatedAt: new Date() })
    .where(eq(creatorProfiles.userId, userId));
}

/** Édition manuelle des règles et listes (§2 « édition manuelle », PATCH /api/profile/style). */
export async function updateStyleLists(
  userId: string,
  patch: Partial<Pick<StyleProfile, "rules" | "avoid" | "prefer">>
): Promise<StyleProfile> {
  const profile = await db.query.creatorProfiles.findFirst({ where: eq(creatorProfiles.userId, userId) });
  if (!profile) {
    throw new ApiError(400, "Profil créateur introuvable.");
  }
  const current = parseStoredStyleProfile(profile.styleProfile);
  if (!current) {
    throw new ApiError(400, "Aucun profil de style : lance d'abord une analyse.");
  }
  const next = styleProfileSchema.parse({ ...current, ...patch });
  await applyStyleProfile(userId, next);
  return next;
}
