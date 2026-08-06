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
