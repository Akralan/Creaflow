import { z } from "zod";
import { isKnownPlatform } from "@/lib/social/types";

export const platformSchema = z.string().refine(isKnownPlatform, { message: "Unknown platform." });
export const contentCategorySchema = z.uuid();
export const contentTypeSchema = z.enum(["visual", "text"]);
// Idea suggested by the creator at a generation gate (docs/SPEC_REDACTEUR_EN_CHEF.md Lot A).
export const directiveSchema = z.string().trim().max(500).optional();
// Series mode (docs/SPEC_REDACTEUR_EN_CHEF.md §1/§2, Lot B2).

// Topic catalogue (UI: "topic"; schema/routes/types remain "Product", docs/SPEC_MATIERE_EDITEUR.md
// §3.3 — rename on the UI side only). MIN_PRODUCTS lowered to 1: a personal branding profile may
// have a single topic, with no value proposition (valueProposition optional).
export const MIN_PRODUCTS = 1;
export const MAX_PRODUCTS = 5;
// Sources connected during onboarding, before being grouped into at most MAX_PRODUCTS topics.
export const MAX_ONBOARDING_SOURCES = 15;

// Publishing days (docs/SPEC_ONBOARDING_MVP.md §2 screen 6, §5) — ISO, 1 = Monday … 7 = Sunday.
// At least one day: an empty rhythm makes no sense, the screen prevents unchecking the last one.
export const DEFAULT_PUBLISHING_DAYS = [3, 6];
export const publishingDaysSchema = z
  .array(z.number().int().min(1).max(7))
  .min(1, "Choose at least one publishing day.")
  .max(7)
  .transform((days) => [...new Set(days)].sort((a, b) => a - b));
// "What do you expect from us?" — free text, bounded so it stays injectable into prompts.
export const expectationsSchema = z.string().trim().max(2000);

// Language of the generated posts (src/lib/language.ts): null = follow the language of the notes.
export const postLanguageSchema = z.enum(["en", "fr"]);

// Visual resource library (docs/SPEC_RESSOURCES_VISUELLES.md §7.2: "a selection of
// 40 images" as the reference order of magnitude).
export const MAX_ASSETS_PER_INGESTION = 40;
export const MAX_ASSET_FILE_SIZE_BYTES = 10 * 1024 * 1024;

// Ingestion of a GitHub repository (docs/superpowers/specs/2026-08-31-onboarding-dev-github-design.md §6.1).
export const MAX_GITHUB_MD_FILES = 50;
// A file beyond this is IGNORED, never truncated: a .md cut in the middle would produce misleading
// material, which the whole product forbids itself.
export const MAX_GITHUB_FILE_BYTES = 100 * 1024;
export const MAX_GITHUB_COMMITS = 100;

// Notion ingestion (docs/SPEC_CONNECTEURS_ET_SUJETS.md §4). A living Notion page has no
// bottom: the cap applies to the blocks read overall, sub-pages included. Beyond it, ingestion is
// marked truncated — reported to the user, without putting the source in error.
export const MAX_NOTION_BLOCKS = 2000;
// Depth of descent into sub-pages. 3 covers the usual filing (space > project > note)
// without risking pulling up an entire workspace through a single topic.
export const MAX_NOTION_DEPTH = 3;

// Linear ingestion (docs/SPEC_CONNECTEURS_ET_SUJETS.md §5). Project updates are the connector's best
// material — already written to be read — hence a more generous cap than for
// issues, of which only the completed ones are kept.
export const MAX_LINEAR_UPDATES = 50;
export const MAX_LINEAR_ISSUES = 100;
