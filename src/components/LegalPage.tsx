import Link from "next/link";
import type { ReactNode } from "react";
import { color, fontBody, fontHeading } from "@/lib/design/tokens";
import BrandMark from "@/components/BrandMark";
import { heading1Style } from "@/components/ui/TextField";
import { isPublisherComplete } from "@/lib/legal/publisher";

const LEGAL_LINKS = [
  { href: "/legal/cgu", label: "Conditions Générales d'Utilisation et de Vente" },
  { href: "/legal/confidentialite", label: "Politique de confidentialité" },
  { href: "/legal/mentions-legales", label: "Mentions légales" },
];

/** Date de dernière mise à jour commune aux trois documents — ils ont été réécrits ensemble. */
export const LEGAL_UPDATED_AT = "16 octobre 2026";

/**
 * Layout partagé des 3 pages légales — typographie lisible, pas de mise en page marketing.
 *
 * La bannière « en cours de finalisation » n'est pas un texte à retirer à la main : elle s'affiche
 * tant que src/lib/legal/publisher.ts contient un placeholder, et disparaît d'elle-même ensuite
 * (docs/SPEC_LEGAL_EMAIL_RGPD.md §2.1). Les trois documents restent des rédactions internes, à
 * faire relire par un professionnel du droit avant l'ouverture commerciale — en particulier les
 * clauses de responsabilité, de rétractation et de droit applicable.
 */
export default function LegalPage({
  title,
  updatedAt = LEGAL_UPDATED_AT,
  children,
}: {
  title: string;
  updatedAt?: string;
  children: ReactNode;
}) {
  const complete = isPublisherComplete();
  return (
    <div style={{ background: color.pageBg, minHeight: "100vh", fontFamily: fontBody, color: color.text2 }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "56px 24px 80px" }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 10, fontFamily: fontHeading, fontWeight: 700, fontSize: 18, color: color.text, textDecoration: "none" }}>
          <BrandMark size={28} />
          CreaFlow
        </Link>

        <h1 style={{ ...heading1Style, marginTop: 28, marginBottom: 6 }}>{title}</h1>
        <p style={{ margin: "0 0 36px", fontSize: 13, color: color.textFaint }}>Dernière mise à jour : {updatedAt}</p>

        {!complete && (
          <p
            style={{
              margin: "0 0 28px",
              padding: "12px 16px",
              borderRadius: 10,
              background: "oklch(0.97 0.04 85)",
              border: "1px solid oklch(0.85 0.1 85)",
              fontSize: 14,
              color: color.text2,
            }}
          >
            <strong>Document en cours de finalisation.</strong> Les informations entre crochets seront
            complétées avant l&apos;ouverture commerciale du service.
          </p>
        )}

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
