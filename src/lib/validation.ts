import { z } from "zod";
import { isKnownPlatform } from "@/lib/social/types";

export const platformSchema = z.string().refine(isKnownPlatform, { message: "Plateforme inconnue." });
export const contentCategorySchema = z.uuid();
export const contentTypeSchema = z.enum(["video", "visual", "text"]);

// Catalogue produits : "3 à 5 produits phares" (BRIEF.md / SPEC_POC.md).
export const MIN_PRODUCTS = 3;
export const MAX_PRODUCTS = 5;
