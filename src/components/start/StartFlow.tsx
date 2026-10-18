"use client";

import { useEffect, useReducer, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import "@/components/landing/tellovo/tellovo.css";
import "@/components/start/start.css";
import { CheckIcon, EditIcon, InfoIcon, RepoIcon } from "@/components/landing/tellovo/icons";
import { prefersReducedMotion } from "@/components/landing/tellovo/util";
import { api, ApiClientError, type StartAnalysis } from "@/lib/apiClient";

/**
 * Onboarding of the landing, wired to the real services (docs/SPEC_ENTREE_PAR_LE_REPO.md §2). The
 * markup, classes and texts are those of tellovo.ai/start; what changes is where the data comes from
 * (the repository, read by POST /api/start/analyze) and where it goes (POST /api/start, at the email).
 */

type Fields = { building: string; who: string; problem: string };
type FieldKey = keyof Fields;

const FIELDS: Array<{ field: FieldKey; id: string; label: string }> = [
  { field: "building", id: "tv-b1", label: "What you're building" },
  { field: "who", id: "tv-b2", label: "Who it's for" },
  { field: "problem", id: "tv-b3", label: "The problem you solve" },
];

const READ_LINES = ["Reading your README and docs", "Scanning recent commits and pull requests", "Understanding who it's for"];
const READ_STAGE_MS = [650, 1300, 1950];
const READ_MIN_MS = 2400;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** ISO days, Monday first. */
const WEEK = [
  { day: 1, label: "Mon" },
  { day: 2, label: "Tue" },
  { day: 3, label: "Wed" },
  { day: 4, label: "Thu" },
  { day: 5, label: "Fri" },
  { day: 6, label: "Sat" },
  { day: 7, label: "Sun" },
];
const DEFAULT_DAYS = [3, 5, 6];

type State = {
  phase: "reading" | "business" | "sent" | "failed";
  readStage: number;
  analysis: StartAnalysis | null;
  minElapsed: boolean;
  cta: "button" | "email";
  email: string;
  emailErr: "" | "empty" | "invalid";
  sendError: string;
  sending: boolean;
  biz: Fields;
  editingBiz: boolean;
  draft: Fields;
  days: number[];
  failure: string;
};

const EMPTY: Fields = { building: "", who: "", problem: "" };

const initial: State = {
  phase: "reading",
  readStage: 0,
  analysis: null,
  minElapsed: false,
  cta: "button",
  email: "",
  emailErr: "",
  sendError: "",
  sending: false,
  biz: EMPTY,
  editingBiz: false,
  draft: EMPTY,
  days: DEFAULT_DAYS,
  failure: "",
};

type Action =
  | { type: "readStage"; stage: number }
  | { type: "minElapsed" }
  | { type: "analysis"; analysis: StartAnalysis }
  | { type: "failed"; message: string }
  | { type: "editBiz" }
  | { type: "draft"; field: FieldKey; value: string }
  | { type: "cancelBiz" }
  | { type: "saveBiz" }
  | { type: "toggleDay"; day: number }
  | { type: "openEmail" }
  | { type: "email"; value: string }
  | { type: "emailError"; error: "empty" | "invalid" }
  | { type: "sending" }
  | { type: "sendFailed"; message: string }
  | { type: "sent"; email: string }
  | { type: "changeEmail" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "readStage":
      return action.stage > state.readStage ? { ...state, readStage: action.stage } : state;
    case "minElapsed":
      return { ...state, minElapsed: true };
    case "analysis": {
      const { building, who, problem } = action.analysis.card;
      const biz = { building, who, problem };
      return { ...state, analysis: action.analysis, biz, draft: biz };
    }
    case "failed":
      return { ...state, phase: "failed", failure: action.message };
    case "editBiz":
      return { ...state, editingBiz: true, draft: { ...state.biz } };
    case "draft":
      return { ...state, draft: { ...state.draft, [action.field]: action.value } };
    case "cancelBiz":
      return { ...state, editingBiz: false };
    case "saveBiz":
      return { ...state, editingBiz: false, biz: { ...state.draft } };
    case "toggleDay": {
      const has = state.days.includes(action.day);
      // Never fewer than one publishing day.
      if (has && state.days.length === 1) return state;
      const days = has ? state.days.filter((d) => d !== action.day) : [...state.days, action.day].sort((a, b) => a - b);
      return { ...state, days };
    }
    case "openEmail":
      return { ...state, cta: "email", emailErr: "", sendError: "" };
    case "email":
      return { ...state, email: action.value, emailErr: "", sendError: "" };
    case "emailError":
      return { ...state, emailErr: action.error };
    case "sending":
      return { ...state, sending: true, sendError: "" };
    case "sendFailed":
      return { ...state, sending: false, sendError: action.message };
    case "sent":
      return { ...state, sending: false, email: action.email, emailErr: "", sendError: "", phase: "sent" };
    case "changeEmail":
      return { ...state, phase: "business", cta: "email", emailErr: "", sendError: "" };
  }
}

