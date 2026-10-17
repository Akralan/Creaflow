import { describe, expect, it } from "vitest";
import { parseStoredSeriesForm } from "./seriesForm";

describe("parseStoredSeriesForm", () => {
  it("lit une forme complète et comble les champs facultatifs", () => {
    const form = parseStoredSeriesForm({
      wants: "Savoir si un patient fait ses exercices.",
      episodeShape: "Un patient, ce qui n'allait pas, ce que l'app a montré, ce que le kiné a fait.",
      avoid: "La technique.",
      register: "Six à dix lignes, tutoiement.",
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
