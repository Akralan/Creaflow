import Link from "next/link";
import type { ReactNode } from "react";
import { color, fontBody, fontHeading } from "@/lib/design/tokens";
import { heading1Style } from "@/components/ui/TextField";

const LEGAL_LINKS = [
  { href: "/legal/cgu", label: "Conditions Générales d'Utilisation" },
  { href: "/legal/confidentialite", label: "Politique de confidentialité" },
  { href: "/legal/mentions-legales", label: "Mentions légales" },
];

/** Layout partagé des 3 pages légales — typographie lisible, pas de mise en page marketing. */
export default function LegalPage({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: string;
  children: ReactNode;
}) {
  return (
    <div style={{ background: color.pageBg, minHeight: "100vh", fontFamily: fontBody, color: color.text2 }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "56px 24px 80px" }}>
        <Link href="/" style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 18, color: color.text, textDecoration: "none" }}>
          CreaFlow
        </Link>

        <h1 style={{ ...heading1Style, marginTop: 28, marginBottom: 6 }}>{title}</h1>
        <p style={{ margin: "0 0 36px", fontSize: 13, color: color.textFaint }}>Dernière mise à jour : {updatedAt}</p>

        <div style={{ fontSize: 15, lineHeight: 1.7, color: color.text3 }}>{children}</div>

        <nav style={{ display: "flex", gap: 20, flexWrap: "wrap", marginTop: 56, paddingTop: 24, borderTop: `1px solid ${color.divider}` }}>
          {LEGAL_LINKS.map((l) => (
            <Link key={l.href} href={l.href} style={{ fontSize: 13, color: color.textMuted }}>
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}

export const sectionTitleStyle: React.CSSProperties = {
  fontFamily: fontHeading,
  fontWeight: 700,
  fontSize: 19,
  margin: "36px 0 12px",
  color: color.text,
};
