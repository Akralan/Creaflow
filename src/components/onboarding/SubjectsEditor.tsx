"use client";

import { PROVIDER_ICONS } from "@/components/OAuthProviderButtons";
import type { OnboardingSubjectDraft } from "@/lib/apiClient";
import { color } from "@/lib/design/tokens";

export interface SubjectItem {
  label: string;
  /** "github" / "notion" / "linear" / "notes" — choisit l'icône. */
  provider: string;
}

const NEW_SUBJECT = "__nouveau__";

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: `1px solid ${color.inputBorder}`,
  borderRadius: 9,
  padding: "8px 10px",
  fontSize: 14,
  fontFamily: "inherit",
  background: color.inputBg,
  color: color.text,
};

/** Déplace une clé vers un autre sujet (ou un nouveau) et retire les sujets devenus vides. Pur,
 *  pour que l'écran ne puisse pas perdre une source en route. */
export function moveKey(
  subjects: OnboardingSubjectDraft[],
  key: string,
  target: number | "new",
  newName: string
): OnboardingSubjectDraft[] {
  const without = subjects.map((s) => ({ ...s, keys: s.keys.filter((k) => k !== key) }));
  const next =
    target === "new"
      ? [...without, { name: newName, description: "", keys: [key] }]
      : without.map((s, i) => (i === target ? { ...s, keys: [...s.keys, key] } : s));
  return next.filter((s) => s.keys.length > 0);
}

/**
 * Écran 4, « Tes sujets » (docs/SPEC_ONBOARDING_MVP.md §3 bis) : les projets détectés avec leurs
 * sources regroupées. On renomme, et on peut déplacer une source vers un autre sujet ou en faire un
 * sujet à part.
 */
export default function SubjectsEditor({
  subjects,
  items,
  onChange,
}: {
  subjects: OnboardingSubjectDraft[];
  items: Record<string, SubjectItem>;
  onChange: (subjects: OnboardingSubjectDraft[]) => void;
}) {
  function update(index: number, patch: Partial<OnboardingSubjectDraft>) {
    onChange(subjects.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {subjects.map((subject, index) => (
        <div key={index} style={{ border: `1px solid ${color.border}`, borderRadius: 14, padding: 14, display: "grid", gap: 8 }}>
          <input
            aria-label="Nom du sujet"
            value={subject.name}
            onChange={(e) => update(index, { name: e.target.value })}
            style={{ ...inputStyle, fontWeight: 600, fontSize: 15 }}
          />
          <input
            aria-label="Description du sujet"
            value={subject.description}
            placeholder="En une phrase, ce qu'est ce projet"
            onChange={(e) => update(index, { description: e.target.value })}
            style={inputStyle}
          />
          <div style={{ display: "grid", gap: 6, marginTop: 4 }}>
            {subject.keys.map((key) => {
              const item = items[key] ?? { label: key, provider: "notes" };
              return (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: color.textSecondary }}>
                  {PROVIDER_ICONS[item.provider] ?? <span aria-hidden>✎</span>}
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
                  <select
                    aria-label={`Déplacer ${item.label}`}
                    value={index}
                    onChange={(e) => {
                      const value = e.target.value;
                      onChange(moveKey(subjects, key, value === NEW_SUBJECT ? "new" : Number(value), item.label));
                    }}
                    style={{ ...inputStyle, width: "auto", padding: "4px 8px", fontSize: 12 }}
                  >
                    {subjects.map((s, i) => (
                      <option key={i} value={i}>
                        {i === index ? "Dans ce sujet" : `→ ${s.name || "Sans nom"}`}
                      </option>
                    ))}
                    <option value={NEW_SUBJECT}>→ Sujet à part</option>
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
