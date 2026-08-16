import { fontHeading, fontMono } from "@/lib/design/tokens";
import { accent, bg, text, ink } from "@/components/landing/theme";

const faqs: Array<{ question: string; answer: string }> = [
  {
    question: "Faut-il savoir parler à une IA ?",
    answer:
      "Non. Vous répondez à des questions simples sur votre métier, en français courant. C'est CreaFlow qui traduit tout ça en contenus.",
  },
  {
    question: "Est-ce que ça publie à ma place ?",
    answer:
      "Non. CreaFlow prépare le script, le plan de tournage et la légende. Vous filmez et vous publiez : le résultat reste 100 % vous.",
  },
  {
    question: "D'où viennent les statistiques ?",
    answer:
      "De vos comptes TikTok, YouTube et Instagram, reliés une fois pour toutes. CreaFlow y lit les vues, likes et partages de vos publications.",
  },
  {
    question: "Combien de temps avant mon premier script ?",
    answer: "Une dizaine de minutes de conversation, et votre première série de scripts est prête à filmer.",
  },
  {
    question: "Puis-je arrêter quand je veux ?",
    answer: "Oui, sans engagement ni frais. Et les 5 scripts de l'essai gratuit restent disponibles, à vie.",
  },
];

export default function LandingFaq() {
  return (
    <section data-screen-label="Questions" style={{ borderTop: "1px solid rgba(34,29,25,0.07)", background: bg.soft2 }}>
      <div
        style={{
          maxWidth: 1160,
          margin: "0 auto",
          padding: "clamp(56px, 8vw, 100px) clamp(18px, 5vw, 44px)",
          display: "grid",
          gap: "clamp(26px, 4vw, 60px)",
          gridTemplateColumns: "repeat(auto-fit, minmax(288px, 1fr))",
          alignItems: "start",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontFamily: fontHeading,
            fontWeight: 600,
            fontSize: "clamp(1.8rem, 3.6vw, 2.7rem)",
            lineHeight: 1.06,
            letterSpacing: "-0.032em",
            color: text.heading,
            maxWidth: "16ch",
            textWrap: "balance",
          }}
        >
          Les questions qu&apos;on nous pose
        </h2>
        <div style={{ display: "grid", gap: 10 }}>
          {faqs.map((faq) => (
            <details
              key={faq.question}
              style={{ background: bg.card, border: `1px solid ${ink(0.08)}`, borderRadius: 16, padding: "18px 20px" }}
            >
              <summary
                style={{
                  fontFamily: fontHeading,
                  fontWeight: 600,
                  fontSize: "1.03rem",
                  color: text.heading,
                  letterSpacing: "-0.015em",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 14,
                  alignItems: "center",
                }}
              >
                {faq.question}
                <span style={{ color: accent, fontFamily: fontMono }}>+</span>
              </summary>
              <p style={{ margin: "12px 0 0", fontSize: "0.97rem", lineHeight: 1.6, color: text.secondary, textWrap: "pretty" }}>
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
