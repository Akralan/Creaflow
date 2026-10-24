# Critères de lecture — banc MyKiné (genres), gpt-6-luna

Relecture des 12 posts de `posts-gpt-6-luna.txt` (run du 2026-10-24, avec les modèles de posts rendus par `read_form`) face aux critères de la Partie 3 de `docs/FORMES_ET_GENRES.md`. Lecture humaine, pas un contrôle automatique. Source principale : `docs/tests/mykine-pack/C/genres.md`, écrit au « je ».

| # | Forme | Critère de la forme | Verdict | Ce qui le dit |
|---|---|---|---|---|
| 1 | Origine | le nom du produit n'apparaît pas avant la dernière phrase | ✅ | « MyKiné » seulement dans la dernière phrase |
| 2 | Lancement | un lieu d'accès et un chiffre | ⚠️ | lieu d'accès donné (« dashboard : Patients > Exporter ») ; aucun chiffre |
| 3 | Épisode | aucune phrase au futur | ✅ | tout au présent ou au passé |
| 4 | Coulisses | le nom du produit absent ; ≤ 600 caractères | ✅ | « l'app » seulement, ~330 caractères |
| 5 | Ce que j'ai appris | la règle deux fois, début et fin | ❌ | la règle de l'auteur (« le délai avant la première séance prédit tout le reste ») n'est jamais dite ; le post l'affaiblit (« ce n'est pas une preuve que le délai cause l'écart ») |
| 6 | Offre | un impératif en dernière phrase ; une condition ou un délai | ✅ | « écrivez-moi […] avant le 15 novembre » |
| 7 | Chiffre | un seul indicateur, le nombre dans la source | ✅ | 17 % d'abandon (412 / 70), comparé à 21 % : même indicateur, chiffres exacts |
| 8 | Lancement | un lieu d'accès et un chiffre | ⚠️ | chiffre donné (12 kinés actifs) ; aucun lieu d'accès ; deuxième paragraphe qui présente le produit |
| 9 | Épisode | aucune phrase au futur | ✅ | — |
| 10 | Échec | pas de « mais » dans les deux dernières phrases ; aucun futur | ✅ | première personne, aveu sans rattrapage |
| 11 | Teaser | date ou délai en première phrase ; le nom du produit ≤ 1 fois | ✅ | « Le 3 novembre », « MyKiné » une fois |
| 12 | Question | exactement un « ? », en dernière phrase | ✅ | — |
| — | Toutes | la personne des notes (je) | ✅ | « je » partout où l'auteur agit, aucun « nous » ; le post 9 reste impersonnel |

**Bilan : 9 sur 12 tiennent leur critère, 2 à moitié, 1 non.** Les deux lancements ratent chacun une moitié de leur critère, sur des points différents : le critère « lieu d'accès et chiffre » n'est pas dans le texte de la forme de façon assez forte. La leçon est le vrai raté : le rédacteur a réécrit la règle de l'auteur en une prudence qu'il n'a pas écrite.

**Hors critères, relevé à la lecture** : 10 accroches sur 12 commencent par un chiffre ; la tournure « entre deux rendez-vous » (le pitch de la cible) revient dans 7 posts sur 12.

**Côté lecteur**, les trois critères vérifiables par le code tiennent sur ce run : 158 pointeurs, tous avec un genre ; l'unique `engagement` porte un nombre dans sa ligne ; les 16 `fulfills` visent des événements de la liste ouverte.
