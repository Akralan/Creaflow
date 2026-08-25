# Baseline Lot 0 — sorties brutes (avant modification du prompt)

Provider forcé : OpenAI (`gpt-5.6-luna`). Généré le 2026-08-25T14:02:20.549Z.

Aucune écriture en base — uniquement des appels LLM en lecture de contexte.

- [`01-rich-video-serie`](./01-rich-video-serie.md) — Matière riche (23 docs, MyTwin Leaderboard) · vidéo TikTok · série imposée (Coulisses du Vendredi) → **OK**
- [`02-medium-text-sans-serie`](./02-medium-text-sans-serie.md) — Matière moyenne (6 docs, PPO HotlineMiami) · texte LinkedIn · pas de série → **OK**
- `03-sparse-visual-serie` — Matière rare (4 docs, PixelPitch) · visuel Instagram · série imposée (Showcase du Lundi) → **ÉCHEC** (voir `03-sparse-visual-serie.ERROR.txt`)
- [`04-sans-matiere-sans-produit`](./04-sans-matiere-sans-produit.md) — Aucun produit, aucune matière (niveau marque, 0 doc) · texte X · pas de série — teste les garde-fous anti-invention → **OK**
- [`05-rich-video-autre-format-sans-serie`](./05-rich-video-autre-format-sans-serie.md) — Même matière riche que le brief 1 (MyTwin Leaderboard) mais YouTube, pas de série — compare le rendu du même corpus sur un autre format → **OK**

## Bug non lié découvert pendant le run

Le brief `03-sparse-visual-serie` échoue systématiquement, **avant même l'appel au LLM de génération** : `buildGenerationContext()` déclenche `findBestBrandAssetForScript()` pour tout `contentType="visual"`, qui appelle `embedText()` (`src/lib/llm/embeddings.ts`) — celui-ci utilise **toujours Gemini** (`text-embedding-004`) pour l'embedding de recherche sémantique, indépendamment de `LLM_PROVIDER`. Ce modèle Gemini renvoie 404 (`models/text-embedding-004 is not found for API version v1beta`).

Conséquence : **toute génération de contenu `visual` est cassée en l'état**, pas seulement ce test de baseline — dès qu'un profil a au moins un `brandAsset`, `findBestBrandAssetForScript` est appelée. Hors périmètre du présent chantier (prompt de génération) ; non corrigé ici, signalé pour action séparée.

Brief 3 non rejoué (4/5 obtenus) — suffisant au regard de la fourchette "3-5 briefs" du protocole (§7/§8 de la spec).
