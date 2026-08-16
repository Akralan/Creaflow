import { fontHeading, fontMono } from "@/lib/design/tokens";
import { accent, accentAlpha, accentText, bg, text, ink } from "@/components/landing/theme";

const bars: Array<{ label: string; platform: string; width: number; color: string; delay: string }> = [
  { label: "Coulisses d'atelier", platform: "TikTok", width: 86, color: accent, delay: "" },
  { label: "Idées cadeaux", platform: "Instagram", width: 61, color: "oklch(0.62 0.16 292)", delay: " .12s" },
  { label: "Tutos longs", platform: "YouTube", width: 28, color: "oklch(0.72 0.11 292)", delay: " .24s" },
];

export default function LandingPerformance() {
  return (
    <section
      data-screen-label="Performance et contrôle"
      style={{ position: "relative", overflow: "hidden", borderTop: "1px solid rgba(34,29,25,0.07)", background: bg.soft3 }}
    >
      <div
        data-parallax=""
        data-speed="0.08"
        style={{
          position: "absolute",
          bottom: "-18vw",
          left: "30%",
          width: "40vw",
          height: "40vw",
          borderRadius: "50%",
          background: `radial-gradient(circle at 50% 50%, ${accentAlpha(0.22)}, transparent 66%)`,
          filter: "blur(30px)",
          animation: "cf-float-a 19s ease-in-out infinite",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "relative",
          maxWidth: 1160,
          margin: "0 auto",
          padding: "clamp(60px, 8vw, 108px) clamp(18px, 5vw, 44px)",
          display: "grid",
          gap: "clamp(26px, 4vw, 56px)",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          alignItems: "center",
        }}
      >
        <div data-reveal="">
          <p
            style={{
              margin: "0 0 12px",
              fontFamily: fontMono,
              fontSize: 12,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: text.faint,
            }}
          >
            Performance réelle
          </p>
          <h2
            style={{
              margin: "0 0 16px",
              fontFamily: fontHeading,
              fontWeight: 600,
              fontSize: "clamp(1.8rem, 3.6vw, 2.7rem)",
              lineHeight: 1.06,
              letterSpacing: "-0.032em",
              color: text.heading,
              maxWidth: "20ch",
              textWrap: "balance",
            }}
          >
            Ce qui marche vraiment guide la suite
          </h2>
          <p style={{ margin: "0 0 20px", fontSize: "1.03rem", lineHeight: 1.6, color: text.secondary, maxWidth: "44ch", textWrap: "pretty" }}>
            Vues, likes et partages sont récupérés automatiquement sur TikTok, YouTube et Instagram. CreaFlow repère
            ce qui fonctionne et vous propose de rééquilibrer votre ligne éditoriale.
          </p>
          <div
            style={{
              display: "inline-flex",
              alignItems: "flex-start",
              gap: 12,
              background: bg.card,
              border: `1px solid ${accentAlpha(0.28)}`,
              borderRadius: 15,
              padding: "15px 18px",
              maxWidth: "42ch",
            }}
          >
            <span style={{ width: 22, height: 22, borderRadius: 7, background: accentAlpha(0.13), flexShrink: 0, marginTop: 1 }} />
            <span>
              <span
                style={{
                  display: "block",
                  fontFamily: fontHeading,
                  fontWeight: 600,
                  fontSize: "1rem",
                  color: text.heading,
                  letterSpacing: "-0.015em",
                  marginBottom: 5,
                }}
              >
                Vous gardez le dernier mot
              </span>
              <span style={{ display: "block", fontSize: "0.95rem", lineHeight: 1.55, color: text.secondary }}>
                Chaque ajustement arrive comme une proposition. Rien n&apos;entre dans votre calendrier sans votre
                validation.
              </span>
            </span>
          </div>
        </div>
        <div
          data-reveal=""
          data-delay={120}
          style={{
            background: bg.card,
            border: `1px solid ${ink(0.08)}`,
            borderRadius: 20,
            padding: "clamp(20px, 2.6vw, 28px)",
            boxShadow: `0 2px 4px ${ink(0.03)}, 0 30px 56px -44px ${ink(0.5)}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
            <span style={{ fontFamily: fontHeading, fontWeight: 600, fontSize: 15.5, color: text.heading, letterSpacing: "-0.015em" }}>
              30 derniers jours
            </span>
            <span style={{ fontFamily: fontMono, fontSize: 11, color: text.faint, letterSpacing: "0.06em" }}>SYNCHRO AUTO</span>
          </div>
          <div style={{ display: "grid", gap: 16 }}>
            {bars.map((bar) => (
              <div key={bar.label}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: text.body }}>{bar.label}</span>
                  <span style={{ fontFamily: fontMono, fontSize: 11.5, color: accentText }}>{bar.platform}</span>
                </div>
                <div style={{ height: 9, borderRadius: 999, background: bg.track, overflow: "hidden" }}>
                  <div
                    data-bar=""
                    data-w={bar.width}
                    style={{
                      height: "100%",
                      width: "0%",
                      borderRadius: 999,
                      background: bar.color,
                      transition: `width 1.3s cubic-bezier(.2,.75,.2,1)${bar.delay}`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 22, paddingTop: 18, borderTop: `1px solid ${ink(0.07)}` }}>
            <p style={{ margin: "0 0 12px", fontSize: 13.8, lineHeight: 1.5, color: text.secondary }}>
              <span style={{ fontWeight: 600, color: text.body }}>Proposition :</span> passer de 1 à 2 coulisses par
              semaine, et alléger les tutos longs.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, padding: "8px 15px", borderRadius: 10, background: accent, color: "#fffdfa" }}>
                Valider
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, padding: "8px 15px", borderRadius: 10, border: `1px solid ${ink(0.16)}`, color: text.secondary }}>
                Plus tard
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
