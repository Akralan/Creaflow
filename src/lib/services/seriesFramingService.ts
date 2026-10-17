import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { creatorProfiles, contentSeries, products, sourceMaterials } from "@/db/schema";
import { ApiError } from "@/lib/api/errors";
import { parseStoredReaderPortrait } from "@/lib/llm/readerPortrait";
import {
  findFramingOption,
  FRAMING_DIMENSIONS,
  parseStoredChosenVoice,
  pickFramingMoment,
  proposeFramingOptions,
  proposeSignature,
  signatureSchema,
  type FramingChoice,
  type FramingContext,
  type FramingDimension,
  type SeriesFraming,
} from "@/lib/llm/seriesFraming";
import { listActiveSeriesForUser } from "@/lib/services/seriesService";
import { nextEpisode, resolveNarrativeState } from "@/lib/services/narrativeDirector";

/**
 * Cadrage d'une série par des choix (docs/SPEC_CADRAGE_SERIE.md). Sans état côté serveur pendant le
 * parcours : le navigateur renvoie les choix déjà faits à chaque étape ; seul l'enregistrement final
 * écrit en base.
 */

interface MomentInfo {
  title: string;
  docIds: string[];
  hasMaterial: boolean;
}

async function ownedSeries(userId: string, seriesId: string) {
  const series = await db.query.contentSeries.findFirst({
    where: and(eq(contentSeries.id, seriesId), eq(contentSeries.userId, userId)),
    with: { contentSeriesCategories: { with: { category: { columns: { label: true } } } } },
  });
  if (!series) throw new ApiError(404, "Série introuvable.");
  return series;
}

type MomentDoc = { id: string; title: string | null; rawText: string };
const MAX_MOMENT_CANDIDATES = 40;

/**
 * Le moment raconté par les trois étapes (§1). Celui déjà choisi aux étapes précédentes (renvoyé
 * par le navigateur) ; sinon le prochain épisode du plan s'il pointe des documents ; sinon le
 * document le plus racontable du sujet, choisi par le modèle sur les résumés (le plus récent est
 * souvent un README sans histoire, constaté en réel) ; sinon l'épisode seul, sans matière.
 */
async function resolveMoment(
  userId: string,
  series: { id: string; productId: string | null },
  given?: { title: string; docIds: string[] }
): Promise<{ title: string; docs: MomentDoc[] }> {
  if (given) {
    const docs = given.docIds.length
      ? await db.query.sourceMaterials.findMany({
          where: and(eq(sourceMaterials.userId, userId), inArray(sourceMaterials.id, given.docIds)),
          columns: { id: true, title: true, rawText: true },
        })
      : [];
    return { title: given.title, docs };
  }
  const state = await resolveNarrativeState(userId, series.productId, series.id);
  const beat = state ? nextEpisode(state.beats, null) : null;
  if (beat && beat.focusDocIds.length > 0) {
    const docs = await db.query.sourceMaterials.findMany({
      where: and(eq(sourceMaterials.userId, userId), inArray(sourceMaterials.id, beat.focusDocIds)),
      columns: { id: true, title: true, rawText: true },
    });
    if (docs.length > 0) return { title: beat.title, docs };
  }
  if (series.productId) {
    const docs = await db.query.sourceMaterials.findMany({
      where: and(eq(sourceMaterials.userId, userId), eq(sourceMaterials.productId, series.productId)),
      orderBy: desc(sourceMaterials.createdAt),
      columns: { id: true, title: true, rawText: true, summary: true },
      limit: MAX_MOMENT_CANDIDATES,
    });
    const summarized = docs.filter((d) => d.summary).map((d) => ({ id: d.id, summary: d.summary as string }));
    const picked = await pickFramingMoment(summarized).catch(() => null);
    const doc = (picked && docs.find((d) => d.id === picked.docId)) ?? docs[0];
    if (doc) return { title: picked?.title ?? doc.summary ?? doc.title ?? "Le dernier document de ta matière", docs: [doc] };
  }
  return { title: beat?.title ?? "La présentation de ce que tu construis", docs: [] };
}

async function buildContext(
  userId: string,
  seriesId: string,
  given?: { title: string; docIds: string[] }
): Promise<{ context: FramingContext; moment: MomentInfo }> {
  const series = await ownedSeries(userId, seriesId);
  const product = series.productId
    ? await db.query.products.findFirst({ where: and(eq(products.id, series.productId), eq(products.userId, userId)) })
    : null;
  const resolved = await resolveMoment(userId, series, given);
  return {
    context: {
      subjectName: product?.name ?? null,
      subjectDescription: product?.description ?? null,
      series: {
        label: series.label,
        description: series.description,
        mode: series.mode === "feuilleton" ? "feuilleton : les épisodes se suivent" : "rendez-vous : épisodes autonomes au même format",
        roleLabel: series.contentSeriesCategories[0]?.category?.label ?? null,
      },
      readers: (parseStoredReaderPortrait(product?.readerPortrait)?.readers ?? []).map((r) => ({ label: r.label, who: r.who })),
      moment: { title: resolved.title, documents: resolved.docs.map((d) => ({ title: d.title, text: d.rawText })) },
    },
    moment: { title: resolved.title, docIds: resolved.docs.map((d) => d.id), hasMaterial: resolved.docs.length > 0 },
  };
}

