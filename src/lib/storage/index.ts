import { r2Storage } from "./r2";
import type { ObjectStorage } from "./types";

export type { ObjectStorage } from "./types";

// Same spirit as LLM_PROVIDER (src/lib/llm/provider.ts): an identified extension point rather
// than an over-engineered abstraction — only one provider is implemented today.
export function getObjectStorage(): ObjectStorage {
  const provider = process.env.STORAGE_PROVIDER || "r2";
  if (provider !== "r2") {
    throw new Error(`STORAGE_PROVIDER inconnu : "${provider}" (attendu "r2").`);
  }
  return r2Storage;
}

/** True if object storage is usable — without it, mockup export stays local (download only). */
export function isObjectStorageConfigured(): boolean {
  return Boolean(
    process.env.R2_ENDPOINT && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET && process.env.R2_PUBLIC_BASE_URL
  );
}
