import { z } from "zod";
import { isKnownPlatform } from "@/lib/social/types";

export const platformSchema = z.string().refine(isKnownPlatform, { message: "Plateforme inconnue." });
export const contentCategorySchema = z.uuid();
export const contentTypeSchema = z.enum(["visual", "text"]);
// Idée soufflée par le créateur sur une porte de génération (docs/SPEC_REDACTEUR_EN_CHEF.md Lot A).
export const directiveSchema = z.string().trim().max(500).optional();
// Mode d'une série (docs/SPEC_REDACTEUR_EN_CHEF.md §1/§2, Lot B2).

// Catalogue de sujets (UI : "sujet" ; schéma/routes/types restent "Product", docs/SPEC_MATIERE_EDITEUR.md
// §3.3 — renommage côté UI uniquement). MIN_PRODUCTS abaissé à 1 : un profil personal branding peut
// n'avoir qu'un seul sujet, sans proposition de valeur (valueProposition optionnelle).
export const MIN_PRODUCTS = 1;
export const MAX_PRODUCTS = 5;
// Sources branchées pendant l'onboarding, avant regroupement en au plus MAX_PRODUCTS sujets.
export const MAX_ONBOARDING_SOURCES = 15;

// Jours de publication (docs/SPEC_ONBOARDING_MVP.md §2 écran 6, §5) — ISO, 1 = lundi … 7 = dimanche.
// Au moins un jour : un rythme vide n'a pas de sens, l'écran empêche de décocher le dernier.
export const DEFAULT_PUBLISHING_DAYS = [3, 6];
export const publishingDaysSchema = z
  .array(z.number().int().min(1).max(7))
  .min(1, "Choisis au moins un jour de publication.")
  .max(7)
  .transform((days) => [...new Set(days)].sort((a, b) => a - b));
// « Qu'est-ce que tu attends de nous ? » — texte libre, borné pour rester injectable dans les prompts.
export const expectationsSchema = z.string().trim().max(2000);

// Bibliothèque de ressources visuelles (docs/SPEC_RESSOURCES_VISUELLES.md §7.2 : "une sélection de
// 40 images" comme ordre de grandeur de référence).
export const MAX_ASSETS_PER_INGESTION = 40;
export const MAX_ASSET_FILE_SIZE_BYTES = 10 * 1024 * 1024;

// Ingestion d'un dépôt GitHub (docs/superpowers/specs/2026-08-31-onboarding-dev-github-design.md §6.1).
export const MAX_GITHUB_MD_FILES = 50;
// Un fichier au-delà est IGNORÉ, jamais tronqué : un .md coupé au milieu produirait de la matière
// trompeuse, ce que tout le produit s'interdit.
export const MAX_GITHUB_FILE_BYTES = 100 * 1024;
export const MAX_GITHUB_COMMITS = 100;

// Ingestion Notion (docs/SPEC_CONNECTEURS_ET_SUJETS.md §4). Une page Notion vivante n'a pas de
// fond : le plafond porte sur les blocs lus en tout, sous-pages comprises. Au-delà, l'ingestion est
// marquée tronquée — signalée à l'utilisateur, sans passer la source en erreur.
export const MAX_NOTION_BLOCKS = 2000;
// Profondeur de descente dans les sous-pages. 3 couvre le rangement usuel (espace > projet > note)
// sans risquer de remonter un workspace entier par un sujet unique.
export const MAX_NOTION_DEPTH = 3;

// Ingestion Linear (docs/SPEC_CONNECTEURS_ET_SUJETS.md §5). Les project updates sont la meilleure
// matière du connecteur — déjà écrites pour être lues — d'où un plafond plus généreux que sur les
// issues, dont on ne garde que les terminées.
export const MAX_LINEAR_UPDATES = 50;
export const MAX_LINEAR_ISSUES = 100;
