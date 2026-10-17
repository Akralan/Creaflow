"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { fontHeading, fontMono } from "@/lib/design/tokens";
import { accent, accentAlpha, accentText, bg, text, ink } from "@/components/landing/theme";
import styles from "@/components/landing/landing.module.css";

/**
 * Three posts fanned out like playing cards, which pop up when the final section
 * scrolls into view: a photo (Instagram), a looping motion design (TikTok), a text post
 * (LinkedIn). Three formats Tellovo produces — and something to dress up the top of the section.
 * Photo: Lorem Picsum #180 (Unsplash license), stored in public/landing/.
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
      {/* Card 1: photo */}
      <div className={`${styles.fanCard} ${styles.fanLeft}`}>
        <div className={styles.fanInner} style={{ background: "#1b1713" }}>
          <Image src="/landing/post-photo.jpg" alt="" fill sizes="(max-width: 640px) 180px, 320px" style={{ objectFit: "cover" }} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(to top, rgba(20,16,12,0.85) 0%, rgba(20,16,12,0.1) 55%, rgba(20,16,12,0) 100%)",
            }}
          />
          <span className={styles.fanBadge} style={{ background: "rgba(255,253,250,0.92)", color: text.body }}>
            Instagram · carousel
          </span>
          <p className={styles.fanPhotoTitle} style={{ fontFamily: fontHeading }}>
            6 months freelancing: what I wish I&apos;d known
          </p>
          <span className={styles.fanPhotoMeta} style={{ fontFamily: fontMono }}>1 / 7</span>
        </div>
      </div>

      {/* Card 2: looping motion design */}
      <div className={`${styles.fanCard} ${styles.fanCenter}`}>
        <div className={styles.fanInner} style={{ background: "linear-gradient(160deg, oklch(0.32 0.12 292) 0%, oklch(0.2 0.06 292) 100%)" }}>
          <span className={styles.fanBlob} />
          <span className={styles.fanBadge} style={{ background: "rgba(255,253,250,0.14)", color: "#fffdfa" }}>
            TikTok · 45 s
          </span>
          <div className={styles.fanMotionLines} style={{ fontFamily: fontHeading }}>
            <span className={styles.fanLine}>The bug</span>
            <span className={styles.fanLine}>that cost me</span>
            <span className={`${styles.fanLine} ${styles.fanLineAccent}`}>a night.</span>
          </div>
          <div className={styles.fanProgress}>
            <span className={styles.fanProgressBar} />
          </div>
          <span className={styles.fanMotionCounter} style={{ fontFamily: fontMono }}>0:03</span>
        </div>
      </div>

      {/* Card 3: text only */}
      <div className={`${styles.fanCard} ${styles.fanRight}`}>
        <div className={styles.fanInner} style={{ background: bg.card, border: `1px solid ${ink(0.08)}` }}>
          <div className={styles.fanTextHead}>
            <span style={{ width: "2.6em", height: "2.6em", borderRadius: "50%", background: `linear-gradient(135deg, ${accentAlpha(0.6)}, ${accent})`, flexShrink: 0 }} />
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: "1.05em", fontWeight: 700, color: text.heading, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Alix · Founder</span>
              <span style={{ display: "block", fontSize: "0.9em", color: text.faint, fontFamily: fontMono, whiteSpace: "nowrap" }}>LinkedIn · text</span>
            </span>
          </div>
          <p className={styles.fanTextBody} style={{ fontFamily: fontHeading, color: text.heading }}>
            We turned down $40,000 last week.
          </p>
          <p className={`${styles.fanTextBody} ${styles.hideOnPhone}`} style={{ color: text.secondary, fontWeight: 400 }}>
            The client wanted something custom. Six months for a single account, while 200 others waited for
            v2. Here&apos;s why we said no ↓
          </p>
          <div className={styles.fanTextFoot} style={{ color: accentText, fontFamily: fontMono }}>
            <span>♥ 128</span>
            <span>31 comments</span>
          </div>
        </div>
      </div>
    </div>
  );
}
