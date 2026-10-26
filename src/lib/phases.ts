/**
 * La phase d'un projet (docs/TODO.md, « Phases du projet », décidé le 2026-10-26) : c'est l'auteur qui
 * la fixe, dans Business context ou sur la carte de /start, où la lecture du dépôt la devine. Elle
 * décide quelles formes de post sont permises ; le rédacteur ne la voit jamais nommée (la loi du
 * 2026-10-21 : un élément nommé dans le prompt ressort dans le texte), il ne reçoit que la table des
 * formes qu'elle autorise.
 *
 * « Ouvrir » est une seule phase pour l'auteur, coupée en deux valeurs : la bêta et le lancement.
 * Sans dépendance, pour que le schéma de la base puisse l'importer.
 */
export const PHASES = ["engage", "build", "beta", "launch", "grow"] as const;
export type Phase = (typeof PHASES)[number];

export const DEFAULT_PHASE: Phase = "build";

export function isPhase(value: unknown): value is Phase {
  return typeof value === "string" && (PHASES as readonly string[]).includes(value);
}

/** Les quatre choix que l'auteur voit ; « open » recouvre beta et launch. */
export type PhaseChoice = "engage" | "build" | "open" | "grow";

export const PHASE_CHOICES: Array<{ choice: PhaseChoice; label: string; hint: string }> = [
  { choice: "engage", label: "Going public", hint: "You announce the project and show what's behind it." },
  { choice: "build", label: "Building", hint: "You document the build: what ships, what breaks, what you learn." },
  { choice: "open", label: "Opening up", hint: "You let people in: a beta first, then the launch." },
  { choice: "grow", label: "Growing", hint: "It's launched: users, numbers, what they tell you." },
];

export function phaseChoice(phase: Phase): PhaseChoice {
  return phase === "beta" || phase === "launch" ? "open" : phase;
}

/** La phase par défaut d'un choix : ouvrir commence par la bêta. */
export function phaseOfChoice(choice: PhaseChoice, current: Phase): Phase {
  if (choice !== "open") return choice;
  return current === "launch" ? "launch" : "beta";
}

export function phaseLabel(phase: Phase): string {
  const base = PHASE_CHOICES.find((c) => c.choice === phaseChoice(phase))?.label ?? phase;
  if (phase === "beta") return `${base} · beta`;
  if (phase === "launch") return `${base} · launch`;
  return base;
}
