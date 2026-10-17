import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { countUnreadDocuments, createEventByUser, listEventsForSubject } from "@/lib/services/materialEventService";
import { DATE_PRECISIONS, EVENT_KINDS } from "@/lib/llm/eventReader";
import { handleApiError } from "@/lib/api/errors";

const listSchema = z.object({ productId: z.uuid() });

const userEventSchema = z.object({
  productId: z.uuid(),
  date: z.string().trim().default(""),
  datePrecision: z.enum(DATE_PRECISIONS).default("unknown"),
  title: z.string().trim().min(1, "Give the event a title.").max(160),
  whatHappened: z.string().trim().min(1, "Say what happened.").max(1500),
  whatChanged: z.string().trim().max(1000).optional(),
  kind: z.enum(EVENT_KINDS),
  audiences: z.array(z.string().trim().min(1)).max(5).optional(),
});

/** Timeline of a topic (docs/SPEC_REDACTEUR_PAR_EVENEMENTS.md §3). */
export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const { productId } = listSchema.parse({ productId: request.nextUrl.searchParams.get("productId") });
    const [events, unreadDocuments] = await Promise.all([listEventsForSubject(userId, productId), countUnreadDocuments(userId, productId)]);
    return NextResponse.json({ events, unreadDocuments });
  } catch (error) {
    return handleApiError(error);
  }
}

/** "This happened": an event written by hand by the author. */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const input = userEventSchema.parse(await request.json());
    const event = await createEventByUser(userId, input);
    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