const sampledChoiceSchema = z.object({ id: z.string().min(1), sample: z.string().default("") });

/** Choix renvoyé par le navigateur → règle et libellé relus dans le catalogue, jamais crus sur parole. */
function toChoice(dimension: FramingDimension, input: { id: string; sample: string } | null | undefined): FramingChoice | null {
  if (!input) return null;
  const option = findFramingOption(dimension, input.id);
  if (!option) throw new ApiError(400, `Option de ${dimension} inconnue : ${input.id}.`);
  return { id: option.id, label: option.label, rule: option.rule, sample: input.sample };
}

export const framingOptionsRequestSchema = z.object({
  dimension: z.enum(FRAMING_DIMENSIONS),
  chosen: z.object({ posture: sampledChoiceSchema.nullable().optional(), voice: sampledChoiceSchema.nullable().optional() }).default({}),
  excludeIds: z.array(z.string()).max(12).default([]),
  remark: z.string().trim().max(500).optional(),
  /** Le moment des étapes précédentes : le même d'un bout à l'autre du parcours. */
  moment: z.object({ title: z.string().max(500), docIds: z.array(z.string()).max(3) }).optional(),
});

export async function getFramingOptions(userId: string, seriesId: string, request: z.infer<typeof framingOptionsRequestSchema>) {
  const { context, moment } = await buildContext(userId, seriesId, request.moment);
  const options = await proposeFramingOptions({
    context,
    dimension: request.dimension,
    chosen: { posture: toChoice("posture", request.chosen.posture), voice: toChoice("voice", request.chosen.voice) },
    excludeIds: request.excludeIds,
    remark: request.remark,
  });
  if (options.length === 0) throw new ApiError(502, "Le modèle n'a pas proposé d'options utilisables : réessaie.");
  const profile = await db.query.creatorProfiles.findFirst({ where: eq(creatorProfiles.userId, userId), columns: { chosenVoice: true } });
  return { moment, options, accountVoice: parseStoredChosenVoice(profile?.chosenVoice) };
}

export const framingSignatureRequestSchema = z.object({
  posture: sampledChoiceSchema,
  voice: sampledChoiceSchema.nullable().optional(),
  story: sampledChoiceSchema,
});

export async function getFramingSignature(userId: string, seriesId: string, request: z.infer<typeof framingSignatureRequestSchema>) {
  const { context } = await buildContext(userId, seriesId);
  return proposeSignature({
    context,
    posture: toChoice("posture", request.posture)!,
    voice: toChoice("voice", request.voice),
    story: toChoice("story", request.story)!,
  });
}

export const saveFramingSchema = z.object({
  moment: z.object({ title: z.string(), docIds: z.array(z.string()).default([]) }),
  posture: sampledChoiceSchema,
  /** null = garder la voix du compte. */
  voice: sampledChoiceSchema.nullable(),
  story: sampledChoiceSchema,
  signature: signatureSchema.nullable(),
  rejected: z
    .array(z.object({ dimension: z.enum(FRAMING_DIMENSIONS), id: z.string(), sample: z.string() }))
    .max(30)
    .default([]),
  remarks: z.array(z.string().trim().max(500)).max(10).default([]),
});

/**
 * Enregistre le cadrage. Au premier cadrage du compte, la voix choisie devient la voix du compte
 * (et la série n'en garde pas de propre) ; ensuite, une voix choisie ici ne vaut que pour la série.
 */
export async function saveFraming(userId: string, seriesId: string, input: z.infer<typeof saveFramingSchema>) {
  await ownedSeries(userId, seriesId);
  const profile = await db.query.creatorProfiles.findFirst({ where: eq(creatorProfiles.userId, userId) });
  if (!profile) throw new ApiError(400, "Profil créateur introuvable.");
  const voice = toChoice("voice", input.voice);
  const accountVoice = parseStoredChosenVoice(profile.chosenVoice);
  if (voice && !accountVoice) {
    await db
      .update(creatorProfiles)
      .set({ chosenVoice: { ...voice, chosenAt: new Date().toISOString() } })
      .where(eq(creatorProfiles.userId, userId));
  }
  const framing: SeriesFraming = {
    moment: input.moment,
    posture: toChoice("posture", input.posture)!,
    voice: accountVoice ? voice : null,
    story: toChoice("story", input.story)!,
    signature: input.signature,
    rejected: input.rejected.map((r) => ({ ...r, label: findFramingOption(r.dimension, r.id)?.label ?? r.id })),
    remarks: input.remarks.filter(Boolean),
    completedAt: new Date().toISOString(),
  };
  await db.update(contentSeries).set({ framing }).where(and(eq(contentSeries.id, seriesId), eq(contentSeries.userId, userId)));
  const updated = (await listActiveSeriesForUser(userId)).find((s) => s.id === seriesId);
  if (!updated) throw new ApiError(404, "Série introuvable.");
  return updated;
}
