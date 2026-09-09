"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { TextField, TextAreaField } from "@/components/ui/TextField";
import EquipmentPicker from "@/components/EquipmentPicker";
import OnboardingChat from "@/components/OnboardingChat";
import StepHeading from "@/components/onboarding/StepHeading";
import { api, ApiClientError } from "@/lib/apiClient";
import { color } from "@/lib/design/tokens";

/**
 * Étape « identité » du parcours créateur : une discussion, avec un formulaire de repli.
 *
 * Le composant possède ses six champs et son enregistrement plutôt que de les remonter au contexte
 * d'onboarding — c'est ce qui permet à la page de ne rien savoir du vocabulaire créateur
 * (docs/ARCHITECTURE_VERTICALES.md §4, chantier 2). Conséquence : en mode formulaire, le bouton
 * « Continuer » est ici, pas dans le pied de page de la carte.
 */

const linkButtonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: color.textMuted,
  fontFamily: "inherit",
  fontSize: 13,
  cursor: "pointer",
  padding: 0,
  textDecoration: "underline",
};

export default function CreatorIdentityStep({ onDone }: { onDone: () => void }) {
  const [useFallbackForm, setUseFallbackForm] = useState(false);

  const [brandName, setBrandName] = useState("");
  const [activityType, setActivityType] = useState("");
  const [values, setValues] = useState("");
  const [tone, setTone] = useState("");
  const [equipment, setEquipment] = useState<string[]>([]);
  const [weeklyTimeAvailable, setWeeklyTimeAvailable] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function loadProfile() {
    const { profile } = await api.getProfile();
    if (!profile) return;
    setBrandName(profile.brandName);
    setActivityType(profile.activityType);
    setValues(profile.values || "");
    setTone(profile.tone || "");
    setEquipment(profile.equipment || []);
    setWeeklyTimeAvailable(profile.weeklyTimeAvailable || "");
  }

  useEffect(() => {
    (async () => {
      // Un profil illisible laisse simplement les champs vides — la discussion reste possible.
      await loadProfile().catch(() => {});
    })();
  }, []);

  async function handleChatComplete() {
    // Le profil, les catégories et les objectifs par plateforme sont déjà persistés côté serveur ;
    // on les relit seulement pour que le formulaire de repli soit à jour si l'utilisateur revient.
    await loadProfile().catch(() => {});
    onDone();
  }

  async function submitForm() {
    setError(null);
    if (!brandName.trim() || !activityType.trim()) {
      setError("Le nom de la marque et le type d'activité sont obligatoires.");
      return;
    }
    setSaving(true);
    try {
      await api.saveProfile({ brandName, activityType, tone, values, equipment, weeklyTimeAvailable });
      onDone();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erreur lors de l'enregistrement du profil.");
    } finally {
      setSaving(false);
    }
  }

  if (!useFallbackForm) {
    return (
      <div>
        <StepHeading title="Discutons de ton activité" marginBottom={20}>
          Quelques questions pour comprendre ton activité et te recommander les bons réseaux — pas de formulaire,
          juste une conversation.
        </StepHeading>
        <OnboardingChat onComplete={handleChatComplete} />
        <button onClick={() => setUseFallbackForm(true)} style={{ ...linkButtonStyle, marginTop: 14 }}>
          Remplir un formulaire à la place
        </button>
      </div>
    );
  }

  return (
    <div>
      <StepHeading title="Votre identité de marque" marginBottom={28}>
        Ces informations donnent le ton de tous vos scripts.
      </StepHeading>
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

      {error && <p style={{ color: color.danger, fontSize: 13, marginTop: 20 }}>{error}</p>}

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 24 }}>
        <Button onClick={submitForm} disabled={saving}>
          {saving ? "..." : "Continuer"}
        </Button>
        <button onClick={() => setUseFallbackForm(false)} style={linkButtonStyle}>
          ← Revenir à la discussion
        </button>
      </div>
    </div>
  );
}
