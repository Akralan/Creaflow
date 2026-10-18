import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { calendarEntries } from "@/db/schema";

/**
 * Rattrapage des créneaux « en chargement » (docs/SPEC_ENTREE_PAR_LE_REPO.md §6) : si le serveur a
 * redémarré pendant l'écriture, leurs créneaux resteraient `generating` pour toujours (verrouillés,
 * impossibles à ouvrir). Écrire un post prend une à deux minutes : passé ce délai depuis le moment où le
 * créneau a été marqué (`generating_since`, propre à chaque demande — et non plus la date de la première
 * demande du compte, qui libérait aussitôt toute demande suivante), il repasse à `planned`.
 */
export const GENERATING_TIMEOUT_MINUTES = 10;

export async function releaseStaleGenerating(userId: string): Promise<void> {
  await db
    .update(calendarEntries)
    .set({ status: "planned", generatingSince: null })
    .where(
      and(
        eq(calendarEntries.userId, userId),
        eq(calendarEntries.status, "generating"),
        isNull(calendarEntries.scriptId),
        or(isNull(calendarEntries.generatingSince), lt(calendarEntries.generatingSince, sql`now() - make_interval(mins => ${GENERATING_TIMEOUT_MINUTES})`))
      )
    );
}
