/** Miroir de `users.vertical` (docs/ARCHITECTURE_VERTICALES.md).
 *
 *  Since docs/SPEC_ONBOARDING_MVP.md, the vertical no longer chooses the onboarding path (there is
 *  only one left): it is still set at signup and only serves to nuance certain prompts
 *  (visual post mockups). The values exist so we can differentiate later without
 *  a migration. */
export type VerticalId = "creator" | "dev" | "artisan" | "entrepreneur";
