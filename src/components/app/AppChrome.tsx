"use client";

import { createContext, useContext } from "react";
import AppIcon from "@/components/app/AppIcon";

/** What the screens of the app ask of the frame around them (menu, quota card, payment modal). */
export interface AppChrome {
  /** Opens the payment modal (docs/SPEC_APP_DESIGN_TELLOVO.md E12). */
  openPaywall: () => void;
  /** Reads the quota again (the card in the sidebar) after something was written. */
  refreshQuota: () => void;
  /** "Ready / total" counter next to « This week »; null hides it. */
  setWeekBadge: (badge: { ready: number; total: number } | null) => void;
  /** Name of the first project, shown on the workspace card and as « Founder · name » on the post. */
  productName: string;
  /** Name shown on the post author line. */
  authorName: string;
  /** Who the posts are written for (the profile's audience), for the screen subtitle. */
  audience: string;
}

const noop = () => undefined;

export const AppChromeContext = createContext<AppChrome>({
  openPaywall: noop,
  refreshQuota: noop,
  setWeekBadge: noop,
  productName: "",
  authorName: "You",
  audience: "",
});

export function useAppChrome(): AppChrome {
  return useContext(AppChromeContext);
}

const OFFER = [
  "A fresh content plan every week",
  "Plan up to a month ahead",
  "Unlimited AI edits in your voice",
  "Notion, Linear and notes as context",
  "Editorial memory across weeks",
];

/** « Your next week is waiting » — the offer of the tellovo.ai app. The button is wired to nothing yet (E12). */
export function PaywallModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="ov" role="dialog" aria-modal="true" aria-labelledby="ap-pay-title">
      <button className="scrim" type="button" aria-label="Close" onClick={onClose} />
      <div className="modal">
        <button className="xbtn" type="button" aria-label="Close" onClick={onClose}>
          <AppIcon name="x" />
        </button>
        <h2 id="ap-pay-title">
          Your next week is waiting. <span>Keep the stories coming.</span>
        </h2>
        <p className="mp">
          You&apos;ve seen what Tellovo can do with one week of your work. Keep shipping — we&apos;ll keep turning it into content your future customers want to read.
        </p>
        <div className="offer">
          <div className="offer-top">
            <b>Tellovo Founder</b>
            <span className="price">
              €19<span> / month</span>
            </span>
          </div>
          <ul className="feat">
            {OFFER.map((line) => (
              <li key={line}>
                <AppIcon name="check" />
                {line}
              </li>
            ))}
          </ul>
        </div>
        <div className="modal-acts">
          {/* Not wired to anything for now: nothing happens on click. */}
          <button className="btn btn-ink btn-lg btn-block" type="button">
            Unlock weekly plans <span className="arr">→</span>
          </button>
          <button className="btn btn-quiet btn-block" type="button" onClick={onClose}>
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
