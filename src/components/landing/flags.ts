/**
 * Display switches for the landing. Module without "use client" so it is readable from
 * both LandingPage (server component) and the header (client): a boolean
 * exported by a client module would reach the server as a reference, not as a value.
 */

/**
 * "What Tellovo does" section (feature grid) hidden since 2026-10-15:
 * its points are taken up, rephrased as benefits, by "What changes for you", and the
 * hero already shows provenance. The component stays in place to compare both
 * versions: switching to `true` shows the section, its panel and the header link again.
 */
export const FEATURES_ENABLED = false;

/**
 * Profiles shown by the landing examples (ids from personas.ts). Since
 * 2026-10-16, only developers who build in public: the founder and freelancer profiles
 * stay in personas.ts, just add their id here to show them again.
 * With a single profile, the examples stop rotating.
 */
export const ACTIVE_PERSONA_IDS: string[] = ["dev"];
