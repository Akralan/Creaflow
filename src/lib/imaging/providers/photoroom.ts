import type { BackgroundRemover } from "../backgroundRemoval";

/**
 * Photoroom "Remove Background API" adapter (docs/SPEC_COMPOSITION_VISUELLE.md §2):
 * `POST https://sdk.photoroom.com/v1/segment`, `x-api-key` header, multipart field `image_file`,
 * PNG with transparency returned. ~$0.02 per call; a key prefixed `sandbox_` is free
 * (watermark, 100 calls per day) for development.
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
    if (!apiKey) throw new BackgroundRemovalError("PHOTOROOM_API_KEY is not set.");
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
      throw new BackgroundRemovalError(`Photoroom responded ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`, response.status);
    }
    const out = Buffer.from(await response.arrayBuffer());
    if (out.length === 0) throw new BackgroundRemovalError("Photoroom returned an empty image.");
    return out;
  },
};
