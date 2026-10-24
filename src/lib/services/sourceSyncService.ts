import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { materialSources } from "@/db/schema";
import { ConnectorRateLimitError } from "@/lib/connectors/errors";
import { syncSource } from "@/lib/services/sourceConnectorService";
import { logger } from "@/lib/logger";

/**
 * La synchronisation quotidienne de toutes les sources connectées (docs/SPEC_SYNCHRO_QUOTIDIENNE.md).
 *
 * Appelée par `POST /api/cron/sync`, que le cron du VPS déclenche une fois par nuit. Rien ne tourne
 * dans le processus Next entre deux appels : l'app n'a toujours pas de planificateur. Chaque source
 * passe par le même `syncSource` que le bouton de resynchronisation — comparaison par empreinte,
 * documents nouveaux insérés, documents changés relus — puis la lecture des événements suit toute
 * seule. Une source en erreur n'arrête pas les autres ; un quota atteint chez un fournisseur arrête
 * les sources de ce fournisseur pour cette nuit, les autres continuent.
 */

/** Au-delà, on s'arrête et on reprend la nuit suivante : les plus anciennes d'abord, rien n'est perdu. */
export const DEFAULT_BUDGET_MS = 25 * 60 * 1000;

export interface SyncableSource {
  id: string;
  userId: string;
  type: string;
  status: string;
  lastSyncedAt: Date | null;
}

/** L'ordre de passage : jamais synchronisées d'abord, puis de la plus ancienne synchro à la plus
 *  récente. Les sources à reconnecter sont écartées : le jeton est tombé, seule la personne peut
 *  le remettre, et réessayer chaque nuit ne ferait que bruiter les logs. Pur. */
export function orderForDailySync<T extends SyncableSource>(sources: ReadonlyArray<T>): T[] {
  return sources
    .filter((s) => s.status !== "needs_reconnect")
    .slice()
    .sort((a, b) => (a.lastSyncedAt?.getTime() ?? 0) - (b.lastSyncedAt?.getTime() ?? 0));
}

export interface DailySyncReport {
  /** Sources connues, celles à reconnecter comprises. */
  sources: number;
  synced: number;
  /** Sources passées parce que le fournisseur avait atteint son quota plus tôt dans la nuit. */
  rateLimited: number;
  failed: number;
  skippedReconnect: number;
  /** Le budget de temps est tombé avant la fin : la suite attend la nuit suivante. */
  stopped: boolean;
  added: number;
  updated: number;
}

export async function syncAllSources(options: { budgetMs?: number } = {}): Promise<DailySyncReport> {
  const budgetMs = options.budgetMs ?? DEFAULT_BUDGET_MS;
  const started = Date.now();
  const all = await db.query.materialSources.findMany({
    columns: { id: true, userId: true, type: true, status: true, lastSyncedAt: true },
  });
  const queue = orderForDailySync(all);
  const report: DailySyncReport = {
    sources: all.length,
    synced: 0,
    rateLimited: 0,
    failed: 0,
    skippedReconnect: all.length - queue.length,
    stopped: false,
    added: 0,
    updated: 0,
  };
  const blockedTypes = new Set<string>();

  for (const source of queue) {
    if (Date.now() - started > budgetMs) {
      report.stopped = true;
      break;
    }
    if (blockedTypes.has(source.type)) {
      report.rateLimited += 1;
      continue;
    }
    try {
      const result = await syncSource(source.userId, source.id);
      report.synced += 1;
      report.added += result.added;
      report.updated += result.updated;
    } catch (error) {
      if (error instanceof ConnectorRateLimitError) {
        blockedTypes.add(source.type);
        report.rateLimited += 1;
        logger.warn("Daily sync: provider quota reached, its other sources wait for tomorrow", { type: source.type, retryAfterMinutes: error.retryAfterMinutes });
        continue;
      }
      // syncSource a déjà posé status/lastError sur la source ; ici on compte, et on continue.
      report.failed += 1;
    }
  }

  logger.info("Daily sync finished", { ...report, durationMs: Date.now() - started });
  return report;
}

/** Pour les tests et les écrans : les sources d'un utilisateur déjà synchronisées au moins une fois. */
export async function syncedSourcesOf(userId: string) {
  return db.query.materialSources.findMany({
    where: and(eq(materialSources.userId, userId), isNotNull(materialSources.lastSyncedAt)),
    columns: { id: true, lastSyncedAt: true, status: true },
  });
}
