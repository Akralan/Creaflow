import { z } from "zod";
import { isKnownPlatform } from "@/lib/social/types";

export const platformSchema = z.string().refine(isKnownPlatform, { message: "Plateforme inconnue." });
export const contentCategorySchema = z.uuid();
export const contentTypeSchema = z.enum(["video", "visual", "text"]);
// Idée soufflée par le créateur sur une porte de génération (docs/SPEC_REDACTEUR_EN_CHEF.md Lot A).
export const directiveSchema = z.string().trim().max(500).optional();
// Mode d'une série (docs/SPEC_REDACTEUR_EN_CHEF.md §1/§2, Lot B2).
export const contentSeriesModeSchema = z.enum(["feuilleton", "rendez_vous"]);

// Catalogue de sujets (UI : "sujet" ; schéma/routes/types restent "Product", docs/SPEC_MATIERE_EDITEUR.md
// §3.3 — renommage côté UI uniquement). MIN_PRODUCTS abaissé à 1 : un profil personal branding peut
// n'avoir qu'un seul sujet, sans proposition de valeur (valueProposition optionnelle).
export const MIN_PRODUCTS = 1;
export const MAX_PRODUCTS = 5;

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
// Nano Banana en édition conditionnée fonctionne mieux avec peu d'images de référence.
export const MAX_GENERATE_IMAGE_SOURCE_ASSETS = 4;
