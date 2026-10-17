import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { importScriptForUser } from "@/lib/services/scriptImportService";
import { storyboardStepSchema } from "@/lib/llm/scriptSchema";
import { platformSchema, contentCategorySchema, contentTypeSchema } from "@/lib/validation";
import { handleApiError } from "@/lib/api/errors";

// Import of a script written elsewhere (docs/SPEC_MATIERE_EDITEUR.md §2) — no LLM call, no quota.
// The role (contentCategoryId) remains mandatory for a free post (decision §8.2: NOT NULL column,
// calendar weighting, angle selection); with a series, it is derived from it
// (docs/SPEC_SERIES_ET_ROLES.md §4.2).
const schema = z
  .object({
    platform: platformSchema,
    contentCategoryId: contentCategorySchema.optional(),
    contentType: contentTypeSchema,
    productId: z.uuid().optional(),
    seriesId: z.uuid().optional(),
    scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format attendu : YYYY-MM-DD").optional(),
    calendarEntryId: z.uuid().optional(),
    // Optional here: writing elsewhere (§2) requires both on the form side (ImportScriptForm),
    // lazy creation (§4.5) may set a single block — importScriptForUser checks that at least
    // one content field is filled.
    title: z.string().min(1).optional(),
    caption: z.string().min(1).optional(),
    hashtags: z.array(z.string()).default([]),
    hookVisual: z.string().optional(),
    hookText: z.string().optional(),
    storyboard: z.array(storyboardStepSchema).optional(),
  })
  .refine((data) => !(data.scheduledDate && data.calendarEntryId), {
    message: "scheduledDate and calendarEntryId are mutually exclusive.",
  });

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = schema.parse(await request.json());
    const script = await importScriptForUser(userId, body, "imported");
    return NextResponse.json({ script }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
