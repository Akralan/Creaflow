import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { MAX_STYLE_LIST_ITEMS, MAX_STYLE_RULES, styleRuleSchema } from "@/lib/llm/styleProfile";
import { updateStyleLists } from "@/lib/services/styleLearningService";

const schema = z.object({
  rules: z.array(styleRuleSchema).max(MAX_STYLE_RULES).optional(),
  avoid: z.array(z.string().trim().min(1)).max(MAX_STYLE_LIST_ITEMS).optional(),
  prefer: z.array(z.string().trim().min(1)).max(MAX_STYLE_LIST_ITEMS).optional(),
});

/** Édition manuelle des règles de style (docs/SPEC_APPRENTISSAGE_STYLE.md §5.3). */
export async function PATCH(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = schema.parse(await request.json());
    const styleProfile = await updateStyleLists(userId, body);
    return NextResponse.json({ styleProfile });
  } catch (error) {
    return handleApiError(error);
  }
}
