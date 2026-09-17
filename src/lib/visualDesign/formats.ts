/**
 * Formats de slide par plateforme (docs/SPEC_DESIGN_HTML_SUR_IMAGE.md §2 « Formats »). L'auteur
 * peut surcharger le format à la création ; le défaut suit la plateforme du script.
 */
export interface DesignFormat {
  id: DesignFormatId;
  label: string;
  width: number;
  height: number;
}

export type DesignFormatId = "portrait" | "square" | "story" | "landscape";

export const DESIGN_FORMATS: Record<DesignFormatId, DesignFormat> = {
  portrait: { id: "portrait", label: "Portrait 4:5 (1080×1350)", width: 1080, height: 1350 },
  square: { id: "square", label: "Carré (1080×1080)", width: 1080, height: 1080 },
  story: { id: "story", label: "Vertical 9:16 (1080×1920)", width: 1080, height: 1920 },
  landscape: { id: "landscape", label: "Paysage 16:9 (1600×900)", width: 1600, height: 900 },
};

export function defaultFormatForPlatform(platform: string): DesignFormatId {
  switch (platform) {
    case "tiktok":
      return "story";
    case "x":
      return "landscape";
    case "instagram":
    case "linkedin":
      return "portrait";
    default:
      return "square";
  }
}

export function isDesignFormatId(value: string): value is DesignFormatId {
  return value in DESIGN_FORMATS;
}
