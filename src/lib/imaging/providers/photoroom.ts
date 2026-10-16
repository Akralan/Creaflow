import type { BackgroundRemover } from "../backgroundRemoval";

/**
 * Adaptateur Photoroom « Remove Background API » (docs/SPEC_COMPOSITION_VISUELLE.md §2) :
 * `POST https://sdk.photoroom.com/v1/segment`, en-tête `x-api-key`, champ multipart `image_file`,
 * PNG avec transparence en retour. ~0,02 $ par appel ; une clé préfixée `sandbox_` est gratuite
 * (filigrane, 100 appels par jour) pour le développement.
 */

const ENDPOINT = process.env.PHOTOROOM_ENDPOINT || "https://sdk.photoroom.com/v1/segment";
const TIMEOUT_MS = 30_000;

export class BackgroundRemovalError extends Error {
  readonly status: number | null;
  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "BackgroundRemovalError";
    this.status = status;
  }
}

export const photoroomRemover: BackgroundRemover = {
  async removeBackground(bytes, mimeType) {
    const apiKey = process.env.PHOTOROOM_API_KEY;
    if (!apiKey) throw new BackgroundRemovalError("PHOTOROOM_API_KEY n'est pas défini.");
    const form = new FormData();
    form.append("image_file", new Blob([new Uint8Array(bytes)], { type: mimeType }), "image");
    form.append("format", "png");
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "x-api-key": apiKey, Accept: "image/png, application/json" },
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new BackgroundRemovalError(`Photoroom a répondu ${response.status}${detail ? ` : ${detail.slice(0, 200)}` : ""}`, response.status);
    }
    const out = Buffer.from(await response.arrayBuffer());
    if (out.length === 0) throw new BackgroundRemovalError("Photoroom a renvoyé une image vide.");
    return out;
  },
};
