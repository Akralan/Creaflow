import { describe, expect, it } from "vitest";
import { syncBadge } from "./syncBadge";

const now = new Date("2026-10-24T22:00:00Z");
const at = (iso: string, status = "ok") => ({ lastSyncedAt: iso, status });

describe("syncBadge", () => {
  it("rien sans source", () => {
    expect(syncBadge([], now)).toBeNull();
  });

  it("« Not synced yet » quand aucune source n'a jamais été lue", () => {
    expect(syncBadge([{ lastSyncedAt: null, status: "ok" }], now)).toEqual({ label: "Not synced yet", tone: "none" });
  });

  it("la reconnexion gagne sur la date", () => {
    expect(syncBadge([at("2026-10-24T21:50:00Z"), at("2026-10-01T00:00:00Z", "needs_reconnect")], now)).toEqual({ label: "Needs reconnect", tone: "warn" });
  });

  it("l'heure, le jour, la semaine", () => {
    expect(syncBadge([at("2026-10-24T21:30:00Z")], now)?.label).toBe("Synced just now");
    expect(syncBadge([at("2026-10-24T17:00:00Z")], now)?.label).toBe("Synced 5 h ago");
    expect(syncBadge([at("2026-10-23T20:00:00Z")], now)).toEqual({ label: "Synced 1 day ago", tone: "ok" });
    expect(syncBadge([at("2026-10-21T20:00:00Z")], now)).toEqual({ label: "Synced 3 days ago", tone: "warn" });
    expect(syncBadge([at("2026-10-10T20:00:00Z")], now)).toEqual({ label: "Synced 2 weeks ago", tone: "warn" });
  });

  it("c'est la source la moins fraîche qui donne la date", () => {
    expect(syncBadge([at("2026-10-24T21:30:00Z"), at("2026-10-20T00:00:00Z")], now)?.label).toBe("Synced 4 days ago");
  });
});
