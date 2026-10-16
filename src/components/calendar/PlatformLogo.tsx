import { PlatformBadge } from "@/components/ui/Badge";

/** Logos des réseaux où l'on publie, dessinés à la main (pas de dépendance d'icônes pour trois
 *  marques). Les autres plateformes (newsletter, blog…) gardent leur pastille. */
export default function PlatformLogo({ platform, size = 16 }: { platform: string; size?: number }) {
  if (platform === "linkedin") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-label="LinkedIn" role="img">
        <rect width="24" height="24" rx="4" fill="#0A66C2" />
        <path
          fill="#fff"
          d="M7.1 9.6H4.6v8.7h2.5V9.6Zm-1.25-4a1.45 1.45 0 1 0 0 2.9 1.45 1.45 0 0 0 0-2.9Zm12.85 7.3c0-2.35-.5-3.5-2.9-3.5-1.15 0-1.95.6-2.3 1.2h-.05v-1h-2.4v8.7h2.5v-4.3c0-1.13.21-2.2 1.6-2.2 1.38 0 1.4 1.28 1.4 2.27v4.23h2.5l-.35-5.4Z"
        />
      </svg>
    );
  }
  if (platform === "x") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-label="X" role="img">
        <rect width="24" height="24" rx="4" fill="#111" />
        <path fill="#fff" d="M15.9 5.5h2.2l-4.8 5.5 5.6 7.5h-4.4l-3.5-4.5-4 4.5H4.8l5.1-5.9L4.5 5.5h4.5l3.1 4.1 3.8-4.1Zm-.8 11.7h1.2L8.4 6.7H7.1l8 10.5Z" />
      </svg>
    );
  }
  if (platform === "instagram") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-label="Instagram" role="img">
        <defs>
          <linearGradient id="cf-ig" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#F58529" />
            <stop offset="0.5" stopColor="#DD2A7B" />
            <stop offset="1" stopColor="#8134AF" />
          </linearGradient>
        </defs>
        <rect width="24" height="24" rx="6" fill="url(#cf-ig)" />
        <rect x="5.5" y="5.5" width="13" height="13" rx="4" fill="none" stroke="#fff" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="3.1" fill="none" stroke="#fff" strokeWidth="1.8" />
        <circle cx="16.1" cy="7.9" r="1" fill="#fff" />
      </svg>
    );
  }
  return <PlatformBadge platform={platform} size={size} />;
}
