"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { fontHeading, fontMono } from "@/lib/design/tokens";
import { accent, accentAlpha, accentText, accentHover, bg, text, ink } from "@/components/landing/theme";
import { hoverHandlers } from "@/components/landing/hoverStyle";

const ctaStyle: CSSProperties = {
  position: "relative",
  overflow: "hidden",
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  padding: "16px 28px",
  borderRadius: 15,
  background: accent,
  color: "#fffdfa",
  fontSize: 16.5,
  fontWeight: 600,
  letterSpacing: "-0.01em",
  boxShadow: `0 14px 30px -14px ${accentAlpha(0.85)}`,
  transition: "transform .3s cubic-bezier(.2,.75,.2,1), box-shadow .3s ease, background .3s ease",
};
const ctaHover: CSSProperties = {
  background: accentHover,
  color: "#fffdfa",
  transform: "translateY(-2px)",
  boxShadow: `0 20px 38px -16px ${accentAlpha(0.95)}`,
};

const scheduleItemBase: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  background: bg.card,
  border: `1px solid ${ink(0.07)}`,
  borderRadius: 12,
  padding: "11px 13px",
  transition: "transform .3s ease",
};
const scheduleItemHighlighted: CSSProperties = {
  ...scheduleItemBase,
  border: `1px solid ${accentAlpha(0.32)}`,
  boxShadow: `0 10px 24px -20px ${accentAlpha(0.9)}`,
};
const scheduleItemHover: CSSProperties = { transform: "translateX(3px)" };

const mono = fontMono;

