import { accent, fontHeading } from "@/lib/design/tokens";

/**
 * Tellovo logo: the name in lowercase followed by a dot in the accent color. No icon, no
 * square. `size` is the font size in px; the text color is inherited unless `color` is given.
 */
export default function Wordmark({ size = 24, color }: { size?: number; color?: string }) {
  return (
    <span
      aria-label="tellovo"
      style={{
        display: "inline-block",
        fontFamily: fontHeading,
        fontWeight: 700,
        fontSize: size,
        lineHeight: 1,
        letterSpacing: "-0.045em",
        color: color ?? "inherit",
      }}
    >
      tellovo<span style={{ color: accent }}>.</span>
    </span>
  );
}
