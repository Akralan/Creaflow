import type { SocialPlatform, SocialProvider } from "./types";
import { tiktokProvider } from "./tiktok";
import { instagramProvider } from "./instagram";
import { linkedinProvider } from "./linkedin";

export * from "./types";

export const socialProviders: Record<SocialPlatform, SocialProvider> = {
  tiktok: tiktokProvider,
  instagram: instagramProvider,
  linkedin: linkedinProvider,
};
