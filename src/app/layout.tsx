import type { Metadata } from "next";
import {
  Bricolage_Grotesque,
  Caveat,
  DM_Serif_Display,
  Instrument_Sans,
  Inter,
  JetBrains_Mono,
  Playfair_Display,
  Space_Grotesk,
} from "next/font/google";
import "./globals.css";
import { getSiteUrl, isIndexable, NO_INDEX, SITE_DESCRIPTION, SITE_NAME, SITE_TITLE } from "@/lib/seo";

const bricolageGrotesque = Bricolage_Grotesque({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const instrumentSans = Instrument_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

// Fonts for the visual post mockups (docs/SPEC_DESIGN_HTML_SUR_IMAGE.md §2 "Polices",
// list in src/lib/visualDesign/fonts.ts). Loaded here so that the canvas AND the PNG export
// (html-to-image, which embeds same-origin @font-face) see the same files.
const designInter = Inter({ variable: "--font-design-inter", subsets: ["latin"] });
const designSpaceGrotesk = Space_Grotesk({ variable: "--font-design-space-grotesk", subsets: ["latin"] });
const designPlayfair = Playfair_Display({ variable: "--font-design-playfair", subsets: ["latin"], style: ["normal", "italic"] });
const designDmSerif = DM_Serif_Display({ variable: "--font-design-dm-serif", subsets: ["latin"], weight: "400" });
const designCaveat = Caveat({ variable: "--font-design-caveat", subsets: ["latin"] });
const designJetBrainsMono = JetBrains_Mono({ variable: "--font-design-jetbrains-mono", subsets: ["latin"] });

// Shared metadata (docs/SPEC_SEO.md §2). `metadataBase` makes the relative URLs of child
// segments absolute (canonical, Open Graph image). Pages that must not be indexed say so
// themselves via NO_INDEX; here we only block everything if the whole deployment is not
// indexable (demo host, local). The Open Graph image comes from src/app/opengraph-image.tsx, which
// Next wires up on its own; twitter:* tags inherit from og:* tags when not defined
// separately.
export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: { default: SITE_TITLE, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: "/",
  },
  twitter: { card: "summary_large_image" },
  ...(isIndexable() ? {} : { robots: NO_INDEX }),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const fontClasses = [
    bricolageGrotesque.variable,
    instrumentSans.variable,
    jetBrainsMono.variable,
    designInter.variable,
    designSpaceGrotesk.variable,
    designPlayfair.variable,
    designDmSerif.variable,
    designCaveat.variable,
    designJetBrainsMono.variable,
  ].join(" ");
  return (
    <html lang="en" className={fontClasses}>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
