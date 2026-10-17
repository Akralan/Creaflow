/**
 * Slide formats per platform (docs/SPEC_DESIGN_HTML_SUR_IMAGE.md §2 "Formats"). The author
 * can override the format at creation; the default follows the script's platform.
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
  square: { id: "square", label: "Square (1080×1080)", width: 1080, height: 1080 },
  story: { id: "story", label: "Vertical 9:16 (1080×1920)", width: 1080, height: 1920 },
  landscape: { id: "landscape", label: "Landscape 16:9 (1600×900)", width: 1600, height: 900 },
};

export function defaultFormatForPlatform(platform: string): DesignFormatId {
  switch (platform) {
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
