import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { calendarEntries, startJobs } from "@/db/schema";

/**
 * Rattrapage des créneaux « en chargement » (docs/SPEC_ENTREE_PAR_LE_REPO.md §6) : si le serveur a
 * redémarré pendant l'écriture des deux autres posts, leurs créneaux resteraient `generating` pour
 * toujours (verrouillés, impossibles à ouvrir). Écrire deux posts prend 2 à 3 minutes : passé ce délai
 * depuis la demande, ils repassent à `planned` et la personne peut les écrire elle-même.
 */
export const GENERATING_TIMEOUT_MINUTES = 10;

export async function releaseStaleGenerating(userId: string): Promise<void> {
  const stale = await db
    .select({ userId: startJobs.userId })
    .from(startJobs)
    .where(
      and(eq(startJobs.userId, userId), lt(startJobs.otherPostsRequestedAt, sql`now() - make_interval(mins => ${GENERATING_TIMEOUT_MINUTES})`))
    );
  if (stale.length === 0) return;
  await db
    .update(calendarEntries)
    .set({ status: "planned" })
    .where(and(eq(calendarEntries.userId, userId), eq(calendarEntries.status, "generating"), isNull(calendarEntries.scriptId)));
}
