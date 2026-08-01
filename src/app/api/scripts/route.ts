import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateScript } from "@/lib/claude/generateScript";
import { requireUserId } from "@/lib/auth/session";
import { buildGenerationContext, createScriptRecord } from "@/lib/services/scriptService";
import { platformSchema, contentCategorySchema } from "@/lib/validation";
import { handleApiError } from "@/lib/api/errors";

const schema = z.object({
  platform: platformSchema,
  contentCategory: contentCategorySchema,
  productId: z.uuid().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const { platform, contentCategory, productId } = schema.parse(await request.json());

    const context = await buildGenerationContext(userId, platform, contentCategory, productId);
    const generated = await generateScript(context);
    const script = await createScriptRecord(userId, platform, contentCategory, productId ?? null, generated);

    return NextResponse.json({ script }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
