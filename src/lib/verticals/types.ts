/** Miroir de `users.vertical` (docs/ARCHITECTURE_VERTICALES.md).
 *
 *  Depuis docs/SPEC_ONBOARDING_MVP.md, la verticale ne choisit plus le parcours d'onboarding (il
 *  n'y en a plus qu'un) : elle reste posée à l'inscription et ne sert qu'à nuancer certains prompts
 *  (maquettes du post visuel). Les valeurs existent pour qu'on puisse différencier plus tard sans
 *  migration. */
export type VerticalId = "creator" | "dev" | "artisan" | "entrepreneur";
