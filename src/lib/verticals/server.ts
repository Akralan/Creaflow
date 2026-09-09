import {
  runDevOnboardingChatTurn,
  runOnboardingChatTurn,
  type OnboardingChatResult,
  type OnboardingMessage,
} from "@/lib/llm/onboardingChat";
import { buildDevOnboardingContext } from "@/lib/services/devOnboardingContext";
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

const serverVerticals: Record<VerticalId, VerticalServerDefinition> = {
  creator: {
    runOnboardingChatTurn: (_userId, history) => runOnboardingChatTurn({ history }),
  },
  dev: {
    // Le prompt dev reçoit le profil GitHub et les dépôts déjà ingérés, et n'a droit qu'à deux ou
    // trois questions — l'utilisateur a déjà dit qui il est en connectant GitHub.
    runOnboardingChatTurn: async (userId, history) =>
      runDevOnboardingChatTurn({ history, dev: await buildDevOnboardingContext(userId) }),
  },
};

export function getServerVertical(id: VerticalId): VerticalServerDefinition {
  return serverVerticals[id] ?? serverVerticals.creator;
}
