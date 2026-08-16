import { accent, bg, text, ink } from "@/components/landing/theme";
import { fontHeading, fontMono } from "@/lib/design/tokens";

const steps: Array<{ label: string; title: string; description: string }> = [
  {
    label: "ÉTAPE 01",
    title: "Vous racontez, on écoute",
    description:
      "Une conversation, pas un formulaire. Ce que vous fabriquez, pour qui, ce que vous n'avez pas envie de faire. CreaFlow en déduit votre identité de marque.",
  },
  {
    label: "ÉTAPE 02",
    title: "Votre direction éditoriale s'affiche",
    description:
      "Vos catégories de contenu, vos angles récurrents, vos séries à décliner — proposés, puis ajustés avec vous en deux clics.",
  },
  {
    label: "ÉTAPE 03",
    title: "Vous filmez, vous publiez",
    description:
      "Le calendrier se remplit au rythme que vous avez choisi. Chaque case contient un script prêt à filmer. Vous n'avez plus qu'à allumer la caméra.",
  },
];

export default function LandingHowItWorks() {
  return (
    <section data-screen-label="Comment ça marche" style={{ borderTop: "1px solid rgba(34,29,25,0.07)", background: bg.soft2 }}>
      <div
        style={{
          maxWidth: 1160,
          margin: "0 auto",
          padding: "clamp(56px, 8vw, 100px) clamp(18px, 5vw, 44px)",
          display: "grid",
          gap: "clamp(28px, 4vw, 64px)",
          gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))",
          alignItems: "start",
        }}
      >
        <div style={{ position: "sticky", top: 96 }}>
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
            Comment ça marche
          </p>
          <h2
            style={{
              margin: "0 0 16px",
              fontFamily: fontHeading,
              fontWeight: 600,
              fontSize: "clamp(1.8rem, 3.6vw, 2.7rem)",
              lineHeight: 1.08,
              letterSpacing: "-0.032em",
              color: text.heading,
              maxWidth: "18ch",
              textWrap: "balance",
            }}
          >
            Dix minutes au départ, puis ça roule.
          </h2>
          <p style={{ margin: 0, fontSize: "1.02rem", lineHeight: 1.6, color: text.secondary, maxWidth: "38ch", textWrap: "pretty" }}>
            Aucun réglage à comprendre, aucun tableau à remplir. Vous parlez de votre métier, CreaFlow s&apos;occupe
            du reste.
          </p>
        </div>
        <div style={{ display: "grid", gap: "clamp(14px, 2vw, 20px)" }}>
          {steps.map((step) => (
            <div
              key={step.label}
              data-step=""
              style={{
                background: bg.card,
                border: `1px solid ${ink(0.08)}`,
                borderRadius: 18,
                padding: "clamp(22px, 2.8vw, 30px)",
                transition: "opacity .5s ease, transform .5s cubic-bezier(.2,.75,.2,1), border-color .5s ease, box-shadow .5s ease",
              }}
            >
              <span style={{ fontFamily: fontMono, fontSize: 12, letterSpacing: "0.1em", color: accent }}>
                {step.label}
              </span>
              <h3
                style={{
                  margin: "9px 0 10px",
                  fontFamily: fontHeading,
                  fontWeight: 600,
                  fontSize: "clamp(1.2rem, 2vw, 1.5rem)",
                  lineHeight: 1.16,
                  letterSpacing: "-0.024em",
                  color: text.heading,
                }}
              >
                {step.title}
              </h3>
              <p style={{ margin: 0, fontSize: "0.99rem", lineHeight: 1.6, color: text.secondary, textWrap: "pretty" }}>
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
