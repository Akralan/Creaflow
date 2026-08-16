import { fontMono } from "@/lib/design/tokens";
import { text } from "@/components/landing/theme";

/**
 * Correspond au prop `showSocialProofSlot` du design source (par défaut `false`, donc
 * invisible). Pas d'interrupteur dans l'UI — changer ce flag manuellement quand des
 * témoignages/logos clients seront disponibles après le lancement.
 */
const SHOW_SOCIAL_PROOF = false;

export default function LandingSocialProofSlot() {
  if (!SHOW_SOCIAL_PROOF) return null;

  return (
    <section
      data-screen-label="Preuve sociale (réservé)"
      style={{ maxWidth: 1160, margin: "0 auto", padding: "clamp(48px, 6vw, 76px) clamp(18px, 5vw, 44px) 0" }}
    >
      <div
        style={{
          border: "1.5px dashed rgba(34,29,25,0.2)",
          borderRadius: 20,
          padding: "clamp(32px, 5vw, 56px)",
          textAlign: "center",
          background: "rgba(255,253,250,0.5)",
        }}
      >
        <p
          style={{
            margin: "0 0 8px",
            fontFamily: fontMono,
            fontSize: 12,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: text.faint,
          }}
        >
          à remplir
        </p>
        <p style={{ margin: 0, fontSize: "1rem", color: text.muted, lineHeight: 1.55 }}>
          Emplacement réservé aux témoignages et logos clients, après le lancement.
        </p>
      </div>
    </section>
  );
}
