"use client";

import OnboardingChat from "@/components/OnboardingChat";
import RepoPicker from "@/components/RepoPicker";
import SourcePicker from "@/components/SourcePicker";
import StepHeading from "@/components/onboarding/StepHeading";
import { connectionsStep } from "./shared";
import type { VerticalDefinition, VerticalId } from "./types";

/**
 * Parcours « source d'abord », commun à toutes les verticales nées d'un fournisseur d'identité
 * tiers. La personne a déjà répondu à « qui es-tu » en connectant son compte : ses sources viennent
 * en premier, et la discussion arrive ensuite, nourrie de ce qu'on y a lu (le contexte injecté au
 * prompt est construit par `services/connectedOnboardingContext`).
 *
 * Un seul parcours pour GitHub, Notion et Linear : les textes sont volontairement neutres. Le jour
 * où un métier mérite ses propres questions, c'est ici qu'on branchera une variante — sans toucher
 * à la page (docs/SPEC_CONNECTEURS_ET_SUJETS.md §7.2).
 */
export function sourceFirstVertical(id: VerticalId): VerticalDefinition {
  return {
    id,
    onboarding: [
      {
        id: "sources",
        label: "Sujets",
        // Le sélecteur confirme lui-même la connexion des sources.
        selfAdvancing: true,
        render: ({ advance, connectedProvider }) => (
          <div>
            <StepHeading title="Ce dont tu veux parler">
              Choisis ce dont tu veux parler. Chaque élément retenu devient un sujet, avec son contenu comme matière.
            </StepHeading>
            {/* GitHub garde son propre sélecteur : sa route porte la forme « dépôt », testée à part. */}
            {connectedProvider === "github" || !connectedProvider ? (
              <RepoPicker onConnected={advance} />
            ) : (
              <SourcePicker key={connectedProvider} provider={connectedProvider} onConnected={advance} />
            )}
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
              On a lu ce que tu as branché. Il reste juste à savoir sur quel ton tu veux écrire, pour qui, et combien de
              temps tu as par semaine.
            </StepHeading>
            <OnboardingChat onComplete={advance} />
          </div>
        ),
      },
      connectionsStep,
    ],
  };
}
