import { z } from "zod";
import { isKnownPlatform } from "@/lib/social/types";

export const platformSchema = z.string().refine(isKnownPlatform, { message: "Plateforme inconnue." });
export const contentCategorySchema = z.uuid();
export const contentTypeSchema = z.enum(["video", "visual", "text"]);

// Catalogue produits : "3 à 5 produits phares" (BRIEF.md / SPEC_POC.md).
export const MIN_PRODUCTS = 3;
export const MAX_PRODUCTS = 5;

// Bibliothèque de ressources visuelles (docs/SPEC_RESSOURCES_VISUELLES.md §7.2 : "une sélection de
// 40 images" comme ordre de grandeur de référence).
export const MAX_ASSETS_PER_INGESTION = 40;
export const MAX_ASSET_FILE_SIZE_BYTES = 10 * 1024 * 1024;
// Nano Banana en édition conditionnée fonctionne mieux avec peu d'images de référence.
export const MAX_GENERATE_IMAGE_SOURCE_ASSETS = 4;
