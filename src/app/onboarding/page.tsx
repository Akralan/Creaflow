"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { TextAreaField, TextField } from "@/components/ui/TextField";
import Wordmark from "@/components/Wordmark";
import StepHeading from "@/components/onboarding/StepHeading";
import OnboardingWelcome from "@/components/onboarding/OnboardingWelcome";
import GenerationPanel from "@/components/GenerationPanel";
import OnboardingSources from "@/components/onboarding/OnboardingSources";
import SubjectsEditor, { type SubjectItem } from "@/components/onboarding/SubjectsEditor";
import PublishingDaysPicker from "@/components/PublishingDaysPicker";
import { api, ApiClientError, type OnboardingDraft, type OnboardingState, type OnboardingSubjectDraft } from "@/lib/apiClient";
import { publishingDaysLabel } from "@/lib/services/calendarService";
import { accent, accentAlpha, color, fontHeading } from "@/lib/design/tokens";
import { DEFAULT_PUBLISHING_DAYS, MAX_PRODUCTS } from "@/lib/validation";

/**
 * Onboarding MVP (docs/SPEC_ONBOARDING_MVP.md §2) : six écrans, un seul parcours. L'écran 1 est
 * aussi la page d'inscription — « Démarrer gratuitement » y mène, compte ou pas.
 */

type Step = "welcome" | "sources" | "reading" | "profile" | "expectations" | "days";
const STEPS: Step[] = ["welcome", "sources", "reading", "profile", "expectations", "days"];

/** Le nom est saisi avant que le compte existe : il traverse la redirection OAuth ici. */
const NAME_KEY = "creaflow.onboarding.name";

const PLATFORM_CHOICES = [
  { key: "linkedin", label: "LinkedIn" },
  { key: "x", label: "X" },
];

function readStoredName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

function storeName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // Navigation privée : le nom sera simplement redemandé, pré-rempli depuis le compte tiers.
  }
}

/** Essais automatiques de la lecture avant de rendre la main (bouton « Réessayer »). */
const MAX_READING_ATTEMPTS = 3;
const RETRY_DELAY_MS = 4000;

/**
 * Écran 3 : lecture de la matière par l'IA. Un échec n'est jamais muet : la raison s'affiche, la
 * lecture se relance seule jusqu'à MAX_READING_ATTEMPTS fois, puis la personne choisit entre
 * réessayer et remplir à la main (à partir des sujets de repli renvoyés par le serveur).
 */
