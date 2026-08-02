import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { calendarEntries, postingGoals } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { parseMonth } from "@/lib/services/calendarService";
import { handleApiError } from "@/lib/api/errors";

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Format attendu : YYYY-MM");

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId();
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
