# SPEC — Langue des posts

Décidée avec l'utilisateur le 2026-10-18. Implémentée sur `feature/langue-des-posts`.

## Règle

La langue d'un post est **celle du profil** si le profil en définit une, **sinon celle des notes**. C'est une règle absolue : elle est donnée au rédacteur ET revérifiée par le code. Le titre, l'accroche, les slides, le texte et les hashtags suivent la même langue.

Langues proposées pour l'instant : anglais et français (`src/lib/language.ts`, `POST_LANGUAGES`). Une langue détectée dans les notes mais non gérée (ou des notes trop courtes) retombe sur l'anglais.

## Où ça vit

- `creator_profiles.language` (`"en" | "fr" | null`, migration `0046`) ; `null` = automatique. Réglage dans Réglages > identité, champ « Language of your posts ». Route `/api/profile` : `language` accepté, `null` l'efface.
- `src/lib/language.ts` : liste des langues, `detectLanguage` (comptage de mots-outils, sans dépendance), `resolvePostLanguage(profil, notes)`, bloc `<language>` des prompts, `languageFailure` pour les contrôles.
- `buildGenerationContext` calcule `context.language` (notes du sujet, à défaut le document source de l'événement).
- Rédacteur par événements et prompt V3 : le bloc `<language>` est posé juste avant la consigne finale (les documents et la ligne de temps dans une autre langue l'emportent sinon sur une ligne du prompt système). Les « Write in English » en dur ont été retirés de `SCRIPT_CORE_PROMPT`, de `METHOD_PROMPT`, des schémas d'outils et des retouches.
- `scriptChecks` : `languageFailures` rejette un post dont la langue détectée n'est pas la bonne (titre, accroche, slides, texte) ; le rédacteur le réécrit.

## Limites connues

- Les hashtags ne sont pas vérifiés par le code (trop courts pour détecter une langue) : seul le prompt les contraint. Sur le pack MyKiné en français, un post sur trois a gardé des hashtags anglais.
- Les textes internes (événements de la ligne de temps, forme de série, portrait des lecteurs) restent en anglais : ils ne sont pas publiés.

## Essais (pack MyKiné, notes en français, mêmes trois événements)

- Profil sur English : 3 posts sur 3 en anglais (`docs/tests/mykine-pack/LANGUE_profil_en.txt`). Avant : 2 sur 3 en français sans consigne de langue.
- Automatique : 3 posts sur 3 en français (`LANGUE_auto_notes.txt`).
