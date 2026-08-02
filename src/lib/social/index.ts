import type { SocialProvider } from "./types";
import { tiktokProvider } from "./tiktok";
import { instagramProvider } from "./instagram";
import { linkedinProvider } from "./linkedin";

export * from "./types";

export const socialProviders: Partial<Record<string, SocialProvider>> = {
  tiktok: tiktokProvider,
  instagram: instagramProvider,
  linkedin: linkedinProvider,
};
