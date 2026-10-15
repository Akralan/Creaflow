"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { fontHeading, fontMono } from "@/lib/design/tokens";
import { accent, accentAlpha, accentText, bg, text, ink } from "@/components/landing/theme";
import styles from "@/components/landing/landing.module.css";

/**
 * Trois posts en éventail, comme des cartes à jouer, qui surgissent quand la section finale
 * arrive à l'écran : une photo (Instagram), un motion design en boucle (TikTok), un texte
 * (LinkedIn). Trois formats que CreaFlow produit — et de quoi habiller le haut de la section.
 * Photo : Lorem Picsum #180 (licence Unsplash), stockée dans public/landing/.
 */
export default function PostFan() {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`${styles.fan} ${shown ? styles.fanIn : ""}`} aria-hidden="true">
      {/* Carte 1 : photo */}
      <div className={`${styles.fanCard} ${styles.fanLeft}`}>
        <div className={styles.fanInner} style={{ background: "#1b1713" }}>
          <Image src="/landing/post-photo.jpg" alt="" fill sizes="(max-width: 640px) 140px, 220px" style={{ objectFit: "cover" }} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(to top, rgba(20,16,12,0.85) 0%, rgba(20,16,12,0.1) 55%, rgba(20,16,12,0) 100%)",
            }}
          />
          <span className={styles.fanBadge} style={{ background: "rgba(255,253,250,0.92)", color: text.body }}>
            Instagram · carrousel
          </span>
          <p className={styles.fanPhotoTitle} style={{ fontFamily: fontHeading }}>
            6 mois en freelance : ce que j&apos;aurais aimé savoir
          </p>
          <span className={styles.fanPhotoMeta} style={{ fontFamily: fontMono }}>1 / 7</span>
        </div>
      </div>

      {/* Carte 2 : motion design en boucle */}
      <div className={`${styles.fanCard} ${styles.fanCenter}`}>
        <div className={styles.fanInner} style={{ background: "linear-gradient(160deg, oklch(0.32 0.12 292) 0%, oklch(0.2 0.06 292) 100%)" }}>
          <span className={styles.fanBlob} />
          <span className={styles.fanBadge} style={{ background: "rgba(255,253,250,0.14)", color: "#fffdfa" }}>
            TikTok · 45 s
          </span>
          <div className={styles.fanMotionLines} style={{ fontFamily: fontHeading }}>
            <span className={styles.fanLine}>Le bug</span>
            <span className={styles.fanLine}>qui m&apos;a coûté</span>
            <span className={`${styles.fanLine} ${styles.fanLineAccent}`}>une nuit.</span>
          </div>
          <div className={styles.fanProgress}>
            <span className={styles.fanProgressBar} />
          </div>
          <span className={styles.fanMotionCounter} style={{ fontFamily: fontMono }}>0:03</span>
        </div>
      </div>

      {/* Carte 3 : texte seul */}
      <div className={`${styles.fanCard} ${styles.fanRight}`}>
        <div className={styles.fanInner} style={{ background: bg.card, border: `1px solid ${ink(0.08)}` }}>
          <div className={styles.fanTextHead}>
            <span style={{ width: 26, height: 26, borderRadius: "50%", background: `linear-gradient(135deg, ${accentAlpha(0.6)}, ${accent})`, flexShrink: 0 }} />
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: text.heading, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Alix · Fondateur</span>
              <span style={{ display: "block", fontSize: 9, color: text.faint, fontFamily: fontMono, whiteSpace: "nowrap" }}>LinkedIn · texte</span>
            </span>
          </div>
          <p className={styles.fanTextBody} style={{ fontFamily: fontHeading, color: text.heading }}>
            On a refusé 40 000 € la semaine dernière.
          </p>
          <p className={`${styles.fanTextBody} ${styles.hideOnPhone}`} style={{ color: text.secondary, fontWeight: 400 }}>
            Le client voulait du sur-mesure. Six mois pour un seul compte, pendant que 200 autres attendaient la
            v2. Voilà pourquoi on a dit non ↓
          </p>
          <div className={styles.fanTextFoot} style={{ color: accentText, fontFamily: fontMono }}>
            <span>♥ 128</span>
            <span>31 commentaires</span>
          </div>
        </div>
      </div>
    </div>
  );
}
