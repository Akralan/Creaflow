"use client";

import ConnectionRow from "@/components/ConnectionRow";
import StyleAnalysisPanel from "@/components/StyleAnalysisPanel";
import StepHeading from "@/components/onboarding/StepHeading";
import type { OnboardingStep } from "./types";

/** Étapes fournies par le cœur, qu'une verticale compose dans son parcours plutôt que de les
 *  réécrire. Connecter ses réseaux ne dépend d'aucun métier. */
export const connectionsStep: OnboardingStep = {
  id: "connections",
  label: "Réseaux",
  render: ({ connections }) => (
    <div>
      <StepHeading title="Connectez vos réseaux">
        L&apos;IA analyse votre style déjà en place. Étape facultative — vous pourrez la faire plus tard.
      </StepHeading>
      <div style={{ display: "grid", gap: 12 }}>
        {connections.map((c) => (
          <ConnectionRow key={c.platform} connection={c} returnTo="/onboarding" />
        ))}
      </div>

      <div style={{ marginTop: 20, display: "grid", gap: 16 }}>
        <StyleAnalysisPanel />
      </div>
    </div>
  ),
};
