import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { calendarEntries, postingGoals } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { parseMonth } from "@/lib/services/calendarService";
import { placeScriptOnCalendar } from "@/lib/services/scriptImportService";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { listCalendarRange } from "@/lib/services/calendarWeekService";

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Format attendu : YYYY-MM");

const placeScriptSchema = z.object({
  scriptId: z.uuid(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format attendu : YYYY-MM-DD"),
});

const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format attendu : YYYY-MM-DD");

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId();
    // Week view (`from`/`to`, day bounds, `to` exclusive): slots enriched with their post.
    const fromParam = request.nextUrl.searchParams.get("from");
    if (fromParam) {
      const from = new Date(`${daySchema.parse(fromParam)}T00:00:00.000Z`);
      const to = new Date(`${daySchema.parse(request.nextUrl.searchParams.get("to"))}T00:00:00.000Z`);
      if (!(to > from) || to.getTime() - from.getTime() > 62 * 24 * 3600 * 1000) {
        throw new ApiError(400, "Invalid period.");
      }
      // `all=1`: every empty slot of the window too (the plan and « Prepare next week » need them), not only the next one of each series.
      return NextResponse.json(await listCalendarRange(userId, from, to, { allSlots: request.nextUrl.searchParams.get("all") === "1" }));
    }
    const month = monthSchema.parse(request.nextUrl.searchParams.get("month"));
    const { year, monthIndex } = parseMonth(month);

    const rangeStart = new Date(Date.UTC(year, monthIndex, 1));
    const rangeEnd = new Date(Date.UTC(year, monthIndex + 1, 1));

    const [entries, goals] = await Promise.all([
      db.query.calendarEntries.findMany({
        where: and(
          eq(calendarEntries.userId, userId),
          gte(calendarEntries.scheduledDate, rangeStart),
          lt(calendarEntries.scheduledDate, rangeEnd)
        ),
        with: {
          script: { columns: { id: true, title: true, status: true } },
          contentCategory: { columns: { id: true, label: true } },
          series: { columns: { id: true, label: true } },
        },
      }),
      db.query.postingGoals.findMany({ where: eq(postingGoals.userId, userId) }),
    ]);

    return NextResponse.json({ entries, goals });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Places an already generated (unscheduled) script on a calendar date. */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const { scriptId, scheduledDate } = placeScriptSchema.parse(await request.json());
    const entry = await placeScriptOnCalendar(userId, scriptId, scheduledDate);
    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
