import { r2Storage } from "./r2";
import type { ObjectStorage } from "./types";

export type { ObjectStorage } from "./types";

// Même esprit que LLM_PROVIDER (src/lib/llm/provider.ts) : un point d'extension identifié plutôt
// qu'une abstraction sur-conçue — un seul provider est implémenté aujourd'hui.
export function getObjectStorage(): ObjectStorage {
  const provider = process.env.STORAGE_PROVIDER || "r2";
  if (provider !== "r2") {
    throw new Error(`STORAGE_PROVIDER inconnu : "${provider}" (attendu "r2").`);
  }
  return r2Storage;
}

/** Vrai si le stockage objet est utilisable — sans lui, l'export de maquette reste local (téléchargement seul). */
export function isObjectStorageConfigured(): boolean {
  return Boolean(
    process.env.R2_ENDPOINT && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET && process.env.R2_PUBLIC_BASE_URL
  );
}
