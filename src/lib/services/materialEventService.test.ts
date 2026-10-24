import { describe, expect, it } from "vitest";
import { summarizeReading, tallyGenres } from "./materialEventService";

describe("summarizeReading", () => {
  it("compte les documents, ceux qui restent à lire et les événements déjà trouvés", () => {
    const read = new Date("2026-10-24T10:00:00Z");
    expect(
      summarizeReading([
        { eventsReadAt: read, events: 12 },
        { eventsReadAt: read, events: 0 },
        { eventsReadAt: null, events: 0 },
      ])
    ).toEqual({ documents: 3, unread: 1, events: 12 });
  });

  it("une source sans document : tout à zéro, rien à lire", () => {
    expect(summarizeReading([])).toEqual({ documents: 0, unread: 0, events: 0 });
  });
});

describe("tallyGenres", () => {
  it("additionne par genre et en tout", () => {
    expect(
      tallyGenres([
        { genre: "livraison", n: 3 },
        { genre: "décision", n: 5 },
      ])
    ).toEqual({ total: 8, byGenre: { livraison: 3, décision: 5 } });
  });

  it("rien : zéro et un objet vide", () => {
    expect(tallyGenres([])).toEqual({ total: 0, byGenre: {} });
  });
});
