import { Fragment } from "react";
import { accent, bg, text } from "@/components/landing/theme";
import { fontHeading } from "@/lib/design/tokens";

const jobs = [
  "Bijoutières",
  "Ateliers de bougies",
  "Graveurs & personnalisation",
  "Marques de prêt-à-porter",
  "Décoration fait main",
  "Coachs & consultants",
  "Commerces de quartier",
];

/** Marquee 100% CSS (@keyframes cf-marquee dans globals.css) — pas de JS. */
export default function LandingMarquee() {
  return (
    <section
      data-screen-label="Métiers"
      style={{
        borderTop: "1px solid rgba(34,29,25,0.07)",
        borderBottom: "1px solid rgba(34,29,25,0.07)",
        background: bg.soft2,
        padding: "22px 0",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          width: "max-content",
          gap: 44,
          animation: "cf-marquee 38s linear infinite",
          alignItems: "center",
        }}
      >
        {[0, 1].map((group) => (
          <div
            key={group}
            style={{
              display: "flex",
              gap: 44,
              alignItems: "center",
              fontFamily: fontHeading,
              fontWeight: 500,
              fontSize: "clamp(0.95rem, 1.5vw, 1.15rem)",
              color: text.faint,
              letterSpacing: "-0.01em",
              whiteSpace: "nowrap",
            }}
          >
            {jobs.map((job) => (
              <Fragment key={job}>
                <span>{job}</span>
                <span style={{ color: accent }}>•</span>
              </Fragment>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
