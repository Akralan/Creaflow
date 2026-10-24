import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { syncAllSources } from "@/lib/services/sourceSyncService";
import { logger } from "@/lib/logger";

/**
 * La synchronisation quotidienne des sources (docs/SPEC_SYNCHRO_QUOTIDIENNE.md), déclenchée par le
 * cron du VPS (`deploy/sync.sh`), jamais par un utilisateur : l'appel porte `Authorization: Bearer
 * <CRON_SECRET>`. Sans secret configuré, la route refuse explicitement plutôt que d'être ouverte.
 * Synchrone : le cron attend le rapport, qui finit dans son journal.
 */

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!process.env.CRON_SECRET?.trim()) {
    return NextResponse.json({ error: "CRON_SECRET is not set: the daily sync is off." }, { status: 503 });
  }
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const report = await syncAllSources();
    return NextResponse.json({ report });
  } catch (error) {
    logger.error("Daily sync failed", error);
    return NextResponse.json({ error: "The daily sync failed. See the server logs." }, { status: 500 });
  }
}
