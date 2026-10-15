"use client";

import { useId } from "react";

/**
 * Icône de marque CreaFlow : un carré arrondi en dégradé accent, un « C » tracé en arc et un
 * point qui s'en échappe — le flux de contenu qui sort de la conversation. Le dégradé a un id
 * unique par instance (useId) pour pouvoir afficher la marque plusieurs fois sur une page.
 */
export default function BrandMark({ size = 28 }: { size?: number }) {
  const gradientId = useId();
  const glowId = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" style={{ display: "block", flexShrink: 0 }}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="oklch(0.66 0.19 292)" />
          <stop offset="1" stopColor="oklch(0.47 0.21 292)" />
        </linearGradient>
        <radialGradient id={glowId} cx="0.3" cy="0.2" r="0.8">
          <stop offset="0" stopColor="rgba(255,255,255,0.32)" />
          <stop offset="1" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
      </defs>
      <rect width="32" height="32" rx="9.5" fill={`url(#${gradientId})`} />
      <rect width="32" height="32" rx="9.5" fill={`url(#${glowId})`} />
      <rect x="0.75" y="0.75" width="30.5" height="30.5" rx="8.9" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" />
      <path d="M21.1 10.55 A7.5 7.5 0 1 0 21.1 21.45" fill="none" stroke="#fffdfa" strokeWidth="3" strokeLinecap="round" />
      <circle cx="22.9" cy="16" r="2.35" fill="#fffdfa" />
    </svg>
  );
}
