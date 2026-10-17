import { describe, expect, it } from "vitest";
import { parseStoredSeriesForm } from "./seriesForm";

describe("parseStoredSeriesForm", () => {
  it("lit une forme complète et comble les champs facultatifs", () => {
    const form = parseStoredSeriesForm({
      wants: "Savoir si un patient fait ses exercices.",
      episodeShape: "A patient, what wasn't working, what the app showed, what the physio did.",
      avoid: "La technique.",
      register: "Six to ten lines, informal tone.",
    });
    expect(form).not.toBeNull();
    expect(form?.words).toEqual([]);
    expect(form?.editedByUser).toBe(false);
  });

  it("rend null sur un jsonb vide ou illisible", () => {
    expect(parseStoredSeriesForm(null)).toBeNull();
    expect(parseStoredSeriesForm({ wants: "" })).toBeNull();
  });
});
