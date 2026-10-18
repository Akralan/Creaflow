"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import "@/components/landing/tellovo/tellovo.css";
import "@/components/start/start.css";
import { CheckIcon } from "@/components/landing/tellovo/icons";
import { api, ApiClientError } from "@/lib/apiClient";

/**
 * Landing page of the sign-in link received by email (docs/SPEC_ENTREE_PAR_LE_REPO.md §6). The token is
 * spent by a POST sent when the page opens — never by the GET — so a mail scanner that only fetches
 * the link leaves it intact.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function LoginLink() {
  const router = useRouter();
  const token = useSearchParams().get("token");
  const sentOnce = useRef(false);
  const [error, setError] = useState<string | null>(token ? null : "This link is incomplete.");
  const [email, setEmail] = useState("");
  const [resent, setResent] = useState(false);
  const [resendError, setResendError] = useState("");

  useEffect(() => {
    if (!token || sentOnce.current) return;
    sentOnce.current = true;
    api
      .consumeLoginLink(token)
      .then((r) => {
        // « You're in » : la bannière de bienvenue de l'écran de la semaine, une seule fois.
        try {
          sessionStorage.setItem("cf.welcome", "1");
        } catch {
          // Sans stockage la bannière manque, sans conséquence.
        }
        router.replace(r.redirect);
      })
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Something went wrong. Ask for a new link."));
  }, [token, router]);

  async function resend() {
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setResendError("Enter a valid email address.");
      return;
    }
    setResendError("");
    try {
      await api.startResend(value);
      setResent(true);
    } catch (err) {
      setResendError(err instanceof ApiClientError ? err.message : "Something went wrong.");
    }
  }

  return (
    <div className="ob">
      <header className="ob-nav">
        <Link className="home-btn" href="/" aria-label="Tellovo — back to site">
          <span className="wm">
            tellovo<i className="wm-dot"></i>
          </span>
        </Link>
      </header>
      <main className="ob-main">
        <div className="ob-col sent">
          {error ? (
            <>
              <h1 className="ob-h">This link doesn&apos;t work anymore.</h1>
              <p className="ob-p">{error}</p>
              {resent ? (
                <p className="ob-p">
                  <CheckIcon className="ico" aria-hidden="true" /> If an account exists for this address, a new link is on its way.
                </p>
              ) : (
                <div className="resend">
                  <div className={resendError ? "mform err" : "mform"}>
                    <label className="sr" htmlFor="tv-resend-email">
                      Your email
                    </label>
                    <input
                      id="tv-resend-email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void resend();
                        }
                      }}
                    />
                    <button className="btn btn-ink msend" type="button" onClick={() => void resend()}>
                      <span className="mlabel">Send me a new link</span>
                      <span className="arr">→</span>
                    </button>
                  </div>
                  {resendError && <p className="start-error">{resendError}</p>}
                </div>
              )}
            </>
          ) : (
            <>
              <h1 className="ob-h">Signing you in…</h1>
              <p className="ob-p">Opening your week.</p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
