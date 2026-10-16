import { photoroomRemover } from "./providers/photoroom";

/**
 * Détourage (docs/SPEC_COMPOSITION_VISUELLE.md §2 « Détourage », §5.3) — service externe derrière un
 * adaptateur, même motif que `LLM_PROVIDER` (src/lib/llm/provider.ts). Sans variable
 * d'environnement, la fonction est simplement absente : le prompt ne la propose pas, l'éditeur ne
 * montre pas la bascule, rien d'autre ne change.
 */

export interface BackgroundRemover {
  /** Renvoie un PNG avec transparence. Lève en cas d'échec du service. */
  removeBackground(bytes: Buffer, mimeType: string): Promise<Buffer>;
}

export type BackgroundRemovalProviderId = "photoroom";

export function getBackgroundRemovalProviderId(): BackgroundRemovalProviderId | null {
  const raw = (process.env.BACKGROUND_REMOVAL_PROVIDER ?? "").trim().toLowerCase();
  if (raw === "photoroom" && process.env.PHOTOROOM_API_KEY) return "photoroom";
  return null;
}

export function isBackgroundRemovalAvailable(): boolean {
  return getBackgroundRemovalProviderId() !== null;
}

export function getBackgroundRemover(): BackgroundRemover | null {
  switch (getBackgroundRemovalProviderId()) {
    case "photoroom":
      return photoroomRemover;
    default:
      return null;
  }
}
