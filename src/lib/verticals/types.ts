import type { ReactNode } from "react";
import type { Connection } from "@/lib/apiClient";

/** Miroir de `users.vertical` (docs/ARCHITECTURE_VERTICALES.md).
 *
 *  "dev", "artisan" et "entrepreneur" mènent aujourd'hui au MÊME parcours — celui d'un compte né
 *  d'un fournisseur d'identité tiers. Les trois valeurs existent pour que le nom ne mente pas et
 *  qu'on puisse les différencier plus tard sans migration
 *  (docs/SPEC_CONNECTEURS_ET_SUJETS.md §7.2). */
export type VerticalId = "creator" | "dev" | "artisan" | "entrepreneur";

/**
 * État partagé de l'onboarding, passé à chaque étape.
 *
 * Délibérément minuscule : tout état propre à une étape vit dans SON composant. Un champ ajouté ici
 * pour une seule verticale est le signe qu'il fallait le descendre dans l'étape.
 */
export interface OnboardingStepContext {
  /** Passe à l'étape suivante, ou termine l'onboarding si c'était la dernière. */
  advance: () => void;
  /** Fournisseur avec lequel le compte a été créé — c'est LUI qui choisit le sélecteur de sources,
   *  pas la verticale : "dev" couvre GitHub comme Linear. Null pour un compte email/mot de passe. */
  connectedProvider: string | null;
  connections: Connection[];
  productCount: number;
  onProductCountChange: (count: number) => void;
}

export interface OnboardingStep {
  id: string;
  /** Libellé de l'onglet, sans numéro — c'est la page qui numérote. */
  label: string;
  /** L'étape porte son propre déclencheur d'avancement (un chat qui se termine, un picker qui
   *  confirme) : la page n'affiche alors pas de bouton « Continuer », qui ne ferait que proposer de
   *  sauter l'étape. */
  selfAdvancing?: boolean;
  /** Message d'erreur bloquant « Continuer », ou null pour laisser passer. */
  validate?: (ctx: OnboardingStepContext) => string | null;
  /** Contenu de la carte, titre compris — chaque étape est responsable de son en-tête. */
  render: (ctx: OnboardingStepContext) => ReactNode;
}

export interface VerticalDefinition {
  id: VerticalId;
  /** Liste ORDONNÉE : c'est elle qui définit le nombre d'étapes, les onglets et la progression. */
  onboarding: OnboardingStep[];
}
