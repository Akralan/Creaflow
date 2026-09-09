"use client";

import OnboardingChat from "@/components/OnboardingChat";
import RepoPicker from "@/components/RepoPicker";
import StepHeading from "@/components/onboarding/StepHeading";
import { connectionsStep } from "./shared";
import type { VerticalDefinition } from "./types";

/** Le dev a déjà répondu à « qui es-tu » en connectant GitHub : ses projets viennent en premier, et
 *  la discussion arrive ensuite, nourrie de ce qu'on a lu dans les dépôts (le contexte injecté au
 *  prompt est construit par `services/devOnboardingContext`). */
export const devVertical: VerticalDefinition = {
  id: "dev",
  onboarding: [
    {
      id: "repos",
      label: "Projets",
      // Le picker confirme lui-même la connexion des dépôts.
      selfAdvancing: true,
      render: ({ advance }) => (
        <div>
          <StepHeading title="Tes projets">
            Choisis les dépôts dont tu veux parler. Chacun devient un sujet, et on récupère ses fichiers .md et son
            historique de commits comme matière.
          </StepHeading>
          <RepoPicker onConnected={advance} />
        </div>
      ),
    },
    {
      id: "chat",
      label: "Discussion",
      selfAdvancing: true,
      render: ({ advance }) => (
        <div>
          <StepHeading title="Deux ou trois questions" marginBottom={20}>
            On a lu tes projets. Il reste juste à savoir sur quel ton tu veux écrire, pour qui, et combien de temps tu
            as par semaine.
          </StepHeading>
          <OnboardingChat onComplete={advance} />
        </div>
      ),
    },
    connectionsStep,
  ],
};
