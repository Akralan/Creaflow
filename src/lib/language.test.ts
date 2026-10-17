import { describe, expect, it } from "vitest";
import { buildLanguageBlock, detectLanguage, isPostLanguage, languageFailure, resolvePostLanguage } from "./language";

const FRENCH = "Sur l'iPhone 11 de Julien, la page web tourne à 6 fps et rate une répétition sur trois, même quand il en fait 20 pour tester. Je n'ai pas encore de correction.";
const ENGLISH = "On Julien's iPhone 11, the page ran at 6 fps and missed one repetition out of three, even when he did 20 of them for the test. I did not have a fix yet.";

describe("detectLanguage", () => {
  it("tells French from English", () => {
    expect(detectLanguage(FRENCH)).toBe("fr");
    expect(detectLanguage(ENGLISH)).toBe("en");
  });

  it("returns null when it can't tell", () => {
    expect(detectLanguage("")).toBeNull();
    expect(detectLanguage("fps 6 100° 160°")).toBeNull();
    expect(detectLanguage("El teléfono tarda demasiado en procesar cada imagen de la cámara.")).toBeNull();
  });

  it("reads markdown and code around the prose", () => {
    expect(detectLanguage(`# Devlog\n\n\`\`\`ts\nconst a = 1;\n\`\`\`\n\n${FRENCH}`)).toBe("fr");
  });
});

describe("resolvePostLanguage", () => {
  it("takes the profile language, whatever the notes are in", () => {
    expect(resolvePostLanguage("en", [FRENCH])).toEqual({ language: "en", source: "profile" });
    expect(resolvePostLanguage("fr", [ENGLISH])).toEqual({ language: "fr", source: "profile" });
  });

  it("falls back on the notes when the profile sets nothing", () => {
    expect(resolvePostLanguage(null, [FRENCH])).toEqual({ language: "fr", source: "notes" });
    expect(resolvePostLanguage(undefined, [ENGLISH])).toEqual({ language: "en", source: "notes" });
  });

  it("ignores an unsupported stored value", () => {
    expect(resolvePostLanguage("de", [FRENCH])).toEqual({ language: "fr", source: "notes" });
  });

  it("follows the language most of the notes are in", () => {
    expect(resolvePostLanguage(null, [FRENCH, FRENCH, "Short English note about the app and the plan for this week."]).language).toBe("fr");
  });

  it("falls back on the default with no notes to read", () => {
    expect(resolvePostLanguage(null, [])).toEqual({ language: "en", source: "default" });
    expect(resolvePostLanguage(null, ["6 fps"])).toEqual({ language: "en", source: "default" });
  });
});

describe("languageFailure", () => {
  it("flags a post in the wrong language", () => {
    expect(languageFailure("en", [FRENCH])).toContain("written in French");
    expect(languageFailure("fr", [ENGLISH])).toContain("written in English");
  });

  it("lets through the right language and what it can't tell", () => {
    expect(languageFailure("fr", [FRENCH])).toBeNull();
    expect(languageFailure("en", ["6 fps"])).toBeNull();
  });
});

describe("buildLanguageBlock / isPostLanguage", () => {
  it("names the language in the block", () => {
    expect(buildLanguageBlock("fr")).toContain("in French");
    expect(buildLanguageBlock("en")).toContain("in English");
  });

  it("accepts only supported codes", () => {
    expect(isPostLanguage("fr")).toBe(true);
    expect(isPostLanguage("de")).toBe(false);
    expect(isPostLanguage(null)).toBe(false);
  });
});
