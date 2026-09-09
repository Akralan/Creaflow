import { describe, expect, it } from "vitest";
import { buildConnectedContext, connectedOnboardingProfileTool, buildConnectedSystemPrompt } from "./onboardingChat";
import { KNOWN_PLATFORMS } from "@/lib/social/types";

function extractedFieldsProperties(): Record<string, unknown> {
  const fields = connectedOnboardingProfileTool.input_schema.properties.extractedFields as {
    properties: Record<string, unknown>;
  };
  return fields.properties;
}

describe("connectedOnboardingProfileTool", () => {
  it("ne propose pas equipment — hors sujet pour du contenu majoritairement textuel", () => {
    expect(extractedFieldsProperties()).not.toHaveProperty("equipment");
  });

  it("conserve les champs que finalizeOnboarding exige", () => {
    const properties = extractedFieldsProperties();
    for (const key of ["brandName", "activityType", "weeklyTimeAvailable", "suggestedPlatforms", "targetAudience"]) {
      expect(properties).toHaveProperty(key);
    }
  });

  it("garde le même contrat de sortie que le tool généraliste", () => {
    expect(connectedOnboardingProfileTool.input_schema.required).toEqual([
      "assistantReply",
      "extractedFields",
      "complete",
    ]);
  });
});

describe("buildConnectedSystemPrompt", () => {
  const prompt = buildConnectedSystemPrompt("Notion");

  it("nomme la plateforme réellement connectée", () => {
    expect(prompt).toContain("Notion");
    // Le prompt ne doit plus supposer GitHub : c'était le cas quand il n'existait qu'un parcours.
    expect(buildConnectedSystemPrompt("Linear")).not.toContain("GitHub");
  });

  it("reste lisible sans nom de plateforme", () => {
    expect(buildConnectedSystemPrompt("")).toContain("son compte");
  });

  it("interdit explicitement de demander le matériel de production", () => {
    expect(prompt.toLowerCase()).toContain("matériel");
  });

  it("borne le nombre de questions", () => {
    expect(prompt).toMatch(/deux|trois/i);
  });

  it("ne laisse suggérer que des plateformes connues", () => {
    for (const platform of KNOWN_PLATFORMS) {
      expect(prompt).toContain(platform.key);
    }
  });
});

describe("buildConnectedContext", () => {
  it("résume le profil du compte connecté et les sujets retenus", () => {
    const context = buildConnectedContext({
      providerLabel: "Notion",
      login: "alix",
      name: "Alix",
      bio: "je fabrique des trucs",
      subjects: [{ name: "creaflow", description: "rédacteur en chef IA", excerpt: "Creaflow est…" }],
    });

    expect(context).toContain("Notion");
    expect(context).toContain("alix");
    expect(context).toContain("creaflow");
    expect(context).toContain("Creaflow est…");
  });

  it("reste lisible quand tout l'optionnel est absent", () => {
    const context = buildConnectedContext({
      providerLabel: "",
      login: "alix",
      name: null,
      bio: null,
      subjects: [{ name: "truc", description: null, excerpt: null }],
    });

    expect(context).toContain("alix");
    expect(context).toContain("truc");
    expect(context).not.toContain("null");
  });
});