function scrollTop() {
  try {
    window.scrollTo({ top: 0, behavior: "auto" });
  } catch {
    window.scrollTo(0, 0);
  }
}

const STEPS = ["Connect", "Understand", "Your week"];

function Wordmark() {
  return (
    <span className="wm">
      tellovo<i className="wm-dot"></i>
    </span>
  );
}

function Nav({ step, onBack }: { step: number; onBack: () => void }) {
  return (
    <header className="ob-nav">
      <button className="home-btn" type="button" aria-label="Tellovo — back to site" onClick={onBack}>
        <Wordmark />
      </button>
      <ol className="ob-steps" aria-label="Progress">
        {STEPS.map((label, i) => {
          const n = i + 1;
          return (
            <li key={label} className={n < step ? "done" : n === step ? "on" : undefined}>
              <span className="dot">{n}</span>
              <span className="lbl">{label}</span>
            </li>
          );
        })}
      </ol>
      <button className="tbtn mute" type="button" onClick={onBack}>
        Back to site
      </button>
    </header>
  );
}

function Reading({ repo, readStage }: { repo: string; readStage: number }) {
  return (
    <main className="ob-main">
      <div className="ob-col reading" aria-live="polite">
        <span className="repo-chip">
          <RepoIcon className="ico sm" aria-hidden="true" />
          {repo}
        </span>
        <h1 className="ob-h">Getting to know your product…</h1>
        <ul className="read-list">
          {READ_LINES.map((line, i) => (
            <li key={line} className={readStage > i ? "done" : readStage === i ? "active" : undefined}>
              <span className="pi">
                <CheckIcon className="ico" aria-hidden="true" />
              </span>
              {line}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}

function Failed({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <main className="ob-main">
      <div className="ob-col">
        <h1 className="ob-h">We couldn&apos;t read that repo.</h1>
        <p className="ob-p">{message}</p>
        <div className="sent-acts">
          <button className="btn btn-ink btn-lg" type="button" onClick={onBack}>
            Try another repo <span className="arr">→</span>
          </button>
        </div>
      </div>
    </main>
  );
}

function Business({ state, dispatch, onSend }: { state: State; dispatch: (a: Action) => void; onSend: () => void }) {
  const analysis = state.analysis!;
  const { card, repo } = analysis;
  const initials = (card.name || repo.name).replace(/[^A-Za-z0-9]/g, "").slice(0, 2);
  const { editingBiz: editing, draft, biz } = state;
  const emailMessage =
    state.sendError ||
    (state.emailErr === "invalid"
      ? "Enter a valid email address."
      : state.emailErr === "empty"
        ? "Enter your email to receive your first week."
        : state.cta === "email"
          ? "Where should we send your first week? The link inside signs you in."
          : "");
  const hasError = Boolean(state.sendError || state.emailErr);

  return (
    <main className="ob-main">
      <div className="ob-col">
        <h1 className="ob-h">Tellovo understands your business.</h1>
        <p className="ob-p">This is what your content will be built around.</p>
        {!analysis.extracted && (
          <p className="start-note">
            {analysis.failureReason ?? "We couldn't read this repo automatically."} Fill in the three fields below.
          </p>
        )}
        <article className="biz" aria-label="Your business">
          <div className="biz-top">
            <span className="repo-chip">
              <RepoIcon className="ico sm" aria-hidden="true" />
              {repo.fullName}
            </span>
          </div>
          <div className="biz-id">
            <span className="biz-logo" aria-hidden="true">
              {initials}
            </span>
            <div>
              <h2 className="biz-name">{card.name || repo.name}</h2>
              <p className="biz-tag">{card.tagline}</p>
            </div>
          </div>
          <dl className="biz-rows">
            {FIELDS.map(({ field, id, label }, i) => (
              <div className="biz-row" key={field}>
                <dt>
                  <label htmlFor={id}>{label}</label>
                </dt>
                <dd>
                  {editing ? (
                    <textarea id={id} rows={2} value={draft[field]} onChange={(e) => dispatch({ type: "draft", field, value: e.target.value })} autoFocus={i === 0} />
                  ) : (
                    biz[field]
                  )}
                </dd>
              </div>
            ))}
            <div className="biz-row">
              <dt>Publishing days</dt>
              <dd>
                <div className="days" role="group" aria-label="Publishing days">
                  {WEEK.map(({ day, label }) => (
                    <button key={day} type="button" className="day" aria-pressed={state.days.includes(day)} onClick={() => dispatch({ type: "toggleDay", day })}>
                      {label}
                    </button>
                  ))}
                </div>
                <p className="days-note">One post on each day you pick. You can change this later.</p>
              </dd>
            </div>
          </dl>
          <div className="biz-foot">
            {editing ? (
              <>
                <p>The more accurate this is, the better your stories.</p>
                <div className="acts">
                  <button className="btn btn-quiet btn-sm" type="button" onClick={() => dispatch({ type: "cancelBiz" })}>
                    Cancel
                  </button>
                  <button className="btn btn-ink btn-sm" type="button" onClick={() => dispatch({ type: "saveBiz" })}>
                    Save details
                  </button>
                </div>
              </>
            ) : (
              <>
                <button className="tbtn" type="button" onClick={() => dispatch({ type: "editBiz" })}>
                  <EditIcon className="ico" aria-hidden="true" />
                  Edit details
                </button>
                <p>Based on your repository. Review anything that looks off.</p>
              </>
            )}
          </div>
        </article>
        <div className="morph-wrap">
          <div className="morph">
            {state.cta === "button" ? (
              <button className="btn btn-ink morph-btn" type="button" onClick={() => dispatch({ type: "openEmail" })}>
                Generate my first week of content <span className="arr">→</span>
              </button>
            ) : (
              <div className={hasError ? "mform err" : "mform"}>
                <label className="sr" htmlFor="tv-email">
                  Your email
                </label>
                <input
                  id="tv-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={state.email}
                  onChange={(e) => dispatch({ type: "email", value: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      onSend();
                    }
                  }}
                  enterKeyHint="send"
                  autoFocus
                  aria-describedby="tv-email-msg"
                  aria-invalid={hasError}
                />
                <button className="btn btn-ink msend" type="button" onClick={onSend} disabled={state.sending} aria-label="Send my first week">
                  <span className="mlabel">{state.sending ? "Sending…" : "Send my first week"}</span>
                  <span className="arr">→</span>
                </button>
              </div>
            )}
          </div>
          <p id="tv-email-msg" className={`morph-msg${hasError ? " err" : state.cta === "email" ? " in" : ""}`} aria-live="polite">
            {emailMessage}
          </p>
        </div>
      </div>
    </main>
  );
}

function Sent({ email, name, who, onChangeEmail }: { email: string; name: string; who: string; onChangeEmail: () => void }) {
  return (
    <main className="ob-main">
      <div className="ob-col sent">
        <span className="sent-ic" aria-hidden="true">
          <CheckIcon className="ico" />
        </span>
        <h1 className="ob-h">Check your inbox.</h1>
        <p className="ob-p">
          Your first week of content is on its way to <b>{email}</b>.
        </p>
        <p className="ob-p">
          Open the email to read your first post. The link inside signs you in to Tellovo — no password needed. It can take a few minutes to arrive.
        </p>
        <div className="inbox" aria-hidden="true">
          <span className="from">
            <i></i>
          </span>
          <div className="inbox-txt">
            <p className="inbox-top">
              <b>Tellovo</b>
              <span>now</span>
            </p>
            <p className="inbox-sub">Your first week of content is ready</p>
            <p className="inbox-pre">
              {who ? `A first post for ${name}, written for ${who}…` : `A first post for ${name}, written from your repository…`}
            </p>
          </div>
        </div>
        <div className="sent-acts">
          <button className="tbtn mute" type="button" onClick={onChangeEmail}>
            Use a different email
          </button>
        </div>
        <p className="proto">
          <InfoIcon className="ico" aria-hidden="true" />
          Nothing arrived? Check your spam folder.
        </p>
      </div>
    </main>
  );
}

export default function StartFlow() {
  const router = useRouter();
  const repoParam = useSearchParams().get("repo") ?? "";
  const [state, dispatch] = useReducer(reducer, initial);
  const started = useRef(false);

  // No repository to read: back to the landing field.
  useEffect(() => {
    if (!repoParam.trim()) router.replace("/");
  }, [repoParam, router]);

  // Reading: the three lines animate while the server reads the repository. Two effects, because
  // StrictMode runs effects twice in dev: the timers restart cleanly, the (rate-limited) call must not.
  useEffect(() => {
    if (!repoParam.trim()) return;
    const k = prefersReducedMotion() ? 0.25 : 1;
    const timers = [
      ...READ_STAGE_MS.map((ms, i) => setTimeout(() => dispatch({ type: "readStage", stage: i + 1 }), ms * k)),
      setTimeout(() => dispatch({ type: "minElapsed" }), READ_MIN_MS * k),
    ];
    return () => timers.forEach(clearTimeout);
  }, [repoParam]);

  useEffect(() => {
    if (!repoParam.trim() || started.current) return;
    started.current = true;
    api
      .startAnalyze(repoParam)
      .then((analysis) => dispatch({ type: "analysis", analysis }))
      .catch((err) => dispatch({ type: "failed", message: err instanceof ApiClientError ? err.message : "Something went wrong. Please try again." }));
  }, [repoParam]);

  const ready = state.phase === "reading" && state.minElapsed && state.analysis !== null;
  useEffect(() => {
    if (ready) {
      dispatch({ type: "readStage", stage: READ_LINES.length });
      scrollTop();
    }
  }, [ready]);

  const phase: State["phase"] = ready ? "business" : state.phase;
  const back = () => router.push("/");

  async function send() {
    const email = state.email.trim();
    if (!EMAIL_RE.test(email)) {
      dispatch({ type: "emailError", error: email ? "invalid" : "empty" });
      return;
    }
    if (state.sending || !state.analysis) return;
    dispatch({ type: "sending" });
    const { card, repo } = state.analysis;
    try {
      await api.startCreate({
        repo: repo.fullName,
        name: card.name || repo.name,
        building: state.biz.building,
        who: state.biz.who,
        problem: state.biz.problem,
        days: state.days,
        email,
      });
      dispatch({ type: "sent", email });
      scrollTop();
    } catch (err) {
      dispatch({ type: "sendFailed", message: err instanceof ApiClientError ? err.message : "Something went wrong. Please try again." });
    }
  }

  const repoLabel = state.analysis?.repo.fullName ?? repoParam.replace(/^https?:\/\//i, "").replace(/^www\./i, "");

  return (
    <div className="ob">
      <Nav step={phase === "sent" ? 3 : 2} onBack={back} />
      {phase === "reading" && <Reading repo={repoLabel} readStage={state.readStage} />}
      {phase === "failed" && <Failed message={state.failure} onBack={back} />}
      {phase === "business" && state.analysis && <Business state={state} dispatch={dispatch} onSend={send} />}
      {phase === "sent" && state.analysis && (
        <Sent
          email={state.email}
          name={state.analysis.card.name || state.analysis.repo.name}
          who={state.biz.who}
          onChangeEmail={() => {
            dispatch({ type: "changeEmail" });
            scrollTop();
          }}
        />
      )}
    </div>
  );
}
