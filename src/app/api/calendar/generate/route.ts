import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { calendarEntries, postingGoals } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import {
  distributeCategories,
  distributeDays,
  parseMonth,
  weeksInMonth,
} from "@/lib/services/calendarService";
import { ApiError, handleApiError } from "@/lib/api/errors";

const schema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Format attendu : YYYY-MM"),
});

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const { month } = schema.parse(await request.json());
    const { year, monthIndex, daysInMonth } = parseMonth(month);

    const rangeStart = new Date(Date.UTC(year, monthIndex, 1));
    const rangeEnd = new Date(Date.UTC(year, monthIndex + 1, 1));

    const alreadyGenerated = await db.query.calendarEntries.findFirst({
      where: and(
        eq(calendarEntries.userId, userId),
        gte(calendarEntries.scheduledDate, rangeStart),
        lt(calendarEntries.scheduledDate, rangeEnd)
      ),
    });
    if (alreadyGenerated) {
      throw new ApiError(409, "Le calendrier de ce mois est déjà généré.");
    }

    const goals = await db.query.postingGoals.findMany({ where: eq(postingGoals.userId, userId) });
    if (goals.length === 0) {
      throw new ApiError(400, "Définis d'abord tes objectifs hebdomadaires par plateforme (PostingGoal).");
    }

    const weeks = weeksInMonth(daysInMonth);
    const rowsToInsert = goals.flatMap((goal) => {
      const slotCount = Math.round(goal.targetCountPerWeek * weeks);
      const categories = distributeCategories(slotCount);
      const days = distributeDays(slotCount, daysInMonth);

      return categories.map((contentCategory, i) => ({
        userId,
        platform: goal.platform,
        scheduledDate: new Date(Date.UTC(year, monthIndex, days[i])),
        contentCategory,
      }));
    });

    const entries = rowsToInsert.length > 0 ? await db.insert(calendarEntries).values(rowsToInsert).returning() : [];

    return NextResponse.json({ entries }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
