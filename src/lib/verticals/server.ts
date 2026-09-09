import {
  runConnectedOnboardingChatTurn,
  runOnboardingChatTurn,
  type OnboardingChatResult,
  type OnboardingMessage,
} from "@/lib/llm/onboardingChat";
import { buildConnectedOnboardingContext } from "@/lib/services/connectedOnboardingContext";
import type { VerticalId } from "./types";

/**
 * Pendant SERVEUR du registre de verticales (docs/ARCHITECTURE_VERTICALES.md §4, chantier 2).
 *
 * Séparé de `registry.ts`, qui est client et rend du JSX : ce module lit la base, il ne doit jamais
 * être importé depuis un composant. Inversement, ne pas importer `registry.ts` ici — ça tirerait
 * l'arbre React entier dans le bundle serveur.
 */

export interface VerticalServerDefinition {
  /**
   * Un tour du chat d'onboarding. Chaque verticale choisit son prompt et le contexte qu'elle y
   * injecte ; le contrat de SORTIE est identique, donc tout ce qui suit dans la route (fusion du
   * profil, finalisation, persistance du fil) ne distingue pas les verticales.
   */
  runOnboardingChatTurn(userId: string, history: OnboardingMessage[]): Promise<OnboardingChatResult>;
}

/** Le prompt reçoit le profil du compte tiers et les sujets déjà ingérés, et n'a droit qu'à deux ou
 *  trois questions — la personne a déjà dit qui elle est en connectant son compte. */
const connected: VerticalServerDefinition = {
  runOnboardingChatTurn: async (userId, history) =>
    runConnectedOnboardingChatTurn({ history, connected: await buildConnectedOnboardingContext(userId) }),
};

const serverVerticals: Record<VerticalId, VerticalServerDefinition> = {
  creator: {
    runOnboardingChatTurn: (_userId, history) => runOnboardingChatTurn({ history }),
  },
  // Les trois verticales nées d'un fournisseur tiers partagent le même tour de chat : ce qui les
  // distingue est le nom de la plateforme, et il vient du contexte, pas d'un prompt par verticale.
  dev: connected,
  artisan: connected,
  entrepreneur: connected,
};

export function getServerVertical(id: VerticalId): VerticalServerDefinition {
  return serverVerticals[id] ?? serverVerticals.creator;
}