function ReadingStep({
  providers,
  load,
  onSuccess,
  onManual,
  onBack,
}: {
  /** Sources feeding the scene: the connected accounts, plus "notes" when notes were added. */
  providers: string[];
  load: () => Promise<OnboardingDraft>;
  onSuccess: (draft: OnboardingDraft) => void;
  onManual: (fallback: OnboardingDraft | null) => void;
  onBack: () => void;
}) {
  const [attempt, setAttempt] = useState(1);
  const [failure, setFailure] = useState<string | null>(null);
  const [gaveUp, setGaveUp] = useState(false);
  const fallback = useRef<OnboardingDraft | null>(null);

  // Un essai par valeur de `attempt` — la garde évite le double appel quand React rejoue l'effet
  // en développement.
  const startedFor = useRef(0);
  useEffect(() => {
    if (startedFor.current === attempt) return;
    startedFor.current = attempt;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      let reason: string;
      try {
        const draft = await load();
        if (draft.extracted) return onSuccess(draft);
        fallback.current = draft;
        reason = draft.failureReason ?? "We couldn't read your material.";
      } catch (err) {
        reason = err instanceof ApiClientError ? err.message : "We couldn't read your material.";
      }
      setFailure(reason);
      if (attempt < MAX_READING_ATTEMPTS) {
        retryTimer = setTimeout(() => setAttempt((a) => a + 1), RETRY_DELAY_MS);
      } else {
        setGaveUp(true);
      }
    })();
    return () => clearTimeout(retryTimer);
  }, [attempt, load, onSuccess]);

  function retry() {
    setGaveUp(false);
    setFailure(null);
    startedFor.current = 0;
    setAttempt(1);
  }

  return (
    <div style={{ textAlign: "center", padding: gaveUp ? "36px 0 20px" : "8px 0 0" }}>
      {gaveUp ? (
        <h2 style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 22, margin: "0 0 10px" }}>Reading didn&apos;t work out</h2>
      ) : (
        <GenerationPanel title="Getting to know what you do" output={{ kind: "profile" }} providers={providers} />
      )}
      {failure && (
        <div
          role="alert"
          style={{ margin: "22px auto 0", maxWidth: 460, padding: "12px 14px", borderRadius: 12, background: "oklch(0.96 0.03 25)", color: color.danger, fontSize: 14, lineHeight: 1.5 }}
        >
          {failure}
          {!gaveUp && (
            <div style={{ color: color.textMuted, fontSize: 13, marginTop: 4 }}>
              Trying again in a few seconds ({attempt + 1}/{MAX_READING_ATTEMPTS})…
            </div>
          )}
        </div>
      )}
      {gaveUp && (
        <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 10, marginTop: 22 }}>
          <Button variant="secondary" onClick={onBack}>
            Back
          </Button>
          <Button variant="secondary" onClick={() => onManual(fallback.current)}>
            Fill in by hand
          </Button>
          <Button onClick={retry}>Try again</Button>
        </div>
      )}
    </div>
  );
}

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [state, setState] = useState<OnboardingState | null>(null);
  const [configuredProviderIds, setConfiguredProviderIds] = useState<string[]>([]);
  const [step, setStep] = useState<Step>("welcome");
  const [notesOpen, setNotesOpen] = useState(false);
  const [error, setError] = useState<string | null>(() => searchParams.get("oauthError"));
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [activityType, setActivityType] = useState("");
  // Audience globale extraite, plus montrée (le « Pour qui » est par sujet, docs/SPEC_PROMPT_GENERATION_V3.md
  // §2.1) mais enregistrée comme repli sur le profil.
  const [targetAudience, setTargetAudience] = useState("");
  const [subjects, setSubjects] = useState<OnboardingSubjectDraft[]>([]);
  const [extracted, setExtracted] = useState(true);
  const [expectations, setExpectations] = useState("");
  const [publishingDays, setPublishingDays] = useState<number[]>(DEFAULT_PUBLISHING_DAYS);
  const [platforms, setPlatforms] = useState<string[]>(["linkedin"]);

  const reload = useCallback(async () => {
    const next = await api.getOnboardingState();
    setState(next);
    return next;
  }, []);

  useEffect(() => {
    (async () => {
      const [next] = await Promise.all([
        reload(),
        api
          .getOAuthProviders()
          .then(({ providers }) => setConfiguredProviderIds(providers.map((p) => p.id)))
          .catch(() => {}),
      ]);
      if (next.signedIn && next.hasProfile) {
        router.replace("/calendar");
        return;
      }
      setName(readStoredName() || (next.signedIn ? next.suggestedName : ""));
      const hasMaterial = next.signedIn && (next.sources.length > 0 || next.notes.length > 0 || next.connectedProviders.length > 0);
      if (next.signedIn && (searchParams.get("step") === "sources" || hasMaterial)) setStep("sources");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signedIn = state?.signedIn ? state : null;

  const items: Record<string, SubjectItem> = useMemo(() => {
    const map: Record<string, SubjectItem> = {};
    for (const source of signedIn?.sources ?? []) {
      map[`source:${source.id}`] = { label: `${source.providerLabel} · ${source.label}`, provider: source.provider };
    }
    for (const note of signedIn?.notes ?? []) {
      map[`note:${note.id}`] = { label: `Notes · ${note.excerpt.slice(0, 40)}…`, provider: "notes" };
    }
    return map;
  }, [signedIn]);

  const readingProviders = useMemo(
    () => [...new Set([...(signedIn?.sources ?? []).map((s) => s.provider), ...((signedIn?.notes.length ?? 0) > 0 ? ["notes"] : [])])],
    [signedIn]
  );

  const loadDraft = useCallback(async () => (await api.draftOnboardingProfile(name)).draft, [name]);

  const applyDraft = useCallback((draft: OnboardingDraft | null) => {
    setActivityType(draft?.activityType ?? "");
    setTargetAudience(draft?.targetAudience ?? "");
    setSubjects(draft?.subjects ?? []);
    setExtracted(Boolean(draft?.extracted));
    setStep("profile");
  }, []);

  function goNext() {
    setError(null);
    if (step === "sources") {
      if (!signedIn || (signedIn.sources.length === 0 && signedIn.notes.length === 0)) {
        setError("Connect at least one source or paste your notes.");
        return;
      }
      storeName(name);
      setStep("reading");
      return;
    }
    if (step === "profile") {
      if (!name.trim()) return setError("Tell us your name.");
      if (!activityType.trim()) return setError("Describe what you do in one sentence.");
      if (subjects.length > MAX_PRODUCTS) return setError(`At most ${MAX_PRODUCTS} subjects: group the ones about the same project.`);
      if (subjects.some((s) => !s.name.trim())) return setError("Every subject needs a name.");
      setStep("expectations");
      return;
    }
    if (step === "expectations") setStep("days");
  }

  function goPrev() {
    setError(null);
    if (step === "sources") setStep("welcome");
    else if (step === "profile") setStep("sources");
    else if (step === "expectations") setStep("profile");
    else if (step === "days") setStep("expectations");
  }

  async function finish() {
    if (platforms.length === 0) return setError("Pick at least one network to publish on.");
    setError(null);
    setBusy(true);
    try {
      await api.completeOnboarding({
        name: name.trim(),
        activityType: activityType.trim(),
        targetAudience: targetAudience.trim() || undefined,
        expectations: expectations.trim() || undefined,
        publishingDays,
        platforms,
        subjects: subjects.map((s) => ({
          name: s.name.trim(),
          description: s.description.trim() || undefined,
          targetAudience: s.targetAudience.trim() || undefined,
          keys: s.keys,
        })),
      });
      try {
        localStorage.removeItem(NAME_KEY);
      } catch {}
      // La série de chaque projet et son calendrier sont posés par la fin d'onboarding (2026-10-26).
      router.push("/calendar");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't finish. Please try again.");
      setBusy(false);
    }
  }

  if (!state) return null;

  const stepIndex = STEPS.indexOf(step);
  const showFooter = step !== "welcome" && step !== "reading" && !busy;

  return (
    <div style={{ height: "100vh", width: "100%", overflow: "auto", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "22px 40px", display: "flex", alignItems: "center", gap: 10, borderBottom: `1px solid ${color.border}`, background: color.cardBg }}>
        <Wordmark size={26} />
      </div>

      <div style={{ maxWidth: 680, width: "100%", margin: "0 auto", padding: "36px 20px 64px" }}>
        <div style={{ display: "flex", gap: 6, margin: "0 auto 28px", maxWidth: 420 }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{ flex: 1, height: 5, borderRadius: 20, background: i <= stepIndex ? accent : color.border }} />
          ))}
        </div>

        <Card style={{ borderRadius: 22, padding: "32px clamp(20px, 5vw, 36px)", boxShadow: "0 24px 48px -34px rgba(40,30,60,0.22)" }}>
          {step === "welcome" && (
            <OnboardingWelcome
              signedIn={Boolean(signedIn)}
              connectedProviderIds={signedIn?.connectedProviders.map((p) => p.id) ?? []}
              name={name}
              onNameChange={(value) => {
                setName(value);
                storeName(value);
              }}
              onProceed={() => {
                storeName(name);
                setStep("sources");
              }}
              onNotesChosen={async () => {
                await reload();
                setNotesOpen(true);
                setStep("sources");
              }}
            />
          )}

          {step === "sources" && signedIn && (
            <OnboardingSources state={signedIn} configuredProviderIds={configuredProviderIds} notesOpenInitially={notesOpen} onChanged={reload} />
          )}

          {step === "reading" && (
            <ReadingStep providers={readingProviders} load={loadDraft} onSuccess={applyDraft} onManual={applyDraft} onBack={() => setStep("sources")} />
          )}

          {step === "profile" && (
            <div style={{ display: "grid", gap: 18 }}>
              <StepHeading title="What you do" marginBottom={0}>
                {extracted
                  ? "Here's what we understood from your material. Fix anything that's off."
                  : "We couldn't read your material automatically. Describe yourself in a few words."}
              </StepHeading>
              <TextField label="Your name" value={name} onChange={(e) => setName(e.target.value)} />
              <TextAreaField label="What you do" value={activityType} onChange={(e) => setActivityType(e.target.value)} style={{ minHeight: 80 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: color.textSecondary, marginBottom: 7 }}>Your subjects</div>
                <SubjectsEditor subjects={subjects} items={items} onChange={setSubjects} />
              </div>
            </div>
          )}

          {step === "expectations" && (
            <div>
              <StepHeading title="What do you expect from us?">
                Say it in your own words: what you want Tellovo to help you do. We&apos;ll use it for every post.
              </StepHeading>
              <TextAreaField
                value={expectations}
                onChange={(e) => setExpectations(e.target.value)}
                placeholder="I want to publish every week without spending my evenings on it, and have people follow my product being built all the way to launch."
                style={{ minHeight: 150 }}
              />
            </div>
          )}

          {step === "days" && busy && (
            <GenerationPanel title="Setting up your series" subtitle="Tellovo is saving your profile, then drawing your series." output={{ kind: "series" }} providers={readingProviders} />
          )}

          {step === "days" && !busy && (
            <div>
              <StepHeading title="Your publishing days">
                The days you can publish. We spread them across your series, and you can change each series&apos; days whenever you want.
              </StepHeading>
              <PublishingDaysPicker value={publishingDays} onChange={setPublishingDays} />
              <p style={{ fontSize: 14, color: color.textMuted, margin: "14px 0 26px" }}>
                Your series will publish on {publishingDaysLabel(publishingDays)}.
              </p>
              <div style={{ fontSize: 13, fontWeight: 600, color: color.textSecondary, marginBottom: 10 }}>Where you publish</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {PLATFORM_CHOICES.map((p) => {
                  const on = platforms.includes(p.key);
                  return (
                    <button
                      key={p.key}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setPlatforms((prev) => (on ? prev.filter((k) => k !== p.key) : [...prev, p.key]))}
                      style={{
                        padding: "9px 16px",
                        borderRadius: 20,
                        border: `1px solid ${on ? accent : color.border}`,
                        background: on ? accentAlpha(0.1) : color.cardBg,
                        color: on ? "oklch(0.45 0.2 292)" : color.textSecondary,
                        fontFamily: "inherit",
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {error && <p style={{ color: color.danger, fontSize: 13, marginTop: 20, marginBottom: 0 }}>{error}</p>}

          {showFooter && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 32, paddingTop: 24, borderTop: `1px solid ${color.dividerAlt}` }}>
              <Button variant="secondary" onClick={goPrev} disabled={busy}>
                Back
              </Button>
              {step === "days" ? (
                <Button onClick={finish} disabled={busy}>
                  {busy ? "Setting up your series…" : "Let's go"}
                </Button>
              ) : (
                <Button onClick={goNext}>Continue</Button>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingContent />
    </Suspense>
  );
}
