import { describe, expect, it } from "vitest";
import { buildDevContext, devOnboardingProfileTool, DEV_SYSTEM_PROMPT } from "./onboardingChat";
import { KNOWN_PLATFORMS } from "@/lib/social/types";

function extractedFieldsProperties(): Record<string, unknown> {
  const fields = devOnboardingProfileTool.input_schema.properties.extractedFields as {
    properties: Record<string, unknown>;
  };
  return fields.properties;
}

describe("devOnboardingProfileTool", () => {
  it("ne propose pas equipment — hors sujet pour du contenu de dev, majoritairement textuel", () => {
    expect(extractedFieldsProperties()).not.toHaveProperty("equipment");
  });

  it("conserve les champs que finalizeOnboarding exige", () => {
    const properties = extractedFieldsProperties();
    for (const key of ["brandName", "activityType", "weeklyTimeAvailable", "suggestedPlatforms", "targetAudience"]) {
      expect(properties).toHaveProperty(key);
    }
  });

  it("garde le même contrat de sortie que le tool généraliste", () => {
    expect(devOnboardingProfileTool.input_schema.required).toEqual(["assistantReply", "extractedFields", "complete"]);
  });
});

describe("DEV_SYSTEM_PROMPT", () => {
  it("interdit explicitement de demander le matériel de production", () => {
    expect(DEV_SYSTEM_PROMPT.toLowerCase()).toContain("matériel");
  });

  it("borne le nombre de questions", () => {
    expect(DEV_SYSTEM_PROMPT).toMatch(/deux|trois/i);
  });

  it("ne laisse suggérer que des plateformes connues", () => {
    for (const platform of KNOWN_PLATFORMS) {
      expect(DEV_SYSTEM_PROMPT).toContain(platform.key);
    }
  });
});

describe("buildDevContext", () => {
  it("résume le profil GitHub et les sujets retenus", () => {
    const context = buildDevContext({
      login: "alix",
      name: "Alix",
      bio: "je fabrique des trucs",
      subjects: [
        {
          name: "creaflow",
          description: "rédacteur en chef IA",
          language: "TypeScript",
          readmeExcerpt: "Creaflow est…",
        },
      ],
    });

    expect(context).toContain("alix");
    expect(context).toContain("creaflow");
    expect(context).toContain("TypeScript");
    expect(context).toContain("Creaflow est…");
  });

  it("reste lisible quand tout l'optionnel est absent", () => {
    const context = buildDevContext({
      login: "alix",
      name: null,
      bio: null,
      subjects: [{ name: "truc", description: null, language: null, readmeExcerpt: null }],
    });

    expect(context).toContain("alix");
    expect(context).toContain("truc");
    expect(context).not.toContain("null");
  });
});
