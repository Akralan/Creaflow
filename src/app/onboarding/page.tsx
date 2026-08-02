"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { TextField, TextAreaField, heading2Style } from "@/components/ui/TextField";
import ProductCatalogue from "@/components/ProductCatalogue";
import ConnectionRow from "@/components/ConnectionRow";
import EquipmentPicker from "@/components/EquipmentPicker";
import StyleAnalysisPanel from "@/components/StyleAnalysisPanel";
import CategoryLabelsPanel from "@/components/CategoryLabelsPanel";
import OnboardingChat from "@/components/OnboardingChat";
import { api, ApiClientError, type Connection } from "@/lib/apiClient";
import { accent, accentAlpha, color, fontHeading } from "@/lib/design/tokens";

const MIN_PRODUCTS = 3;

function StepTab({ n, step, onClick }: { n: number; step: number; onClick: () => void }) {
  const labels = ["1 · Discussion", "2 · Catalogue", "3 · Réseaux"];
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
      {labels[n - 1]}
    </button>
  );
}

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const [useFallbackForm, setUseFallbackForm] = useState(false);

  const [brandName, setBrandName] = useState("");
  const [activityType, setActivityType] = useState("");
  const [values, setValues] = useState("");
  const [tone, setTone] = useState("");
  const [equipment, setEquipment] = useState<string[]>([]);
  const [weeklyTimeAvailable, setWeeklyTimeAvailable] = useState("");

  const [productCount, setProductCount] = useState(0);

  const [connections, setConnections] = useState<Connection[]>([]);

  const [stepError, setStepError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ profile }, { connections }] = await Promise.all([api.getProfile(), api.getConnections()]);
      if (profile) {
        setBrandName(profile.brandName);
        setActivityType(profile.activityType);
        setValues(profile.values || "");
        setTone(profile.tone || "");
        setEquipment(profile.equipment || []);
        setWeeklyTimeAvailable(profile.weeklyTimeAvailable || "");
      }
      setConnections(connections);
      if (searchParams.get("connected")) {
        setStep(3);
      }
      setLoaded(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function goNext() {
    setStepError(null);
    if (step === 1) {
      // Uniquement atteignable en mode formulaire de repli — la discussion avance via onComplete.
      if (!brandName.trim() || !activityType.trim()) {
        setStepError("Le nom de la marque et le type d'activité sont obligatoires.");
        return;
      }
      setSaving(true);
      try {
        await api.saveProfile({ brandName, activityType, tone, values, equipment, weeklyTimeAvailable });
        setStep(2);
      } catch (err) {
        setStepError(err instanceof ApiClientError ? err.message : "Erreur lors de l'enregistrement du profil.");
      } finally {
        setSaving(false);
      }
      return;
    }
    if (step === 2) {
      if (productCount < MIN_PRODUCTS) {
        setStepError(`Ajoutez au moins ${MIN_PRODUCTS} produits avant de continuer.`);
        return;
      }
      setStep(3);
      return;
    }
    router.push("/calendar");
  }

  function goPrev() {
    setStepError(null);
    setStep((s) => Math.max(1, s - 1));
  }

  async function handleChatComplete() {
    // Le profil, les catégories et les objectifs par plateforme sont déjà persistés côté serveur.
    const { profile } = await api.getProfile();
    if (profile) {
      setBrandName(profile.brandName);
      setActivityType(profile.activityType);
      setValues(profile.values || "");
      setTone(profile.tone || "");
      setEquipment(profile.equipment || []);
      setWeeklyTimeAvailable(profile.weeklyTimeAvailable || "");
    }
    setStep(2);
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
            S
          </div>
          <span style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 18, letterSpacing: "-0.02em" }}>
            SocialSkill
          </span>
        </div>
        <Button variant="ghost" onClick={() => router.push("/calendar")}>
          Passer la configuration →
        </Button>
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
          Configuration · Étape {step} sur 3
        </div>
        <div style={{ display: "flex", gap: 8, margin: "20px auto 8px", maxWidth: 520 }}>
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              style={{ flex: 1, height: 5, borderRadius: 20, background: n <= step ? accent : color.border }}
            />
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 36, flexWrap: "wrap" }}>
          {[1, 2, 3].map((n) => (
            <StepTab key={n} n={n} step={step} onClick={() => setStep(n)} />
          ))}
        </div>

        <Card style={{ borderRadius: 22, padding: 36, boxShadow: "0 24px 48px -34px rgba(40,30,60,0.22)" }}>
          {step === 1 && !useFallbackForm && (
            <div>
              <h2 style={heading2Style}>Discutons de ton activité</h2>
              <p style={{ margin: "0 0 20px", color: color.textMuted, fontSize: 15 }}>
                Quelques questions pour comprendre ton activité et te recommander les bons réseaux — pas de formulaire, juste une conversation.
              </p>
              <OnboardingChat onComplete={handleChatComplete} />
              <button
                onClick={() => setUseFallbackForm(true)}
                style={{
                  background: "none",
                  border: "none",
                  color: color.textMuted,
                  fontFamily: "inherit",
                  fontSize: 13,
                  cursor: "pointer",
                  marginTop: 14,
                  padding: 0,
                  textDecoration: "underline",
                }}
              >
                Remplir un formulaire à la place
              </button>
            </div>
          )}

          {step === 1 && useFallbackForm && (
            <div>
              <h2 style={heading2Style}>Votre identité de marque</h2>
              <p style={{ margin: "0 0 28px", color: color.textMuted, fontSize: 15 }}>
                Ces informations donnent le ton de tous vos scripts.
              </p>
              <div style={{ display: "grid", gap: 20, marginBottom: 28 }}>
                <TextField
                  label="Nom de la marque"
                  required
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="Atelier Lumen"
                />
                <TextField
                  label="Type d'activité"
                  required
                  value={activityType}
                  onChange={(e) => setActivityType(e.target.value)}
                  placeholder="Bijoux artisanaux en argent"
                />
                <TextAreaField
                  label="Valeurs de la marque"
                  optional
                  value={values}
                  onChange={(e) => setValues(e.target.value)}
                  placeholder="Fait main, matériaux nobles, démarche éthique et locale."
                />
                <TextField
                  label="Ton de communication"
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  placeholder="Esthétique / ASMR, chaleureux et posé"
                  helper="Décrivez librement — humoristique, éducatif, ASMR, institutionnel…"
                />
              </div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: color.textSecondary, marginBottom: 12 }}>
                Matériel disponible <span style={{ color: color.textFaint, fontWeight: 400 }}>— optionnel</span>
              </label>
              <div style={{ marginBottom: 28 }}>
                <EquipmentPicker value={equipment} onChange={setEquipment} />
              </div>
              <TextField
                label="Temps disponible par semaine"
                value={weeklyTimeAvailable}
                onChange={(e) => setWeeklyTimeAvailable(e.target.value)}
                placeholder="2h le week-end"
                style={{ maxWidth: 340 }}
              />
              <button
                onClick={() => setUseFallbackForm(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: color.textMuted,
                  fontFamily: "inherit",
                  fontSize: 13,
                  cursor: "pointer",
                  marginTop: 20,
                  padding: 0,
                  textDecoration: "underline",
                }}
              >
                ← Revenir à la discussion
              </button>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 style={heading2Style}>Vos produits phares</h2>
              <p style={{ margin: "0 0 24px", color: color.textMuted, fontSize: 15 }}>
                La matière première de vos scripts. Ajoutez-en {MIN_PRODUCTS} à 5.
              </p>
              <ProductCatalogue onCountChange={setProductCount} />
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 style={heading2Style}>Connectez vos réseaux</h2>
              <p style={{ margin: "0 0 24px", color: color.textMuted, fontSize: 15 }}>
                L&apos;IA analyse votre style déjà en place. Étape facultative — vous pourrez la faire plus tard.
              </p>
              <div style={{ display: "grid", gap: 12 }}>
                {connections.map((c) => (
                  <ConnectionRow key={c.platform} connection={c} returnTo="/onboarding" />
                ))}
              </div>

              <div style={{ marginTop: 20, display: "grid", gap: 16 }}>
                <CategoryLabelsPanel />
                <StyleAnalysisPanel />
              </div>
            </div>
          )}

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
            {(step !== 1 || useFallbackForm) && (
              <Button onClick={goNext} disabled={saving}>
                {saving ? "..." : step >= 3 ? "Terminer et ouvrir l'app" : "Continuer"}
              </Button>
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
