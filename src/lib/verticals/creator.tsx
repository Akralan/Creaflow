"use client";

import ProductCatalogue from "@/components/ProductCatalogue";
import CreatorIdentityStep from "@/components/onboarding/CreatorIdentityStep";
import StepHeading from "@/components/onboarding/StepHeading";
import { MIN_PRODUCTS } from "@/lib/validation";
import { connectionsStep } from "./shared";
import type { VerticalDefinition } from "./types";

/** Parcours par défaut : on ne sait rien de l'utilisateur, donc la discussion vient en premier et
 *  les sujets ensuite, une fois le métier compris. */
export const creatorVertical: VerticalDefinition = {
  id: "creator",
  onboarding: [
    {
      id: "identity",
      label: "Discussion",
      // La discussion se termine d'elle-même, et le formulaire de repli porte son propre bouton.
      selfAdvancing: true,
      render: ({ advance }) => <CreatorIdentityStep onDone={advance} />,
    },
    {
      id: "subjects",
      label: "Sujets",
      validate: ({ productCount }) =>
        productCount < MIN_PRODUCTS
          ? `Ajoutez au moins ${MIN_PRODUCTS} sujet${MIN_PRODUCTS > 1 ? "s" : ""} avant de continuer.`
          : null,
      render: ({ onProductCountChange }) => (
        <div>
          <StepHeading title="Vos sujets">
            Ce dont vous allez parler. Ajoutez-en au moins {MIN_PRODUCTS}, jusqu&apos;à 5.
          </StepHeading>
          <ProductCatalogue onCountChange={onProductCountChange} />
        </div>
      ),
    },
    connectionsStep,
  ],
};
