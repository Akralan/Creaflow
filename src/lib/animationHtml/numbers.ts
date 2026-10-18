/**
 * Fidelity check of an animation (docs/SPEC_ANIMATION_HTML_LIBRE.md A7): every number the screen shows must be a
 * number of the post. A model that "illustrates" a latency or a count readily invents a figure that sounds right
 * ("12 squats", "13/20"): in a post about someone's work, an invented number is a lie.
 */

const WORDS: Record<string, number> = {
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10,
  one: 1, two: 2, three: 3, four: 4, five: 5, seven: 7, eight: 8, nine: 9, ten: 10,
};

function normalize(token: string): number {
  return Number(token.replace(",", "."));
}

/** The numbers written in a text, as digits (1 000 and 1,5 included) or as small words (trois, three). */
export function numbersIn(text: string): Set<number> {
  const found = new Set<number>();
  for (const m of text.replace(/(\d)[\s ](\d{3})(?!\d)/g, "$1$2").matchAll(/\d+(?:[.,]\d+)?/g)) found.add(normalize(m[0]));
  for (const m of text.toLowerCase().matchAll(/[a-zéèêàç]+/g)) if (m[0] in WORDS) found.add(WORDS[m[0]]);
  return found;
}

/** Numbers on the screen that the post does not state. A degree sign or a unit does not matter: only the value does. Small counting labels (0 to 3) are let through. */
export function foreignNumbers(screenText: string, postText: string): number[] {
  const allowed = numbersIn(postText);
  // 0, 1, 2, 3 are labels and starting points (the first, the second, the third repetition; a counter that starts at 0), not claims: only a figure that says something is checked.
  const shown = [...numbersIn(screenText)].filter((n) => !allowed.has(n) && !(Number.isInteger(n) && n >= 0 && n <= 3));
  return shown.sort((a, b) => a - b);
}
