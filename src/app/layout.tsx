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

// Polices des maquettes de posts visuels (docs/SPEC_DESIGN_HTML_SUR_IMAGE.md §2 « Polices »,
// liste dans src/lib/visualDesign/fonts.ts). Chargées ici pour que le canevas ET l'export PNG
// (html-to-image, qui embarque les @font-face same-origin) voient les mêmes fichiers.
const designInter = Inter({ variable: "--font-design-inter", subsets: ["latin"] });
const designSpaceGrotesk = Space_Grotesk({ variable: "--font-design-space-grotesk", subsets: ["latin"] });
const designPlayfair = Playfair_Display({ variable: "--font-design-playfair", subsets: ["latin"], style: ["normal", "italic"] });
const designDmSerif = DM_Serif_Display({ variable: "--font-design-dm-serif", subsets: ["latin"], weight: "400" });
const designCaveat = Caveat({ variable: "--font-design-caveat", subsets: ["latin"] });
const designJetBrainsMono = JetBrains_Mono({ variable: "--font-design-jetbrains-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CreaFlow",
  description: "Directeur marketing virtuel pour créateurs et boutiques.",
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
    <html lang="fr" className={fontClasses}>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
