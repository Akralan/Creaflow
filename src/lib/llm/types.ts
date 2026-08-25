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
