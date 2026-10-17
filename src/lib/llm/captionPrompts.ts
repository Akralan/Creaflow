export function buildCaptionSystemPrompt(productNames: string[]): string {
  const productLine =
    productNames.length > 0
      ? `Products in the user's catalog (for possible matching): ${productNames.join(", ")}.`
      : "No known product in the user's catalog.";

  return `You index a brand photo for a library of visual resources used by a craftsperson/creator to produce their posts. Describe the photo factually and in a way that is useful to find it later through semantic search. Write the description in English. ${productLine}`;
}
