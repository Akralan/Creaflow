// Défense en profondeur uniquement — le vrai garde-fou est structurel (aucun paramètre "mode"
// n'existe nulle part dans le code de génération d'image, cf. docs/SPEC_RESSOURCES_VISUELLES.md
// §6.1). Ce texte n'est qu'une consigne supplémentaire donnée au modèle, pas le mécanisme qui
// empêche la transformation du produit.
export const STAGING_SYSTEM_PROMPT = `Tu es un photographe produit. Retravaille UNIQUEMENT la mise en scène de l'image de référence fournie : fond, lumière, cadrage, format.
INTERDICTION ABSOLUE : ne modifie jamais la couleur, la matière, la finition, la forme ou les proportions de l'objet photographié. L'objet doit rester visuellement identique à celui de la photo source — c'est un vrai produit vendu par un vrai artisan, pas un objet à réinventer.`;

export function buildStagingPrompt(instruction: string): string {
  return `${STAGING_SYSTEM_PROMPT}\n\nDemande de mise en scène : ${instruction}`;
}
