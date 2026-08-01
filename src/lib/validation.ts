import { z } from "zod";

export const platformSchema = z.enum(["tiktok", "instagram", "linkedin"]);
export const contentCategorySchema = z.enum(["vente", "coulisses", "educatif"]);