export default function LandingHero() {
  return (
    <section id="top" data-screen-label="Hero" style={{ position: "relative", overflow: "hidden" }}>
      <div
        data-parallax=""
        data-speed="0.12"
        style={{
          position: "absolute",
          top: "-14vw",
          left: "-8vw",
          width: "46vw",
          height: "46vw",
          borderRadius: "50%",
          background: "radial-gradient(circle at 50% 50%, oklch(0.62 0.19 292 / 0.28), transparent 68%)",
          filter: "blur(28px)",
          animation: "cf-float-a 17s ease-in-out infinite",
          pointerEvents: "none",
        }}
      />
      <div
        data-parallax=""
        data-speed="0.2"
        style={{
          position: "absolute",
          top: "6vw",
          right: "-14vw",
          width: "42vw",
          height: "42vw",
          borderRadius: "50%",
          background: "radial-gradient(circle at 50% 50%, oklch(0.72 0.13 62 / 0.3), transparent 66%)",
          filter: "blur(34px)",
          animation: "cf-float-b 21s ease-in-out infinite",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          maxWidth: 1160,
          margin: "0 auto",
          padding: "clamp(52px, 8vw, 104px) clamp(18px, 5vw, 44px) clamp(36px, 5vw, 64px)",
        }}
      >
        <div
          data-reveal=""
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 9,
            padding: "6px 14px 6px 10px",
            borderRadius: 999,
            background: "rgba(255,253,250,0.8)",
            border: `1px solid ${ink(0.09)}`,
            color: accentText,
            fontSize: 13.5,
            fontWeight: 500,
            marginBottom: "clamp(22px, 3vw, 30px)",
            boxShadow: `0 6px 18px -14px ${ink(0.5)}`,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: accent,
              animation: "cf-blink 2.6s ease-in-out infinite",
            }}
          />
          Votre directeur marketing virtuel
        </div>
        <h1
          style={{
            margin: 0,
            fontFamily: fontHeading,
            fontWeight: 700,
            fontSize: "clamp(2.6rem, 7.2vw, 5.1rem)",
            lineHeight: 0.98,
            letterSpacing: "-0.042em",
            maxWidth: "15ch",
            color: text.heading,
            textWrap: "balance",
          }}
        >
          <span style={{ display: "block", animation: "cf-rise .9s cubic-bezier(.2,.75,.2,1) both" }}>
            Ne manquez plus
          </span>
          <span style={{ display: "block", animation: "cf-rise .9s cubic-bezier(.2,.75,.2,1) .1s both" }}>
            jamais d&apos;idées
          </span>
          <span
            style={{
              display: "block",
              animation: "cf-rise .9s cubic-bezier(.2,.75,.2,1) .2s both",
              color: accent,
            }}
          >
            de contenu.
          </span>
        </h1>
        <p
          style={{
            margin: "clamp(20px, 2.6vw, 30px) 0 0",
            fontSize: "clamp(1.08rem, 1.75vw, 1.35rem)",
            lineHeight: 1.52,
            color: text.secondary,
            maxWidth: "50ch",
            textWrap: "pretty",
            animation: "cf-rise 1s cubic-bezier(.2,.75,.2,1) .3s both",
          }}
        >
          CreaFlow apprend à connaître votre marque en discutant avec vous, puis vous écrit chaque semaine des
          scripts prêts à filmer pour TikTok, Instagram et YouTube — sans jamais vous reproposer la même idée.
        </p>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 16,
            marginTop: "clamp(30px, 4vw, 42px)",
            animation: "cf-rise 1s cubic-bezier(.2,.75,.2,1) .42s both",
          }}
        >
          <Link href="/login?mode=signup" style={ctaStyle} {...hoverHandlers(ctaStyle, ctaHover)}>
            Démarrer gratuitement
            <span style={{ fontFamily: mono, fontSize: 15 }}>→</span>
          </Link>
          <span style={{ fontSize: 14.5, color: text.muted, lineHeight: 1.45, maxWidth: "24ch" }}>
            5 scripts offerts, à vie, sans carte bancaire.
          </span>
        </div>
      </div>

      <div
        data-reveal=""
        data-parallax=""
        data-speed="-0.05"
        style={{
          position: "relative",
          maxWidth: 1160,
          margin: "0 auto",
          padding: "0 clamp(18px, 5vw, 44px) clamp(52px, 7vw, 90px)",
        }}
      >
        <div
          style={{
            background: bg.card,
            border: `1px solid ${ink(0.08)}`,
            borderRadius: 22,
            padding: 12,
            boxShadow: `0 2px 4px ${ink(0.03)}, 0 40px 70px -44px ${ink(0.45)}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 9px 13px" }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: ink(0.13) }} />
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: ink(0.13) }} />
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: ink(0.13) }} />
            <span style={{ marginLeft: 8, fontFamily: mono, fontSize: 11, letterSpacing: "0.06em", color: text.fainter }}>
              creaflow — atelier de bougies
            </span>
          </div>
          <div
            style={{
              borderRadius: 15,
              background: "#faf7f2",
              border: `1px solid ${ink(0.06)}`,
              padding: "clamp(15px, 2.2vw, 26px)",
              display: "grid",
              gap: "clamp(15px, 2vw, 24px)",
              gridTemplateColumns: "repeat(auto-fit, minmax(262px, 1fr))",
              alignItems: "start",
            }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 10,
                  marginBottom: 13,
                }}
              >
                <span
                  style={{
                    fontFamily: fontHeading,
                    fontWeight: 600,
                    fontSize: 15,
                    color: text.heading,
                    letterSpacing: "-0.015em",
                  }}
                >
                  Cette semaine
                </span>
                <span style={{ fontFamily: mono, fontSize: 11, color: text.faint, letterSpacing: "0.06em" }}>
                  3 PRÉVUS
                </span>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                <div style={scheduleItemBase} {...hoverHandlers(scheduleItemBase, scheduleItemHover)}>
                  <span
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 9,
                      background: "repeating-linear-gradient(135deg, #efe9e0 0 6px, #e7e0d5 6px 12px)",
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ minWidth: 0 }}>
                    <span
                      style={{
                        display: "block",
                        fontSize: 13.5,
                        fontWeight: 600,
                        color: text.body,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      Coulisses : la cire qui refroidit
                    </span>
                    <span
                      style={{
                        display: "block",
                        marginTop: 3,
                        fontFamily: mono,
                        fontSize: 10.5,
                        color: text.faint,
                        letterSpacing: "0.06em",
                      }}
                    >
                      MAR · TIKTOK
                    </span>
                  </span>
                </div>
                <div style={scheduleItemBase} {...hoverHandlers(scheduleItemBase, scheduleItemHover)}>
                  <span
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 9,
                      background: "repeating-linear-gradient(135deg, #efe9e0 0 6px, #e7e0d5 6px 12px)",
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ minWidth: 0 }}>
                    <span
                      style={{
                        display: "block",
                        fontSize: 13.5,
                        fontWeight: 600,
                        color: text.body,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      3 erreurs quand on offre une bougie
                    </span>
                    <span
                      style={{
                        display: "block",
                        marginTop: 3,
                        fontFamily: mono,
                        fontSize: 10.5,
                        color: text.faint,
                        letterSpacing: "0.06em",
                      }}
                    >
                      JEU · INSTAGRAM
                    </span>
                  </span>
                </div>
                <div
                  style={scheduleItemHighlighted}
                  {...hoverHandlers(scheduleItemHighlighted, scheduleItemHover)}
                >
                  <span
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 9,
                      background: accentAlpha(0.13),
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ minWidth: 0 }}>
                    <span
                      style={{
                        display: "block",
                        fontSize: 13.5,
                        fontWeight: 600,
                        color: text.body,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      Ma collection d&apos;automne, plan par plan
                    </span>
                    <span
                      style={{
                        display: "block",
                        marginTop: 3,
                        fontFamily: mono,
                        fontSize: 10.5,
                        color: accentText,
                        letterSpacing: "0.06em",
                      }}
                    >
                      SAM · YOUTUBE · NOUVEAU
                    </span>
                  </span>
                </div>
              </div>
            </div>
            <div
              style={{
                background: bg.card,
                border: `1px solid ${ink(0.07)}`,
                borderRadius: 13,
                padding: "clamp(15px, 1.8vw, 21px)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 13 }}>
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    padding: "3px 9px",
                    borderRadius: 999,
                    background: accentAlpha(0.11),
                    color: accentText,
                  }}
                >
                  Angle inédit
                </span>
                <span style={{ fontFamily: mono, fontSize: 10.5, color: text.faint, letterSpacing: "0.06em" }}>
                  45 s
                </span>
              </div>
              <p
                style={{
                  margin: "0 0 4px",
                  fontFamily: mono,
                  fontSize: 10.5,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: text.faint,
                }}
              >
                Accroche
              </p>
              <p
                style={{
                  margin: "0 0 15px",
                  fontFamily: fontHeading,
                  fontWeight: 600,
                  fontSize: "clamp(1rem, 1.4vw, 1.14rem)",
                  lineHeight: 1.22,
                  letterSpacing: "-0.018em",
                  color: text.heading,
                }}
              >
                « Personne ne devine ce qu&apos;il y a dans cette bougie. »
              </p>
              <p
                style={{
                  margin: "0 0 7px",
                  fontFamily: mono,
                  fontSize: 10.5,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: text.faint,
                }}
              >
                Plan par plan
              </p>
              <div style={{ display: "grid", gap: 7, marginBottom: 15 }}>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45, color: text.secondary }}>
                  <span style={{ color: accent, fontWeight: 600 }}>1.</span> Gros plan sur la mèche qu&apos;on
                  allume.
                </p>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45, color: text.secondary }}>
                  <span style={{ color: accent, fontWeight: 600 }}>2.</span> Vos mains qui versent la cire, face
                  caméra.
                </p>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45, color: text.secondary }}>
                  <span style={{ color: accent, fontWeight: 600 }}>3.</span> Le produit fini sur l&apos;étagère de
                  l&apos;atelier.
                </p>
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  paddingTop: 13,
                  borderTop: `1px solid ${ink(0.07)}`,
                }}
              >
                <span style={{ fontFamily: mono, fontSize: 11, color: text.muted, background: bg.soft1, borderRadius: 6, padding: "4px 8px" }}>
                  #bougieartisanale
                </span>
                <span style={{ fontFamily: mono, fontSize: 11, color: text.muted, background: bg.soft1, borderRadius: 6, padding: "4px 8px" }}>
                  #faitmain
                </span>
                <span style={{ fontFamily: mono, fontSize: 11, color: text.muted, background: bg.soft1, borderRadius: 6, padding: "4px 8px" }}>
                  #atelier
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
