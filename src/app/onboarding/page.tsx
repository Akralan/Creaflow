"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { api, type Connection } from "@/lib/apiClient";
import { getVertical } from "@/lib/verticals/registry";
import type { OnboardingStep, OnboardingStepContext, VerticalId } from "@/lib/verticals/types";
import { accent, accentAlpha, color, fontHeading } from "@/lib/design/tokens";

/**
 * Coquille de l'onboarding : progression, onglets, navigation. Elle ne connaît AUCUNE verticale —
 * elle rend la liste d'étapes que la verticale de l'utilisateur déclare
 * (docs/ARCHITECTURE_VERTICALES.md §4, chantier 2).
 */

function StepTab({ n, step, label, onClick }: { n: number; step: number; label: string; onClick: () => void }) {
  const base: React.CSSProperties = {
    border: "none",
    fontFamily: "inherit",
    fontSize: 13,
    fontWeight: 600,
    padding: "8px 14px",
    borderRadius: 20,
    cursor: "pointer",
  };
  const style =
    n === step
      ? { ...base, background: accent, color: "#fff" }
      : n < step
        ? { ...base, background: accentAlpha(0.12), color: "oklch(0.48 0.2 292)" }
        : { ...base, background: color.chipBg, color: color.textFaint };
  return (
    <button onClick={onClick} style={style}>
      {`${n} · ${label}`}
    </button>
  );
}

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const [vertical, setVertical] = useState<VerticalId>("creator");
  const [productCount, setProductCount] = useState(0);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [stepError, setStepError] = useState<string | null>(null);

  const steps: OnboardingStep[] = useMemo(() => getVertical(vertical).onboarding, [vertical]);
  const current = steps[step - 1] ?? steps[0];
  const isLastStep = step >= steps.length;

  useEffect(() => {
    (async () => {
      const [{ vertical }, { connections }] = await Promise.all([api.getProfile(), api.getConnections()]);
      setVertical(vertical);
      setConnections(connections);
      // Retour d'un OAuth réseau social : on revient sur l'étape des connexions, la dernière quelle
      // que soit la verticale.
      if (searchParams.get("connected")) {
        setStep(getVertical(vertical).onboarding.length);
      }
      setLoaded(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function advance() {
    setStepError(null);
    if (isLastStep) {
      // Fin de la création de compte : on ouvre Direction, où l'utilisateur retrouve les séries
      // issues de l'onboarding, plutôt que le calendrier encore vide.
      router.push("/direction");
      return;
    }
    setStep((s) => s + 1);
  }

  const ctx: OnboardingStepContext = {
    advance,
    connections,
    productCount,
    onProductCountChange: setProductCount,
  };

  function goNext() {
    const error = current.validate?.(ctx) ?? null;
    setStepError(error);
    if (!error) advance();
  }

  function goPrev() {
    setStepError(null);
    setStep((s) => Math.max(1, s - 1));
  }

  if (!loaded) return null;

  return (
    <div style={{ height: "100vh", width: "100%", overflow: "auto", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          padding: "22px 40px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${color.border}`,
          background: color.cardBg,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 9,
              background: accent,
              color: "#fff",
              display: "grid",
              placeItems: "center",
              fontFamily: fontHeading,
              fontWeight: 700,
              fontSize: 17,
            }}
          >
            C
          </div>
          <span style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 18, letterSpacing: "-0.02em" }}>
            CreaFlow
          </span>
        </div>
      </div>

      <div style={{ maxWidth: 720, width: "100%", margin: "0 auto", padding: "40px 32px 64px" }}>
        <div
          style={{
            textAlign: "center",
            marginBottom: 8,
            color: "oklch(0.52 0.2 292)",
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          Configuration · Étape {step} sur {steps.length}
        </div>
        <div style={{ display: "flex", gap: 8, margin: "20px auto 8px", maxWidth: 520 }}>
          {steps.map((s, i) => (
            <div
              key={s.id}
              style={{ flex: 1, height: 5, borderRadius: 20, background: i + 1 <= step ? accent : color.border }}
            />
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 36, flexWrap: "wrap" }}>
          {steps.map((s, i) => (
            <StepTab key={s.id} n={i + 1} step={step} label={s.label} onClick={() => setStep(i + 1)} />
          ))}
        </div>

        <Card style={{ borderRadius: 22, padding: 36, boxShadow: "0 24px 48px -34px rgba(40,30,60,0.22)" }}>
          {current.render(ctx)}

          {stepError && <p style={{ color: color.danger, fontSize: 13, marginTop: 20 }}>{stepError}</p>}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 32,
              paddingTop: 24,
              borderTop: `1px solid ${color.dividerAlt}`,
            }}
          >
            <Button variant="secondary" onClick={goPrev} disabled={step === 1}>
              Précédent
            </Button>
            {/* Une étape auto-portée a déjà son déclencheur : un « Continuer » à côté ne ferait que
                proposer de la sauter. */}
            {!current.selfAdvancing && (
              <Button onClick={goNext}>{isLastStep ? "Terminer et ouvrir l'app" : "Continuer"}</Button>
            )}
          </div>
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
