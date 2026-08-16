import { fontHeading } from "@/lib/design/tokens";
import { bg, text, ink } from "@/components/landing/theme";

const problems: Array<{ title: string; description: string; delay: number }> = [
  {
    title: "La page blanche",
    description: "Vous savez qu'il faut publier. Devant l'écran, plus une seule idée qui vous ressemble.",
    delay: 0,
  },
  {
    title: "Un tournage, un seul post",
    description: "Deux heures de photos finissent en une publication, alors qu'il y avait dix contenus dedans.",
    delay: 90,
  },
  {
    title: "L'IA qu'il faut savoir briefer",
    description: "Demander de l'aide à une IA généraliste suppose de savoir exactement quoi lui demander.",
    delay: 180,
  },
  {
    title: "Toujours la même idée",
    description: "Sans mémoire de ce qui est déjà publié, on tourne en rond sur les trois mêmes formats.",
    delay: 270,
  },
];

export default function LandingProblem() {
  return (
    <section
      data-screen-label="Problème"
      style={{ maxWidth: 1160, margin: "0 auto", padding: "clamp(64px, 9vw, 120px) clamp(18px, 5vw, 44px)" }}
    >
      <h2
        data-reveal=""
        style={{
          margin: "0 0 clamp(34px, 5vw, 56px)",
          fontFamily: fontHeading,
          fontWeight: 600,
          fontSize: "clamp(1.9rem, 4.4vw, 3.3rem)",
          lineHeight: 1.06,
          letterSpacing: "-0.035em",
          color: text.heading,
          maxWidth: "26ch",
          textWrap: "balance",
        }}
      >
        Vous créez toute la journée. Le marketing, lui, attend toujours le dimanche soir.
      </h2>
      <div
        style={{
          display: "grid",
          gap: "clamp(14px, 2vw, 22px)",
          gridTemplateColumns: "repeat(auto-fit, minmax(252px, 1fr))",
        }}
      >
        {problems.map((p) => (
          <div
            key={p.title}
            data-reveal=""
            data-delay={p.delay}
            style={{
              background: bg.card,
              border: `1px solid ${ink(0.08)}`,
              borderRadius: 18,
              padding: "clamp(22px, 2.6vw, 28px)",
            }}
          >
            <p
              style={{
                margin: "0 0 9px",
                fontFamily: fontHeading,
                fontWeight: 600,
                fontSize: "1.12rem",
                color: text.heading,
                letterSpacing: "-0.02em",
              }}
            >
              {p.title}
            </p>
            <p style={{ margin: 0, fontSize: "0.97rem", lineHeight: 1.6, color: text.secondary, textWrap: "pretty" }}>
              {p.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
