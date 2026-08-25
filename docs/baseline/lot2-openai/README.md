# Baseline Lot 2 — sorties brutes (après §4 : champ concept + descriptions qualitatives)

Provider forcé : OpenAI (`gpt-5.6-luna`). Généré le 2026-08-25T15:07:00.859Z.

Mêmes 5 briefs, mêmes ids en base, que docs/baseline/lot0-openai/ — seul le prompt a changé.

Aucune écriture en base — uniquement des appels LLM en lecture de contexte.

- [`01-rich-video-serie`](./01-rich-video-serie.md) — Matière riche (23 docs, MyTwin Leaderboard) · vidéo TikTok · série imposée (Coulisses du Vendredi) → **OK**
- [`02-medium-text-sans-serie`](./02-medium-text-sans-serie.md) — Matière moyenne (6 docs, PPO HotlineMiami) · texte LinkedIn · pas de série → **OK**
- `03-sparse-visual-serie` — Matière rare (4 docs, PixelPitch) · visuel Instagram · série imposée (Showcase du Lundi) → **ÉCHEC** (voir `03-sparse-visual-serie.ERROR.txt`)
- [`04-sans-matiere-sans-produit`](./04-sans-matiere-sans-produit.md) — Aucun produit, aucune matière (niveau marque, 0 doc) · texte X · pas de série — teste les garde-fous anti-invention → **OK**
- [`05-rich-video-autre-format-sans-serie`](./05-rich-video-autre-format-sans-serie.md) — Même matière riche que le brief 1 (MyTwin Leaderboard) mais YouTube, pas de série — compare le rendu du même corpus sur un autre format → **OK**
