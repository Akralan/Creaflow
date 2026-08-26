export interface LlmToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
    // Exigence du mode strict OpenAI (src/lib/llm/providers/openai.ts) : toutes les propriétés étant
    // déjà `required`, on peut fermer le schéma pour que l'API garantisse leur présence en sortie
    // plutôt que de compter sur la bonne volonté du modèle. Ignoré sans effet par les autres providers.
    additionalProperties?: false;
  };
}

/** Un tour de conversation, côté appelant — l'équivalent multi-tours du `userMessage` unique de
 *  `StructuredCallParams` (docs/SPEC_ASSISTANT_AGENTIQUE.md §2). */
export interface AgenticMessage {
  role: "user" | "assistant";
  content: string;
}

/** Un appel d'outil effectué par le modèle pendant la boucle, avec ce qu'on lui a répondu. */
export interface AgenticToolCall {
  name: string;
  input: unknown;
  output: unknown;
  /** Vrai quand l'exécution a échoué et qu'on a renvoyé l'erreur au modèle plutôt que de planter. */
  failed?: boolean;
}

export interface AgenticResult {
  /** Réponse conversationnelle finale. Jamais vide : si la boucle atteint `maxTurns`, un dernier
   *  appel sans outils force le modèle à conclure. */
  reply: string;
  toolCalls: AgenticToolCall[];
  turns: number;
  stoppedAtMaxTurns: boolean;
}

/** Boucle agentique — N outils NON imposés, plusieurs allers-retours, exécution des outils côté
 *  serveur (docs/SPEC_ASSISTANT_AGENTIQUE.md §2.2). Implémentée pour le seul provider OpenAI :
 *  l'appelant passe par `callAgentic` (provider.ts), qui ne consulte pas `LLM_PROVIDER`. */
export interface AgenticCallParams {
  system: string;
  messages: AgenticMessage[];
  tools: LlmToolDefinition[];
  /** Budget de sortie par appel au modèle, pas pour la boucle entière. */
  maxTokens: number;
  /** Garde-fou dur (§2.3). Défaut : DEFAULT_MAX_TURNS. */
  maxTurns?: number;
  /** Effort de raisonnement OpenAI. Défaut : "low", comme le reste du repo. */
  effort?: "low" | "medium" | "high";
  /** Exécute un appel d'outil et renvoie ce qui sera transmis au modèle (sérialisé en JSON).
   *  Une exception est capturée et renvoyée au modèle comme erreur — elle n'interrompt pas la boucle. */
  onToolCall: (call: { name: string; input: unknown }) => Promise<unknown>;
}

export interface StructuredCallParams {
  system: string;
  userMessage: string;
  tool: LlmToolDefinition;
  maxTokens: number;
  // Mode strict OpenAI uniquement (providers/openai.ts, ignoré par les autres providers) — l'appelant
  // l'active explicitement au cas par cas, jamais par défaut : ça exige `additionalProperties: false`
  // partout dans `tool.input_schema` (400 sinon), ce que seuls les tools de génération de script
  // complète déclarent. Activer par défaut a cassé les micro-retouches (`regenerate_hashtags` etc.)
  // dont les schémas plus petits ne sont pas conformes — voir docs/SPEC_MATIERE_EDITEUR.md §3.
  strict?: boolean;
}
