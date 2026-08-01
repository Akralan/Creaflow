import { z } from "zod";

export const platformSchema = z.enum(["tiktok", "instagram", "linkedin"]);
export const contentCategorySchema = z.enum(["vente", "coulisses", "educatif"]);

// Catalogue produits : "3 à 5 produits phares" (BRIEF.md / SPEC_POC.md).
export const MIN_PRODUCTS = 3;
export const MAX_PRODUCTS = 5;
