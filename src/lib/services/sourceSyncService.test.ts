import { describe, expect, it } from "vitest";
import { orderForDailySync } from "./sourceSyncService";

const src = (id: string, lastSyncedAt: string | null, status = "ok") => ({
  id,
  userId: "u",
  type: "notion_page",
  status,
  lastSyncedAt: lastSyncedAt ? new Date(lastSyncedAt) : null,
});

describe("orderForDailySync", () => {
  it("passe d'abord les sources jamais synchronisées, puis de la plus ancienne à la plus récente", () => {
    const ordered = orderForDailySync([src("recent", "2026-10-23T03:00:00Z"), src("never", null), src("old", "2026-10-10T03:00:00Z")]);
    expect(ordered.map((s) => s.id)).toEqual(["never", "old", "recent"]);
  });

  it("écarte les sources à reconnecter : seule la personne peut remettre le jeton", () => {
    const ordered = orderForDailySync([src("a", null), src("b", null, "needs_reconnect"), src("c", "2026-10-20T00:00:00Z", "error")]);
    expect(ordered.map((s) => s.id)).toEqual(["a", "c"]);
  });

  it("ne modifie pas le tableau reçu", () => {
    const input = [src("b", "2026-10-20T00:00:00Z"), src("a", null)];
    orderForDailySync(input);
    expect(input.map((s) => s.id)).toEqual(["b", "a"]);
  });
});
