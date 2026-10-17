import { photoroomRemover } from "./providers/photoroom";

/**
 * Background removal (docs/SPEC_COMPOSITION_VISUELLE.md §2 "Cutout", §5.3) — external service behind
 * an adapter, same pattern as `LLM_PROVIDER` (src/lib/llm/provider.ts). Without an environment
 * variable, the function is simply absent: the prompt doesn't offer it, the editor doesn't
 * show the toggle, nothing else changes.
 */

export interface BackgroundRemover {
  /** Returns a PNG with transparency. Throws if the service fails. */
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
