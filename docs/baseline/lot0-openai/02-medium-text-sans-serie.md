# Brief 02-medium-text-sans-serie

> Matière moyenne (6 docs, PPO HotlineMiami) · texte LinkedIn · pas de série

- Plateforme : linkedin
- Type de contenu : text
- Catégorie : Tips Tech (1ac4862f-9b1d-47a9-8e8d-b35bb6a80794)
- Produit : PPO HotlineMiami
- Série : (aucune)
- Angle imposé : Défi ludique
- Documents de matière injectés : 6

## Message utilisateur assemblé (envoyé au LLM)

```
Marque : MarvelousDev (développement de produits et projets ludiques)
Ton : Utilise le "je" car je suis seul, c'est du personnal branding un peu ces projets. J'aime bien que les scripts et une conclusion
Temps disponible par semaine : 7h
Produit concerné : PPO HotlineMiami
Matière factuelle disponible sur ce sujet (base-toi dessus en priorité, n'invente rien au-delà). Les passages entourés de [déjà utilisé dans un post précédent]...[/déjà utilisé] ont déjà servi dans un post — évite de les reprendre tels quels, un nouvel angle sur le même fait reste bienvenu :
[training_log_v2.md]
# Journal des runs d'entraînement — v2

> Même convention que `docs/training_log.md` : à chaque fin de run, numéro/nom du run, config utilisée,
> fonction de reward exacte, nombre de pas, puis analyse des courbes (TensorBoard) et décision prise.

## Pourquoi un fichier v2 (2026-08-10)

**Contexte** : `docs/training_log.md` (runs 1-30, ~30M+ pas cumulés sur `room_stage=2`) a produit un
agent au combat quasi parfait (`room_cleared_rate` 0.95-1.00, ~2 kills/épisode) mais qui n'a **jamais
atteint 0% de succès réel** — bloqué systématiquement à 60-70px d'un coin précis (mur miroir), diagnostiqué
comme un effondrement d'exploration (agent gelé, plus assez de bruit résiduel pour finir le détour).
`ent_coef` (constant ou avec decay) a partiellement débloqué le franchissement mais toujours dégradé le
combat, sans jamais atteindre un vrai succès. Le dernier pivot testé (`step2_bc_finetune_cont`,
behavioral cloning) a **régressé nettement** par rapport à la lignée PPO pure (`room_cleared_rate`
0.06-0.12 contre 0.95-1.00, `death_rate` 0.85-0.91 contre 0-0.05).

**Décision (discussion du 2026-08-10)** : plutôt que de continuer à s'acharner sur ce coin précis,
repartir sur une base différente :
1. **Retirer toute connaissance de la sortie** de l'agent (observations ET reward) — isoler
   complètement l'apprentissage du combat de celui de la navigation, comme au tout début du curriculum
   (`simple_room`, stage 0/1) mais cette fois sans jamais réintroduire `goal_hint` sur cette lignée.
2. **Randomiser davantage `room1`** — en plus du spawn joueur/ennemi déjà randomisé
   (`simple_room_randomize_spawn`), randomiser aussi la disposition du mur de couverture central
   (`simple_room_randomize_mid_wall`) : suspicion que la géométrie fixe du mur laissait encore un
   raccourci de mémorisation malgré le spawn variable.
3. Objectif : un agent de combat qui généralise vraiment (pas de connaissance implicite d'une carte
   figée), avant de rattaquer la navigation vers la sortie — probablement via une architecture séparée
   (cf. `docs/ideas_backlog.md`, idées mises de côté pour l'instant, pas abandonnées).

**Modèles/logs de la lignée v1** (`training_log.md`) conservés tels quels, non retouchés, restent la
référence si besoin d'y revenir.

## Changements de code (2026-08-10, avant le run 1 de cette lignée)

**`HotlineEnvConfig.goal_hint=False`** (flag déjà existant, `env.py`) : gate déjà entièrement les 4
features d'observation liées à la sortie (`gdir_cos/gdir_sin/goal_dist_norm/enemies_remaining`) et tous
les termes de reward de progression/idle vers la sortie. **Un seul résidu corrigé aujourd'hui** : le
bonus fixe `+500` sur `success` n'était pas gaté par `goal_hint` (seul terme de `_compute_reward` à
échapper à la règle) — désormais `if success and self.config.goal_hint:`. Comportement des runs
existants (`goal_hint=True` par défaut) strictement inchangé.

**`HotlineEnvConfig.simple_room_randomize_mid_wall`** (nouveau flag, défaut `False` = comportement
inchangé) : quand actif (nécessite `simple_room_randomize_spawn=True`, même règle que
`simple_room_exit_corners`), randomise la frontière de colonne ET la moitié de rangée couverte par le
mur central de `room1`, au lieu de la position fixe habituelle (frontière colonne 1/2, moitié
supérieure). Coupe toujours la ligne de vue directe sans séparer la salle en deux (un passage reste
ouvert sur l'autre rangée), juste à un endroit différent à chaque épisode. 4 dispositions distinctes
possibles sur la géométrie actuelle de `room1` (`SIMPLE_ROOM_COLS=3`, `SIMPLE_ROOM_ROWS=2`).

**Vérifié** : `check_env.py` intégralement vert (comportement par défaut inchangé). Smoke test ad hoc
(`goal_hint=False` : 500 steps aléatoires sans crash ; `simple_room_randomize_mid_wall=True` : 30 resets,
4 dispositions distinctes observées, aucune case isolée dans `nav_graph`, 200 steps sans crash).

**Décision** : lancer le run 1 de cette lignée sur `room1` (stage 1), combat seul, mur + spawn
randomisés, `goal_hint=False`. Cf. entrée suivante.

## Randomisation de l'arme du joueur + correctif d'un bug de munitions (2026-08-10)

**`HotlineEnvConfig.single_weapon_randomize_type`** (nouveau flag, ignore si `single_weapon=False`,
défaut `False` = comportement inchangé) : tire à chaque reset entre pistolet
(`SINGLE_WEAPON_LIMITED_AMMO=3` munitions) et batte, au lieu du pistolet à munitions quasi illimitées
(`SINGLE_WEAPON_AMMO=999_999`) systématique. Objectif : forcer une vraie discipline de tir - avec
999_999 munitions, la feature d'observation normalisée (`ammunition/30.0`) saturait à 1.0 en permanence,
aucune pression reelle sur la gestion des munitions. A utiliser avec `enable_throw=True` pour que le
pistolet a sec ne soit pas une impasse totale (le lancer bascule sur les poings).

**Bug découvert en testant** (`game.py --single-weapon --randomize-weapon --enable-throw`) : lancer le
pistolet puis le reramasser rechargeait systématiquement à fond (7 munitions, valeur fixe de
`pistolItem.pickup`) au lieu de rendre les munitions réelles au moment du lancer - `throwweapon`
remettait `ammunition[weapon]=0` sur le joueur sans jamais transmettre l'info au projectile puis à
l'item déposé au sol. Exploit direct pour un agent RL : lancer + reramasser immédiatement = munitions
gratuites, annule complètement l'intérêt de la rareté introduite ci-dessus.

**Correctif** : les munitions réelles au moment du lancer sont désormais portées par le projectile
(`bullet.ammo`) puis par l'item déposé au sol (`Item.ammo`) et restituées telles quelles au ramassage
(`pistolItem`/`shotgunItem.pickup`). Une arme trouvée au sol qui n'a jamais été lancée par le joueur
(`ammo=None`, ex. butin d'un ennemi tué) garde le comportement d'origine (chargeur par défaut) -
changement scopé au cas signalé, pas de régression sur le reste du jeu.

**Vérifié** : `check_env.py` intégralement vert. Smoke test dédié (3 cas : lancé avec munitions
restantes → ramassé avec exactement ça ; lancé à sec → reste à sec ; arme jamais lancée → chargeur par
défaut inchangé) tous verts.

**Bug additionnel corrigé** : `advance_level()` (transition de victoire, mode humain uniquement) ne
rappelait jamais `_apply_single_weapon_loadout()` contrairement à `_new_game()` (mort) - le loadout
restait figé sur ce qu'il était en fin de niveau précédent au lieu d'être re-tiré aléatoirement à
chaque transition, mort ou victoire. Corrigé (meme reroll aleatoire que sur `_new_game`, la meme
methode est appelee).

**`HotlineEnvConfig.success_on_room_clear`** (nouveau flag, défaut `False` = comportement inchangé) :
avec `goal_hint=False`, l'agent n'a plus de raison d'aller vers la sortie - sans ce flag, un épisode
continue jusqu'à `max_episode_steps` une fois la salle vide, temps de rollout gaspillé. Actif, l'épisode
se termine (`success=True`) dès le dernier ennemi tué, sans passer par la zone de sortie. Le bonus +500
reste gaté par `goal_hint` (aucune fuite de reward). Vérifié : smoke test dédié (mort du dernier ennemi
→ `terminated=True` immédiat, `reward` sans le bonus +500).

## Run 1 — `v2_step1_randall` (2026-08-10, en cours)

**Config** : `room1` (`--simple-room --room-stage 1`), spawn + mur central + arme (pistolet 3 munitions
ou batte) randomisés à chaque reset, `--enable-throw`, `--no-goal-hint`, `--success-on-room-clear`.
5 000 000 pas visés, depuis zéro. `check_env.py` vert avant lancement.

**Confirmation en direct** : `success_rate` = `room_cleared_rate` = `kills_per_episode` dès les
premières évals (25k-32k pas) - confirme que `success_on_room_clear` fonctionne comme prévu en
conditions réelles d'entraînement, pas seulement sur le smoke test isolé. ~1322 steps/s, ~1h estimée.

**Décision** : laisser tourner jusqu'au bout, analyser les courbes une fois terminé.

---

[training_log.md]
# Journal des runs d'entraînement

> À chaque fin de run : numéro/nom du run, config utilisée, fonction de reward exacte, nombre de pas,
> puis analyse des courbes (TensorBoard) et décision prise. Convention à respecter systématiquement
> pour ne pas reperdre le fil d'un run à l'autre.

> **Pivot du 2026-08-10** : après le run 30 (`entdecay`) et la régression du run BC (`bc_finetune_cont`),
> la suite des expérimentations continue dans `docs/training_log_v2.md` (nouvelle lignée : agent sans
> connaissance de la sortie, `room1` avec mur central randomisé). Ce fichier reste la référence figée
> de la lignée `room_stage=2` / navigation vers la sortie, non retouché.

## Run 1 — `step1` (2026-08-08)

**Config** (`curriculum_step1_config`, étape 1 du curriculum) :
- `headless=True`, `fixed_map=True`, `map_seed=0`, `enemy_count=1`, `single_weapon=True`, `goal_hint=True`,
  `max_episode_steps=1500`
- Agent : spawn avec **pistolet**, munitions quasi illimitées (999 999)
- Ennemi (1) : arme tirée au hasard parmi **BAT / PISTOL / SHOTGUN** (jamais à mains nues) — donc
  ~2/3 de chances d'être armé à distance

**Fonction de reward** (défauts de `HotlineEnvConfig`, inchangés pour ce run) :
```
reward = delta(game_points)          # +100 kill, -50 par tir reussi, +500 sortie+piece vide
         - 0.01                      # malus de tick, a chaque step
         + 0.1 * progression_sortie  # sauts de cellule gagnes vers la sortie, seulement si aucun
                                      # ennemi en "chase"
         - 50.0                      # malus fixe, uniquement sur l'episode ou le joueur meurt
```

**Pas d'entraînement** : 1 000 000 (PPO, `MlpPolicy`, `device=cpu`, 8 environnements parallèles,
`SubprocVecEnv`). Durée réelle ~20 min (~840-1150 steps/s selon la charge).

**Métriques suivies à l'époque de ce run** : `death_rate`, `success_rate` (fenêtre glissante 100
épisodes). **`room_cleared_rate` et `kills_per_episode` n'existaient pas encore** — ajoutés après coup
suite à l'analyse de ce run (donc valeurs indisponibles pour ce run précis, à surveiller au run 2).

**Résultats (courbes `rollout/`)** :

| Métrique | Début | Fin (~1M steps) |
|---|---|---|
| `death_rate` | ~0.95–1.0 | ~0.13–0.15 |
| `success_rate` | 0 | 0 (jamais atteint) |
| `ep_len_mean` | ~500–600 | ~1420 (proche du plafond 1500) |
| `ep_rew_mean` | ~-2700 | ~-37 à -60 |

**Analyse** : l'agent a appris à **éviter le contact avec l'ennemi** (death_rate en forte baisse,
longueur d'épisode qui grimpe jusqu'au plafond de troncature), mais **jamais à engager le combat** —
aucun signe de progression vers un kill ou la sortie sur toute la durée. Diagnostic : la fonction de
reward actuelle **punit l'engagement plus qu'elle ne le récompense** tant que l'agent n'est pas déjà
compétent :
- Chaque tir coûte -50 (hérité du `game_points` du jeu humain, pensé pour décourager le spray d'un
  joueur humain compétent — pas adapté à un agent qui explore depuis zéro).
- Chaque mort coûte -50 en plus de mettre fin à l'épisode.
- Une politique passive (ne jamais tirer, éviter tout contact) n'accumule que le malus de tick
  (-0,01/step, soit -15 sur un épisode complet) — largement moins pénalisant que quelques tentatives
  de tir ratées + une mort.
- Résultat : le gradient le plus facile à suivre tôt dans l'entraînement est "fuir", pas "apprendre à
  viser puis tuer". Rien dans la fonction actuelle ne pousse activement l'agent à se rapprocher d'un
  ennemi pour l'engager (contrairement à l'indice de rapprochement vers la sortie, qui lui a un
  équivalent explicite).

**Décision** : ne pas poursuivre l'entraînement de ce run (il ne convergera pas vers l'objectif
recherché — nettoyer la pièce). Revoir la fonction de reward avant de relancer (discussion en cours,
cf. session du 2026-08-08 et mises à jour futures de `docs/agent_ia_design.md`). Conserver
`models/step1/final_model.zip` comme référence du comportement "fuite" pour comparaison future.

## Run 2 — `step1_reward_v2` (2026-08-08)

**Config** : identique au run 1 (`enemy_count=1`, `map_seed=0`, `single_weapon=True`, `goal_hint=True`,
`max_episode_steps=1500`, 1 000 000 pas, 8 environnements). **Seule la fonction de reward change** —
changement isolé, un ajustement à la fois, pour savoir ce qui a marché ou non.

**Fonction de reward** (v2, détaillée dans `docs/agent_ia_design.md` §3) : identique au run 1 sauf le
traitement du tir, qui remplace le malus fixe de -50 par une évaluation de la qualité de visée,
**indépendante de `game_points`** (qui reste inchangé à l'écran humain) :
```
reward = 100 * kills_ce_step
         + qualite_visee_du_tir     # +2 si vise dans un cone de 15 deg autour d'un ennemi, -5 sinon
                                     # (0 si plus aucun ennemi en vie), independant de game_points
         + 500 * succes
         - 0.01                     # malus de tick
         + 0.1 * progression_sortie # inchange (seulement si aucun ennemi en "chase")
         - 50.0 * mort              # inchange
```

**Résultats (courbes `rollout/`, fenêtre glissante 100 épisodes)** :

| Pas | `death_rate` | `kills_per_episode` / `room_cleared_rate` | `ep_rew_mean` |
|---|---|---|---|
| 0 | 1.0 | 0 | -265 |
| ~275k–350k (pic) | ~0.84–0.85 | **~0.15–0.16** | ~-210 à -260 |
| ~670k–920k | 0 → 0.02 | **0** | ~-18 à -21 (≈ juste le malus de tick sur un épisode complet) |
| 1 000 000 (fin) | 0.16–0.17 | 0 | -36.7 |

**Analyse** : le bonus de visée a **retardé** la convergence vers la fuite pure et créé un pic
temporaire d'engagement (jusqu'à ~16% des épisodes avec un kill, vers 275k-350k pas) — mieux que le
run 1, qui n'a jamais dépassé 0. Mais **la fuite reste l'optimum local dominant** : passé ce pic,
`kills_per_episode` retombe à 0 en même temps que `death_rate` continue de baisser jusqu'à 0, et
l'agent se stabilise ~250k pas durant (700k→920k) sur une politique qui ne meurt jamais, ne tue jamais,
et se contente d'encaisser le malus de tick jusqu'au plafond de troncature (`ep_rew_mean` ≈ -18 à -20,
meilleur que toute tentative de combat imparfaite). Le leger sursaut de `death_rate` en toute fin
(0→0.16 sur les 80 derniers milliers de pas) sans regain de kills suggère une politique qui se degrade/
derive plutot qu'un reapprentissage utile.

**Conclusion** : le bonus de visée seul ne suffit pas — rien ne pousse encore l'agent à **se rapprocher**
d'un ennemi pour l'engager, il peut très bien continuer à l'éviter et n'avoir jamais l'occasion de viser
juste ou de travers. Confirme le point 2 discuté en session : il faut un bonus de rapprochement vers
l'ennemi (symétrique à celui déjà existant vers la sortie), pas seulement un bonus conditionné à un tir
qui ne se produit quasiment jamais si l'agent n'est jamais assez proche pour oser tirer.

**Décision** : garder le bonus de visée (v2) tel quel, ajouter un bonus de rapprochement vers l'ennemi
le plus proche pour le run 3 — un changement à la fois, comme convenu.

## Run 3 — `step1_reward_v3` (2026-08-08)

**Config** : identique aux runs 1-2. **Seul ajout** : bonus de rapprochement vers l'ennemi le plus
proche (`0.001` × pixels de rapprochement/step, tout état d'ennemi confondu), en plus du bonus de
visée du run 2 (conservé tel quel).

**Résultats (courbes `rollout/`, fenêtre glissante 100 épisodes)** :

| Pas | `death_rate` | `kills_per_episode` / `room_cleared_rate` | `success_rate` | `ep_rew_mean` |
|---|---|---|---|---|
| 0 | 0.95 | 0.05 | 0 | -259 |
| ~200k (1er succès) | 0.86 | 0.12 | 0.01 | -275 |
| ~325k–375k (**pic**) | ~0.83–0.85 | **~0.15–0.18** | **~0.15–0.16** | -103 à -180 |
| ~650k–700k | ~0.68–0.75 | ~0.06–0.10 | ~0.02–0.05 | -55 à -72 |
| ~900k–1M (fin) | 0.03–0.05 | **0** | **0** | -23 à -29 |

**Analyse** : nette avancée par rapport aux runs 1-2 — **le succès apparaît enfin** (jusqu'à 16% des
épisodes réussis au pic, ~325k-375k pas), en même temps que les kills. Mais le même schéma qu'au run 2
se reproduit ensuite : passé le pic, `kills_per_episode`/`success_rate` retombent progressivement à 0
en même temps que `death_rate` s'effondre vers 0 — l'agent **revient à la fuite pure** d'ici la fin de
l'entraînement (1M pas), pour la 3ᵉ fois consécutive.

**Point clé, plus précis que les runs précédents** : à son pic de performance (16% de réussite),
`ep_rew_mean` valait quand même **-103 à -180** — bien pire que le -20 à -30 de la politique de fuite
pure. Autrement dit, **même à son meilleur niveau observé, la stratégie "engager" rapporte moins en
espérance que "fuir"**, avec les coefficients actuels : sur ~85% d'épisodes qui se terminent quand même
par une mort, le malus de mort (-50) plus les tirs "à l'aveugle" (-5 chacun, or les munitions sont
illimitées donc rien ne limite le nombre de tentatives par épisode) pèsent largement plus que les gains
occasionnels (+100 kill, +500 succès). PPO maximise la récompense — il est donc cohérent qu'il
abandonne l'engagement dès que l'exploration (entropie) diminue, même après l'avoir "découvert".
Le déclencheur n'est plus seulement "rien ne pousse à s'approcher" (réglé par ce run) mais
**"même en s'approchant et en tentant sa chance, le calcul reste défavorable"**.

**Décision** : conserver le bonus de rapprochement (run 3) et le bonus de visée (run 2). Prochain
changement candidat (à discuter) : réduire le poids du malus de tir "à l'aveugle" (-5, qui peut
s'accumuler de nombreuses fois par épisode vu les munitions illimitées) et/ou réduire le malus de mort
(-50, du même ordre de grandeur qu'un kill +100) pour que l'espérance de gain de l'engagement dépasse
enfin celle de la fuite, même à faible taux de réussite.

## Run 4 — `step1_reward_v4` (2026-08-08) — 🎉 premier run qui converge vers l'objectif

**Config** : identique aux runs 1-3. **Changement (double, décision explicite du user)** :
`reward_shot_wild_penalty` `5.0 → 2.0`, `reward_death_penalty` `50.0 → 10.0`.

**Résultats (courbes `rollout/`, fenêtre glissante 100 épisodes)** :

| Pas | `death_rate` | `kills_per_episode` / `room_cleared_rate` | `success_rate` | `ep_rew_mean` |
|---|---|---|---|---|
| 0 | 1.0 | 0 | 0 | -93 |
| 300k | 0.92 | 0.19 | 0 | -50 |
| 500k | 0.85 | 0.23 | 0 | -18 |
| 600k (1ers succès) | 0.75 | 0.33 | 0.03 | +50 |
| 700k | 0.63 | 0.39 | 0.37 | +200 |
| 850k | 0.61 | 0.42 | 0.39 | +215 |
| 1 000 000 (fin) | **0.48–0.52** | **0.50–0.55** | **0.48–0.52** | **+280 à +305** |

**Analyse** : **aucun effondrement cette fois** — progression quasi monotone sur tout l'entraînement,
`ep_rew_mean` passe négatif → positif vers 550k-600k pas et continue de grimper jusqu'à la fin (encore
en légère hausse à 1M, pas clairement saturé). Contrairement aux runs 2-3, `kills_per_episode` et
`success_rate` n'ont jamais rechuté après leur premier décollage. `death_rate` reste élevé (~50%) mais
stable/en lente baisse, pas de sur-prudence de repli vers la fuite : le compromis risque/gain est
maintenant favorable à l'engagement, comme espéré.

**Décision** : hypothèse confirmée — le malus de mort (-50) et le cumul des malus de tir à l'aveugle
(-5 × un nombre non borné de tentatives) rendaient l'engagement non rentable en espérance ; les réduire
suffit à faire basculer l'optimum appris. Modèle sauvegardé (`models/step1_reward_v4/final_model.zip`,
meilleur modèle dans `models/step1_reward_v4/best/`). La courbe n'étant pas clairement saturée à 1M
pas, poursuivre l'entraînement de ce modèle pourrait encore améliorer `death_rate`/`success_rate` avant
de changer autre chose — à discuter avec le user (session du 2026-08-08).

## Run 4 (suite) — `step1_reward_v4_to2M` (2026-08-08)

**Config/reward** : identiques au run 4, reprise depuis `models/step1_reward_v4/final_model.zip`
(`--init-model`, `reset_num_timesteps=False`) pour +1M de pas (cumul 2M). Décision de continuer plutôt
que de passer à l'étape 2 du curriculum tout de suite : l'agent mourait encore ~50% du temps face à un
seul ennemi, ajouter des ennemis sur une base fragile aurait probablement fait régresser plutôt que
progresser.

**Résultats (courbes `rollout/`, fenêtre glissante 100 épisodes)** :

| Pas (cumulé) | `death_rate` | `kills_per_episode` / `room_cleared_rate` | `success_rate` | `ep_rew_mean` |
|---|---|---|---|---|
| 1,00M (reprise) | 0.48–0.52 | 0.50–0.55 | 0.48–0.52 | +280 à +305 |
| 1,09M | 0.33–0.41 | 0.62–0.68 | 0.59–0.65 | +349 |
| **2,00M (fin)** | **0.10–0.14** | **0.91** | **0.86–0.90** | **+520** |

**Analyse** : progression très rapide et franche dès la reprise — **90% de réussite** à la fin, contre
50% au checkpoint de départ. Aucun signe de rechute cette fois. Poursuivre encore pourrait affiner
davantage `death_rate` (10-14%, encore la principale marge de progression), mais le seuil est déjà très
solide pour une carte fixe à 1 ennemi.

**Point notable a creuser** : l'évaluation déterministe interne (`EvalCallback`, `deterministic=True`,
même carte figée) donne un résultat très différent des statistiques d'entraînement — `eval/mean_reward`
≈ -14.5, épisode qui va jusqu'au bout (1500 pas) sans succès, alors que `rollout/success_rate` (basé
sur les actions échantillonnées, stochastiques) est à 0.86-0.90 au même moment. Hypothèse : l'action
"moyenne" (déterministe) de la politique tombe peut-être dans un cycle stable (ex. orbite autour de
l'ennemi sans jamais aligner le tir) que le bruit d'échantillonnage stochastique suffit à briser. À
vérifier en regardant l'agent jouer en mode stochastique vs déterministe (`watch_agent.py
--stochastic`).

**Décision** : modèle `models/step1_reward_v4_to2M/final_model.zip` retenu comme référence de l'étape
1 du curriculum. Prochaine étape à discuter : passer à l'étape 2 (plus d'ennemis / carte aléatoire) ou
creuser l'écart déterministe/stochastique d'abord.

## ⚠️ Bug critique découvert en regardant l'agent jouer (2026-08-08) : traversée de murs

En observant l'agent jouer (`watch_agent.py`), constat visuel : le joueur traverse les murs. **Cause** :
`_apply_player_movement` bloquait le mouvement via `compute_player_axis_blocks`, qui compare des
positions en pixels de façon **exacte** (`mur.left == joueur.left + joueur.width`). Cette égalité
stricte n'est correcte que si le joueur se déplace toujours par pas exacts de `PLAYER_MOVE_VEL` (5px,
vrai au clavier : une touche = un pas fixe). Une action continue d'agent (magnitude/angle quelconques)
peut désaligner le joueur de la grille de 5px, et la vérification d'égalité stricte rate alors le mur
au lieu de bloquer le mouvement — le joueur s'enfonce dedans, frame après frame.

**Correctif** : `_apply_player_movement` applique maintenant le déplacement de façon tentative, puis
l'annule en cas de **chevauchement réel** (pas juste un contact exact au pixel près) avec un mur ou un
ennemi — même principe que le glissement le long des murs déjà utilisé pour les ennemis. Comportement
clavier (mode humain) inchangé (vérifié par re-test). `compute_player_axis_blocks` n'est plus utilisée
mais laissée dans `classes_functions.py`. Régression ajoutée en garde permanente dans `check_env.py`
(vérification 5).

**Impact sur le run 4** : en ré-évaluant le modèle `models/step1_reward_v4_to2M/final_model.zip`
(200 épisodes, actions stochastiques, environnement corrigé) :

| Métrique | Mesuré pendant l'entraînement (bug présent) | Ré-évalué apres correction |
|---|---|---|
| `death_rate` | 10-14% | **99%** |
| `success_rate` | 86-90% | **0%** |
| `kills/épisode` | 0.91 | **0.01** |

**Conclusion** : le run 4 n'a quasiment rien appris de la mécanique de combat/navigation réelle — il a
appris à exploiter la traversée de murs pour rejoindre l'ennemi/la sortie directement. Le modèle
`step1_reward_v4_to2M` est **invalidé comme preuve de compétence de combat**, même si la fonction de
reward v4 (malus de mort/tir réduits) reste probablement une bonne piste — il faut ré-entraîner à
partir de zéro avec l'environnement corrigé pour le savoir.

**Désaccord noté (user)** : le user estime que l'agent a quand même appris une partie du combat en
parallèle de l'exploitation du bug (pas uniquement le bug), même s'il n'y arrive plus une fois les
règles corrigées — position raisonnable, seul un nouveau run propre permet de trancher. D'où le run 5.

## Run 5 — `step1_reward_v4_fixed` (2026-08-08, en cours)

**Config/reward** : identique au run 4 (reward v4 : `reward_shot_wild_penalty=2.0`,
`reward_death_penalty=10.0`). **Différence** : environnement avec le bug de traversée de murs corrigé,
entraînement repris **à partir de zéro** (pas une reprise de checkpoint, pour ne garder aucune trace de
la stratégie basée sur le bug). 2M pas d'emblée (au lieu de 1M + reprise à 2M comme le run 4) puisqu'on
sait déjà que la reward v4 a besoin de ~1,5-2M pas pour bien converger.

**Résultats (courbes `rollout/`, fenêtre glissante 100 épisodes)** :

| Pas | `death_rate` | `kills_per_episode` / `room_cleared_rate` | `success_rate` | `ep_rew_mean` |
|---|---|---|---|---|
| 0 | 1.0 | 0 | 0 | -94 |
| 500k | 0.87–0.91 | 0.10–0.13 | 0 | -30 à -80 |
| 1,00M | 0.70–0.73 | 0.28–0.31 | 0 | +27 à +34 |
| 1,50M | 0.28–0.33 | 0.66–0.72 | 0 | +83 à +89 |
| **2,00M (fin)** | **0.12** | **0.91** | **0** | **+123** |
| `ep_len_mean` (fin) | 1,38e3 (sur un plafond de 1500) | | | |

**Analyse** : progression saine et sans effondrement, comme le run 4, mais **plus lente** au départ
(`success_rate` du run 4 apparaissait dès ~600k pas ; ici toujours à 0 à 1M). En fin de run, le combat
est excellent et **authentique cette fois** (91% de pièces nettoyées, 12% de morts, sans exploit) — au
moins aussi bon que les chiffres (gonflés) du run 4. **Mais `success_rate` reste à 0 sur l'intégralité
des 2M pas**, alors même que la pièce est nettoyée 91% du temps : `ep_len_mean` (1380, proche du
plafond de troncature 1500) indique que l'agent survit la quasi-totalité de l'épisode sans jamais
atteindre la sortie après avoir tué l'ennemi — il n'y a apparemment aucune urgence/incitation
suffisante à finir le trajet jusqu'à la zone de sortie une fois la menace éliminée.

**Conclusion** : la fonction de reward v4 (+ bonus de rapprochement ennemi du run 3) suffit largement à
apprendre le combat proprement dit ("nettoyer la pièce" — validé, 91%, sans triche). Mais **"sortir"
n'est manifestement pas assez incité** : le bonus de rapprochement vers la sortie (`0.1` × progression,
actif seulement hors `chase`) est trop faible pour driver une navigation complète du labyrinthe une
fois la menace neutralisée, sur un horizon de récompense aussi long. Résultat probablement conforme à
ce qui avait été anticipé dans `docs/agent_ia_design.md` ("l'exploration/la sortie n'est pas ce qu'on
évalue en priorité à ce stade"), mais confirmé de façon beaucoup plus nette qu'attendu (0% pile, pas
juste faible).

**Décision** : modèle `models/step1_reward_v4_fixed/final_model.zip` retenu comme référence **valide**
(non basée sur un exploit) de combat pour l'étape 1. Le combat est acquis ; reste à décider avec le
user si on pousse le renforcement du rapprochement vers la sortie (ou une autre incitation à finir le
parcours) avant de passer à l'étape 2 du curriculum, ou si on considère "nettoyer la pièce" comme
suffisant pour l'instant et qu'on avance quand même.

## Observation visuelle du run 5 (`watch_agent.py --stochastic`) et corrections associées (2026-08-08)

**Observation utilisateur** : l'agent tue l'ennemi quasiment à chaque fois, mais "campe" — il vise et
tire sur place, laisse l'ennemi (alerté) venir à lui, ne va jamais lui-même au contact. Question posée :
l'agent a-t-il conscience des murs pour se diriger vers l'ennemi ?

**Diagnostic** : non, seulement conscience locale (case courante, connectivité N/S/E/W). La direction
vers l'ennemi (bonus de rapprochement du run 3 + "menace prioritaire" de l'observation) était une
**ligne droite**, ignorant les murs. Camper coûte peu (bonus de visée fiable, +2 par tir aligné) et
rapporte presque autant que foncer sur l'ennemi (bonus de rapprochement minuscule, ligne droite en plus
donc parfois inexploitable) — le camping est l'optimum sous cette fonction de reward.

**Découverte en creusant** : la direction vers la **sortie** (`goal_hint`) avait exactement le même
défaut — ligne droite vers le centre de la `zone`, ignorant les murs, alors que ce document affirmait
depuis le run 1 qu'elle utilisait un flow field (seule la *distance* l'utilisait en réalité). Peut
expliquer une partie du 0% de succès du run 5.

**Corrections apportées** (détaillées dans `docs/agent_ia_design.md` §3, "v5") :
1. Direction vers la sortie : ligne droite → flow field (`_flow_field_direction`), corrige un bug
   présent depuis le run 1.
2. Direction vers l'ennemi + bonus de rapprochement (`reward_enemy_approach_scale`) : ligne droite →
   flow field depuis la cellule de l'ennemi le plus proche (tout état confondu), recalculé chaque step.
   `reward_enemy_approach_scale` : `0.001` (px) → `0.1` (sauts de cellule, même échelle que la sortie).
3. Bonus de visée (`_shot_aim_quality`) : ne compte plus un ennemi comme "bien visé" si un mur bloque
   la ligne de vue (`has_line_of_sight`) — tirer sur un ennemi caché ne le touchera jamais, ne doit pas
   être récompensé comme un engagement (demande explicite du user).
4. Ajout d'un flag de debug `debug_show_directions` (jamais actif par défaut) : deux flèches sur le
   rendu (bleu = sortie, orange = ennemi le plus proche), utilisable via
   `watch_agent.py --debug-directions` pour vérifier visuellement le pathfinding.
5. Corrigé au passage : `watch_agent.py` affichait le nombre de kills du dernier pas seulement (se
   remet à 0 à chaque step) au lieu du cumul de l'épisode — cause du "kills=0" affiché à l'écran malgré
   des kills bien réels pendant l'épisode. Cosmétique, sans impact sur l'entraînement.

**Décision** : ces trois corrections visent directement le problème observé (camping) et un bug
préexistant sur la sortie — relance d'un run 6, même reward v4 (malus mort/tir) + ces corrections,
2M pas d'emblée (comme le run 5). Vérifications automatisées (`check_env.py`, smoke tests) repassées
avant relance, tout est vert.

## Run 6 — `step1_reward_v5` (2026-08-08) — interrompu par le user, régression vs run 5

**Config/reward** : identique au run 5 (reward v4 : malus mort `10.0`, malus tir sauvage `2.0`), plus
les corrections ci-dessus (directions conscientes des murs pour la sortie ET l'ennemi, ligne de vue
exigée pour le bonus de visée, `reward_enemy_approach_scale` recalibré à `0.1`). Environnement de bug
de traversée de murs toujours corrigé (run 5). 2M pas visés, à partir de zéro. **Coupé par le user à
1,9M pas** (jugé mauvais en cours de route, pas de `final_model.zip`).

**Résultats (courbes `rollout/`, fenêtre glissante 100 épisodes, jusqu'au dernier point à 1,92M pas)** :

| Pas | `death_rate` | `kills_per_episode` / `room_cleared_rate` | `ep_len_mean` | `ep_rew_mean` | `eval/mean_reward` (déterministe) |
|---|---|---|---|---|---|
| 16k | 1.00 | 0.00 | 559 | -107 | — |
| 130k–300k (**pic**) | 0.9–0.95 | **~0.08–0.12** | ~700–900 | ~-20 à -27 | -15.0 (déjà figé) |
| 500k | 0.58 | 0.02 | 1190 | -16 | -15.0 |
| 900k | 0.35 | **0.00** | 1348 | -18 | -15.0 |
| 1,4M–1,92M (fin) | 0.01–0.40 | **0.00** | 1350–1495 | -15 à -17 | **-14.8** (identique du début à la fin) |

`train/std` (bruit d'exploration) reste stable ~0,9–1,1 tout du long (pas d'effondrement d'entropie).

**Analyse** : régression nette par rapport au run 5 (91% de pièces nettoyées à 2M pas) — retour au
schéma "fuite" des runs 1-3, mais cette fois **sans percée** : un mini-pic de kills (~10%) vers
130k-300k pas, puis déclin continu jusqu'à 0 vers 900k pas, sans plus jamais bouger sur le million de
pas suivant. Point le plus parlant : `eval/mean_reward` (politique déterministe) est resté figé à
**-14.8/-15.0 de l'étape 25k jusqu'à 1,92M** — exactement la valeur "fuite pure" (malus de tick sur un
épisode qui va au bout du plafond de troncature) — l'action moyenne de la politique s'est verrouillée
sur l'évitement quasiment dès le début et n'en a plus jamais bougé, alors que le bruit d'exploration
(`train/std`) restait actif tout du long.

**Vérification faite suite à une question du user** : le user pensait la seed d'entraînement fixe d'un
run à l'autre (donc la variance de seed exclue comme explication). Vérifié faux — `train_ppo.py`
instancie `PPO(...)` **sans `seed=`**, donc seule la carte est fixée (`map_seed=0` via `random.seed`
dans `_new_game`) ; l'init du réseau et l'échantillonnage stochastique des actions (RNG torch/numpy) ne
sont pas figés d'un run à l'autre. La variance seed-à-seed n'est donc **pas** exclue comme explication
de l'écart run 5 / run 6, en plus des 2 changements de reward introduits entre les deux runs
(`reward_enemy_approach_scale` : ligne droite en px → flow field en sauts de cellule ; bonus de visée :
ligne de vue désormais exigée). Le 3ᵉ changement du run 6 (direction `goal_hint`) ne touche que
l'observation, pas la reward.

**Décision** : relancer un run à l'identique du run 6 (même config/reward/corrections, nouveau tirage
PPO) pour voir si le résultat se reproduit avant d'accuser les 2 changements de reward — cf. run 7.

## Run 7 — `step1_reward_v5_retry` (2026-08-08) — confirme la régression, pas de la variance de seed

**Config/reward** : strictement identique au run 6 (même reward v4 + corrections murs/ligne de vue),
nouveau tirage PPO (pas de `seed=` fixé dans `PPO(...)`, seule la carte est figée via `map_seed=0`).
2M pas, jusqu'au bout cette fois (pas interrompu).

**Résultats (courbes `rollout/`)** :

| Pas | `death_rate` | `kills_per_episode` | `success_rate` | `ep_rew_mean` |
|---|---|---|---|---|
| 16k | 1.00 | 0.00 | 0 | -108 |
| 508k | 0.88 | 0.03 | 0 | -17 |
| 1,02M | 0.13 | 0.00 | 0 | -16 |
| 1,52M | 0.07 | 0.00 | 0 | -15 |
| 2,00M (fin) | 0.39 | 0.01 | 0 | -18 |

**Analyse** : reproduit le run 6 — `kills_per_episode` et `success_rate` restent quasiment à 0 sur toute
la durée, `ep_rew_mean` se stabilise autour de la valeur "fuite pure" (~-15 à -18). **Conclusion : ce
n'est pas la variance de seed** (2 tirages différents, même résultat) — la régression vient bien des 2
changements de reward introduits entre le run 5 et le run 6 (`reward_enemy_approach_scale` en flow
field, bonus de visée avec ligne de vue exigée), et/ou d'un problème plus structurel de densité du
signal de rapprochement (cf. observation utilisateur ci-dessous).

**Observation utilisateur (`watch_agent.py --stochastic --debug-directions`)** : l'agent tourne sur
lui-même sans se déplacer, quel que soit l'épisode. Diagnostic : le bonus de rapprochement
(`reward_enemy_approach_scale`/`reward_goal_approach_scale` = `0.1` par **saut de cellule entier**, donc
~1 seule fois tous les ~20 steps à la vitesse de déplacement du joueur) est extrêmement sparse et faible
comparé au bonus de visée (`+2`/`-2` par tir, obtenu sans bouger) — la politique n'a presque aucune
incitation à apprendre un déplacement précis vers la cible. Combiné à un spawn joueur/ennemi
potentiellement à plusieurs cellules de distance sur la carte actuelle (8×6, `map_seed=0`), l'agent a
statistiquement très peu d'occasions de se rapprocher suffisamment pour apprendre quoi que ce soit.

**Décision** : revoir le curriculum étape 1 à la base plutôt que continuer à ajuster la reward sur la
carte actuelle — nouveau stage 0 : petite salle fixe, spawn joueur/ennemi proches, ennemi avec IA
normale (patrol/alerted/chase/sees/hears) mais arme forcée à la **batte** (pas de tir instantané à
distance si l'ennemi se retourne), dos tourné au joueur au spawn. Un mur partiel au centre de la salle
pour ajouter un peu de couverture. Le bonus de rapprochement sera aussi revu (piste ouverte, pas encore
tranché). Auto-curriculum (progression de la difficulté pilotée par les métriques pendant
l'entraînement) mis en pause : la salle est d'abord vérifiée manuellement en jouant dessus avant de
brancher quoi que ce soit côté agent.

## Stage 0 ajouté : petite salle d'engagement (`create_simple_room`, 2026-08-09)

**Implémenté** (cf. `classes_functions.py`, `env.py`, `game.py`, `train_ppo.py`) : salle fixe 3×2
cellules (300×200px), murs en périphérie + mur partiel de couverture au centre (moitié haute
seulement, passage ouvert en bas), joueur spawné à gauche, ennemi spawné à droite (~180px, IA normale
patrol/alerted/chase/vue/ouïe, dos tourné au joueur au spawn, arme forcée à la batte). Flag
`HotlineEnvConfig.simple_room` (+ `simple_room_mid_wall`, `simple_room_enemy_weapon`), jamais actif par
défaut. `game.py --simple-room [--single-weapon] [--no-mid-wall]` pour tester en mode humain,
`train_ppo.py --simple-room [--no-mid-wall]` pour entraîner dessus. **Vérifié manuellement par le user
en jouant** (`game.py --simple-room --single-weapon`, loadout identique à l'agent) — jugé correct,
validation donnée pour lancer un run dessus.

**Ce qui n'a PAS été changé/résolu, à garder en tête pour la suite** :
- **Le bonus de rapprochement reste probablement trop faible/grossier** (`reward_enemy_approach_scale
  = 0.1` par saut de cellule ENTIER, donc ~1 fois tous les ~20 steps à la vitesse du joueur — diagnostic
  détaillé au run 7 ci-dessus). Ce run 8 change uniquement la carte (salle proche) et **garde la reward
  v4/v5 telle quelle** (aucun changement de coefficient), pour isoler l'effet de la distance de spawn
  de celui de la reward — un changement à la fois, comme d'habitude. Si `kills_per_episode` progresse
  mais reste fragile/lent, retoucher `reward_enemy_approach_scale` (magnitude et/ou granularité, ex.
  distance en pixels lissée plutôt qu'en sauts de cellule entiers) sera le candidat suivant.
- **Auto-curriculum** (augmenter automatiquement la difficulté — taille de salle, distance de spawn, IA
  ennemie — en fonction des métriques glissantes pendant l'entraînement, plutôt que de lancer un run par
  stage à la main) : demandé par le user, **pas encore implémenté**. Prochaine étape une fois ce stage 0
  validé.
- Le doute sur la flèche de debug (`--debug-directions`) pointant "tout droit vers l'ennemi" n'a pas été
  vérifié visuellement par Claude (screenshot refusé par le user) — probablement un faux positif
  (flow field correct quand joueur/ennemi sont dans des cellules adjacentes reliées par un passage
  ouvert, cf. analyse du run 6), mais pas formellement confirmé.
- `simple_room` ignore `enemy_count` (toujours exactement 1 ennemi) et `fixed_map`/`map_seed` n'ont
  aucun effet sur la géométrie de la salle (déterministe, pas de `random.*` dans `create_simple_room`).

## Run 8 — `step1_simple_room` (2026-08-09, en cours)

**Config** : `curriculum_step1_config` + `simple_room=True` (mur central actif), sinon identique aux
runs précédents (`single_weapon=True`, `goal_hint=True`, `map_seed=0`, `max_episode_steps=1500`).
**Reward inchangée** (v4/v5 : malus mort `10.0`, malus tir sauvage `2.0`, bonus visée avec ligne de vue,
bonus de rapprochement en flow field `0.1`/saut). 1 000 000 pas, à partir de zéro.

**Objectif** : isoler l'effet du rapprochement spawn joueur/ennemi (vs. la carte labyrinthe où ils
peuvent être à plusieurs cellules l'un de l'autre) sur l'apparition du combat, avant de toucher à la
reward elle-même.

**Résultats (courbes `rollout/`, terminé, pas interrompu)** :

| Pas | `death_rate` | `kills_per_episode` / `room_cleared_rate` | `success_rate` | `ep_rew_mean` | `ep_len_mean` |
|---|---|---|---|---|---|
| 16k | 0.71 | 0.29 | 0.04 | +16 | 537 |
| 262k | 0.63 | 0.37 | 0.37 | +208 | 72 |
| 524k | 0.42 | 0.58 | 0.58 | +338 | 70 |
| 771k | 0.18 | 0.82 | 0.82 | +486 | 81 |
| **1,02M (fin)** | **0.02** | **0.98** | **0.98** | **+586** | 67 |

**Analyse** : succès net, **premier run sans le moindre effondrement**, progression quasi monotone du
début à la fin sur les 3 métriques (`death_rate` en baisse continue, `kills`/`room_cleared`/`success`
en hausse continue, jamais de rechute). 98% de réussite (nettoyer + sortir) à 1M pas, contre un plafond
de 91% de pièces nettoyées et **0% de sortie atteinte** au meilleur run précédent (run 5, 2M pas sur le
labyrinthe). `ep_len_mean` s'effondre de ~537 à ~65-80 (la salle est minuscule, un épisode se résout
vite dans un sens ou dans l'autre) — cohérent avec des `ep_rew_mean` bien plus élevés qu'avant (moins de
malus de tick cumulé par épisode, plus de bonus de succès/kills proportionnellement).

**Conclusion** : confirme sans ambiguïté l'hypothèse du run 7 — le facteur dominant qui bloquait tous
les runs précédents était la **distance de spawn / la rareté du signal de rapprochement** sur le
labyrinthe, pas la reward elle-même (reward v4/v5 inchangée ici et ça suffit largement une fois la
salle réduite). Le bonus de rapprochement resterait sans doute à revoir pour généraliser au labyrinthe
complet plus tard (toujours pas fait, cf. section précédente), mais ce n'est plus le facteur limitant
pour ce stage.

**Modèle retenu** : `models/step1_simple_room/final_model.zip`.

## Stages 2 et 3 préparés (pas encore entraînés, 2026-08-09)

À la demande du user, deux variantes supplémentaires de salle sont prêtes (mêmes garanties : flag
`simple_room=True` + `room_stage`, jamais actives par défaut, `check_env.py` intégralement vert) :

- **`room_stage=2`** (`create_room_stage2`) : salle 1 (identique au stage 1, ennemi 1/batte, mur de
  couverture bloquant le haut) reliée par un couloir d'une case à une **salle 2** contenant un
  **deuxième ennemi (batte)**, derrière un mur de couverture **miroir** (bloque le bas cette fois,
  passage ouvert en haut) — variation volontaire pour ne pas laisser l'agent apprendre "le passage est
  toujours du même côté".
- **`room_stage=3`** (`create_room_stage3`) : même squelette (salle 1 + couloir + salle 2), mais le
  couloir est allongé (deux cases) et le **deuxième ennemi est déplacé DANS le couloir**, armé d'un
  **pistolet** au lieu d'une batte — première confrontation à une menace à distance, dans un corridor
  qui oblige à s'exposer pour avancer. La salle 2 ne sert plus que de destination (zone de sortie), son
  mur de couverture est conservé pour la cohérence visuelle mais ne protège plus rien. **Modifié à la
  demande du user (2026-08-09)** : le couloir est désormais **vertical** (descend de la salle 1 vers la
  salle 2, en dessous, au lieu d'à droite) et le deuxième ennemi y patrouille **verticalement**
  (haut/bas, `horizontal_walk=0`) au lieu d'horizontalement — porte de sortie de la salle 1 déplacée du
  côté droit vers le bas (colonne du milieu) pour rester alignée sur le couloir. Vérifié : `nav_graph`
  symétrique et connecté, `check_env.py` vert, smoke test headless sans erreur.

Testables en mode humain : `game.py --simple-room --single-weapon --room-stage 2` (ou `3`).
Entraînables via `train_ppo.py --simple-room --room-stage 2` (ou `3`). **Pas encore lancés** — à faire
une fois le stage 1 validé/discuté avec le user (progression naturelle du curriculum : 1 ennemi proche
→ 2 ennemis mêlée → 2e ennemi à distance, avant de revenir au labyrinthe complet).

## ⚠️ Bug trouvé par le user en jouant : le flow field de poursuite ignorait les murs de couverture (2026-08-09)

**Observation user** (`game.py --room-stage 2/3`, en jouant manuellement) : un ennemi en `chase`, avec
un mur entre lui et le joueur, essaie de foncer tout droit dedans au lieu de contourner par le passage
ouvert — comme si le BFS n'était pas calculé. Confirmé absent sur le labyrinthe standard
(`create_map_broadsearch`), présent sur les salles 1 et 2.

**Cause** : les murs de couverture (`mid_wall` du stage 1, mur miroir des stages 2/3) étaient placés au
**milieu d'une case** (ex. `x=140-160`, au milieu de la case (1,0) qui va de x=100 à x=200), alors que
`nav_graph` raisonne à la granularité de la case (100px) et ne peut représenter qu'une case reliée ou
non à sa voisine — un mur qui coupe une case *en deux en son milieu* lui est invisible.
`create_map_broadsearch` n'a jamais ce problème car ses murs sont TOUJOURS poses exactement sur une
frontière de case (`coordinates_to_wall`), jamais au milieu.

**Outil de diagnostic ajouté en premier, à la demande du user** : `debug_show_flow_field` (cf.
`HotlineEnvConfig`, `game.py`/`watch_agent.py --debug-flow-field`) — affiche une flèche verte sur
CHAQUE case atteignable vers sa case voisine dans le flow field de poursuite partagé (le même que
`enemy.walk()` consulte en `chase`, recalculé chaque frame depuis la case du joueur), plus un point
rouge sur la case source. Distinct de `debug_show_directions` (une seule flèche, vers la sortie/menace
prioritaire) : celui-ci montre le BFS dans son intégralité, utile pour repérer un trou de routage.

**Correctif** : murs de couverture repositionnés exactement sur une frontière de case (stage 1 :
frontière `(1,0)|(2,0)` ; stage 2 salle 2 : `(5,1)|(6,1)` ; stage 3 salle 2 : `(6,1)|(7,1)`), et
`_grid_nav_graph` accepte désormais un ensemble `blocked_edges` pour couper exactement l'arête
correspondante. Vérifié : `nav_graph` symétrique et entièrement connecté depuis le spawn joueur sur les
3 stages (script de vérification ad hoc), `check_env.py` intégralement vert, smoke test headless (300
steps aléatoires) sans erreur sur les 3 stages.

**Impact sur le run 8** (`step1_simple_room`, 98% de réussite) : entraîné sur la version **buguée** de
la salle — l'ennemi pouvait rester bloqué à pousser contre son propre mur de couverture plutôt que de
contourner correctement, ce qui a pu **faciliter artificiellement** l'engagement (menace moins
compétente qu'elle ne devrait l'être), un peu comme l'exploit de traversée de mur du run 4 avait gonflé
son taux de réussite. **Le modèle `step1_simple_room/final_model.zip` n'est donc pas totalement fiable
comme mesure de compétence de combat** tant qu'il n'a pas été ré-évalué (ou ré-entraîné) sur
l'environnement corrigé — à faire avant de tirer des conclusions definitives sur le stage 1, et avant
de lancer les stages 2/3 (qui, eux, n'ont jamais été entraînés avec le bug, donc partent propres).

**Verification rapide faite** : reprise de `final_model.zip` sur l'environnement corrige (`room_stage=1`,
1 step mesure juste apres reprise, 1,03M pas cumules) -> `death_rate`/`success_rate` identiques a la fin
du run 8 (98%/2%), donc la competence semble reelle, pas juste un artefact du bug. Cette reprise a
ensuite ete arretee (le user voulait enchainer sur la room 2, pas continuer la room 1) au profit du run 9.

## Run 9 — `step1_room2` (2026-08-09, en cours)

**Config** : `curriculum_step1_config` + `simple_room=True, room_stage=2` (2 ennemis/battes, salle 1 +
couloir + salle 2 avec mur miroir, cf. section stages 2/3 ci-dessus), reprise depuis
`models/step1_simple_room/final_model.zip` (transfert depuis le modele stage 1 plutot que zero -
logique de curriculum). Reward inchangee (v4/v5). 1 000 000 pas supplementaires (cumul 2M).

**Resultats juste apres reprise (1,03M pas cumules)** : `death_rate=0.56`, `kills_per_episode=1.06`
(coherent, 2 ennemis), `room_cleared_rate=0.61`, `success_rate=0` (le modele stage 1 sait deja combattre
mais n'a pas encore appris a traverser le couloir/atteindre la sortie de la salle 2), `ep_rew_mean=+499`.

**Resultats finaux (2,03M pas cumules)** :

| Pas cumules | `death_rate` | `kills_per_episode` | `room_cleared_rate` | `success_rate` | `ep_rew_mean` |
|---|---|---|---|---|---|
| 1,03M (reprise) | 0.56 | 1.06 | 0.61 | 0 | +499 |
| 1,28M | 0.07 | 1.90 | 0.97 | 0.93 | +644 |
| **2,03M (fin)** | **0.02** | **1.98** | **1.00** | **0.98** | **+681** |

**Analyse** : succes net, transfert tres efficace depuis le modele stage 1 - `success_rate` depasse 90%
des les premieres ~250k pas supplementaires, sans effondrement, se stabilise a 98% en fin de run avec
quasiment toujours les 2 ennemis tues (`kills_per_episode` proche de 2.0). Confirme que l'approche
"reprendre le modele du stage precedent plutot que repartir de zero" fonctionne bien pour ce curriculum.

**Modele retenu** : `models/step1_room2/final_model.zip`.

## Run 10 — `step1_room3` (2026-08-09, en cours)

**Config** : `simple_room=True, room_stage=3` (couloir vertical, 2e ennemi au pistolet en patrouille
haut/bas, cf. redesign ci-dessus), reprise depuis `models/step1_room2/final_model.zip`. Reward
inchangee. 1 000 000 pas supplementaires (cumul 3,03M).

**Resultats au demarrage (2,03M-2,06M pas cumules)** : `death_rate` proche de 1.0 (0.99), `ep_len_mean`
~30 (mort quasi immediate), `kills_per_episode` 0.17-0.27, `success_rate` 0-0.01. Nettement plus dur
que la reprise du run 9 (qui demarrait deja a `ep_rew_mean` positif) - premiere confrontation du modele
a une menace a distance (pistolet) dans un corridor etroit, changement de nature de la difficulte (pas
juste "plus d'ennemis au corps a corps").

**Resultats finaux (3,03M pas cumules)** :

| Pas cumules | `death_rate` | `kills_per_episode` | `room_cleared_rate` | `success_rate` | `ep_rew_mean` |
|---|---|---|---|---|---|
| 2,05M (reprise) | 0.99 | 0.20 | 0.19 | 0.01 | +13 |
| 2,56M | 0.88 | 0.66 | 0.51 | 0.12 | +116 |
| 2,93M (pic) | 0.76 | 0.89 | 0.64 | **0.24** | +218 |
| **3,03M (fin)** | **0.86** | **0.86** | **0.67** | **0.14** | **+147** |

**Analyse** : progression reelle (`success_rate` 1%->24% au pic vers 2,93M), mais **pas stabilisee** en
fin de run - le dernier point retombe a 14% et `death_rate` remonte legerement (0.76->0.86). Pas une
chute nette et durable comme les effondrements des runs 1-3, plutot du bruit d'entrainement sur une
tache encore difficile et probablement pas assez de pas (1M) pour cette etape, contrairement aux stages
precedents qui avaient largement converge dans le meme budget. Premiere fois que le curriculum introduit
une menace a distance dans un espace etroit - changement de nature, pas seulement de quantite.

**Decision** : discuter avec le user avant de continuer - options : poursuivre l'entrainement depuis ce
checkpoint (encore 1M pas), ou observer l'agent jouer (`watch_agent.py --simple-room --room-stage 3`)
pour diagnostiquer ce qui coince avant de raller plus loin a l'aveugle.

## Curriculum etape 4 : lancer d'arme (`enable_throw`, 2026-08-09)

A la demande du user : reintroduction du lancer d'arme (`docs/agent_ia_design.md`, action exclue de la
v1, prevue en etape 4 du curriculum). Implemente dans `env.py`/`game.py`/`train_ppo.py`/`watch_agent.py` :

- **Action** : `HotlineEnvConfig.enable_throw` (defaut `False`, aucun changement si absent) fait passer
  l'espace d'action de `Box(-1,1,(5,))` a `Box(-1,1,(6,))` - 6e dimension `throw`, seuillee comme `fire`,
  declenche `throw_current_weapon(aim_pos=aim_target)`. **Casse la compatibilite de forme avec tous les
  modeles entraines avant ce flag** - decision actee avec le user de repartir de zero sur tout le
  curriculum plutot que de bricoler une reprise.
- **Ramassage reactive en `single_weapon`** quand `enable_throw=True` (sinon lancer = perdre son arme
  definitivement, aucune incitation a le faire - meme piege que le run 1).
- **Observation** : nouveau bloc "arme au sol la plus proche" (presence, direction cos/sin, distance
  normalisee), 4 dims, `OBS_DIM` 79->83 - toujours peuple (pas seulement si `enable_throw`), la politique
  etant un MLP sans memoire, elle ne peut pas savoir ou est tombee son arme sans que ce soit dans
  l'observation courante.
- **Reward** : `reward_throw_stun_bonus=5.0` quand un lancer etourdit un ennemi (sinon, comme le malus
  fixe de tir du run 1, rien n'incite l'agent a *tenter* un lancer).
- Verifie : `check_env.py` integralement vert (defaut inchange), smoke test avec `enable_throw=True` sur
  les 3 room_stage (formes d'action/observation correctes, 400 steps avec lancer force sans crash, item
  observe au sol apres un lancer).

**Plan de re-entrainement du curriculum complet (decision user)** : stage 1 de 0 a 1M pas, stage 2 de 1M
a 2M, stage 3 de 2M a 5M - memes paliers que la premiere fois (runs 8/9/10), transfert entre etapes
comme precedemment.

## Run 11 — `step1_throw` (2026-08-09, en cours)

**Config** : `simple_room=True, room_stage=1, enable_throw=True`, depuis zero (nouvel espace
d'action/observation, aucun transfert possible depuis `step1_simple_room`). 1 000 000 pas.

**Resultats au demarrage (16k pas)** : `death_rate=0.95`, `success_rate=0.02`, `ep_rew_mean=+1.8` -
coherent avec un demarrage aleatoire standard (comparable au run 8 a ce stade, malgre l'espace
d'action plus grand).

**Resultats finaux (1,02M pas)** :

| Pas | `death_rate` | `kills_per_episode` | `success_rate` | `ep_rew_mean` |
|---|---|---|---|---|
| 16k | 0.95 | 0.05 | 0.02 | +2 |
| 524k | 0.79 | 0.21 | 0.21 | +117 |
| **1,02M (fin)** | **0.49** | **0.51** | **0.51** | **+299** |

**Analyse** : progression reelle mais plus lente que le run 8 (stage 1 sans lancer, 98% a 1M pas) -
attendu, l'espace d'action/observation est plus grand (6 actions, 83 dims d'observation vs 5/79). Pas
de rechute, juste un budget de pas probablement insuffisant, comme le run 10 initial pour la room 3.

**Modele retenu** : `models/step1_throw/final_model.zip`. Decision : poursuivre le plan valide
(transfert vers stage 2) plutot que de prolonger le stage 1 tout de suite - a revisiter si le stage 2
peine a demarrer.

## Run 12 — `step2_throw` (2026-08-09, en cours)

**Config** : `simple_room=True, room_stage=2, enable_throw=True`, reprise depuis
`models/step1_throw/final_model.zip`. 1 000 000 pas supplementaires (cumul 2,02M).

**Resultats au demarrage (1,03M-1,06M pas cumules)** : `death_rate` 0.67-0.77, `kills_per_episode`
0.23-0.33, `success_rate` encore a 0 (coherent, doit apprendre 2 ennemis + traverser jusqu'a la sortie
avec la nouvelle capacite de lancer).

**Resultats finaux (2,03M pas cumules)** :

| Pas cumules | `death_rate` | `kills_per_episode` | `room_cleared_rate` | `success_rate` | `ep_rew_mean` | `ep_len_mean` |
|---|---|---|---|---|---|---|
| 1,03M (reprise) | 0.77 | 0.23 | 0.23 | 0 | +207 | 204 |
| 1,28M | 0.58 | 0.41 | 0.41 | 0 | +26 | 760 |
| 1,54M | 0.48 | 0.54 | 0.53 | 0 | +40 | 836 |
| **2,03M (fin)** | **0.54** | **0.52** | **0.51** | **0** | **+37** | **780** |

**Analyse - PROBLEME** : `success_rate` reste bloque a 0% sur toute la duree, alors que
`room_cleared_rate` progresse a ~51% - `ep_len_mean` explose (204->780-836, proche du plafond 1500)
pendant que `ep_rew_mean` s'effondre (+207->+37). Rappelle le run 5 historique (piece nettoyee, sortie
jamais atteinte), en pire, malgre le correctif flow field du run 6 toujours actif.

**Hypothese** : le bonus de lancer (`reward_throw_stun_bonus=5.0`) est peut-etre exploite en boucle -
lancer etourdit (+5, peu couteux), l'agent redevient poings, revient chercher son arme (guide par le
nouveau bloc d'observation), la reprend, relance... un cycle qui consomme le budget de steps sans
jamais finir le niveau, plutot qu'un vrai combo tactique lancer -> achever au corps a corps.

**Decision** : pause avant le stage 3 - a diagnostiquer (`watch_agent.py --enable-throw --room-stage 2`)
avant de continuer le plan a l'aveugle, cf. discussion avec le user.

**Modele produit (NON retenu)** : `models/step2_throw/final_model.zip` - bloque a 0% de succes, garde
uniquement comme trace, cf. diagnostic ci-dessous.

## Diagnostic visuel du run 12 (`watch_agent.py --debug-directions`, 2026-08-09)

**Observation user** : l'agent tue le premier ennemi, puis se coince dans un coin de la salle et attend
la fin de l'episode - il n'engage jamais le deuxieme ennemi ni ne cherche la sortie. **Confirme par les
logs** (8 episodes, stochastique) : 4/6 se terminent en troncature avec exactement 1 kill (tue l'ennemi
1, puis campe), 2/6 en mort (0 kill, mort avant le premier engagement). Aucun succes. Pas la boucle
lancer/recuperation soupconnee initialement - un vrai comportement de repli, comme le run 5 historique
mais en pire (n'attend meme pas que le 2e ennemi vienne).

**Reinterpretation** : le run 11 (stage 1 avec lancer) n'avait atteint que 51% de reussite a 1M pas
(vs 98% sans lancer) au moment du transfert vers le stage 2 - une base encore fragile poussee trop tot
sur une tache plus dure. Hypothese revisee : le probleme n'est pas forcement le bonus de lancer en
lui-meme, mais un stage 1 pas assez consolide avant transfert (meme mecanisme qui a bien fonctionne pour
la room 3 en la prolongeant, sauf qu'ici l'etape 1 elle-meme n'etait pas finie).

**Decision (user)** : prolonger le stage 1 avant de retransferer vers le stage 2, plutot que de pousser
le stage 2 tel quel ou d'ajouter un malus d'inactivite direct.

## Run 11 (suite) — `step1_throw_to2M` (2026-08-09, en cours)

**Config** : identique au run 11, reprise depuis `models/step1_throw/final_model.zip` (1,02M pas).
1 000 000 pas supplementaires (cumul 2,02M).

**Resultats au demarrage (1,03M pas cumules)** : `death_rate=0.48`, `success_rate=0.52` - coherent avec
la fin du run 11 (pas de rupture a la reprise).

**Resultats finaux (2,03M pas cumules)** :

| Pas cumules | `death_rate` | `kills_per_episode` | `success_rate` | `ep_rew_mean` |
|---|---|---|---|---|
| 1,03M (reprise) | 0.48 | 0.52 | 0.52 | +304 |
| 1,54M | 0.19 | 0.81 | 0.81 | +479 |
| **2,03M (fin)** | **0.01** | **0.99** | **0.99** | **+591** |

**Analyse** : progression saine et continue jusqu'au bout, aucune rechute - **99% de reussite, 1% de
morts**. Confirme l'hypothese : le stage 1 avec lancer avait juste besoin de plus de pas (comme le
stage 1 sans lancer avait fini par largement depasser son propre run initial), pas un probleme
structurel du bonus de lancer. Base beaucoup plus solide pour retransferer vers le stage 2.

**Modele retenu** : `models/step1_throw_to2M/final_model.zip`.

## Run 12 (v2) — `step2_throw_v2` (2026-08-09, en cours)

**Config** : identique au run 12, reprise depuis `models/step1_throw_to2M/final_model.zip` (base stage 1
consolidee a 99%, au lieu de 51% pour la premiere tentative). 1 000 000 pas supplementaires.

**Resultats au demarrage (2,05M-2,06M pas cumules)**, comparaison avec le run 12 initial au meme point :

| Metrique | Run 12 (base a 51%) | Run 12 v2 (base a 99%) |
|---|---|---|
| `death_rate` | 0.77 | 0.20-0.33 |
| `room_cleared_rate` | 0.23 | 0.92-0.95 |
| `kills_per_episode` | 0.23 | 1.42-1.56 |
| `success_rate` | 0 | 0 |

Nette amelioration du demarrage - confirme que la base stage 1 sous-entrainee etait bien le facteur
limitant du run 12 initial. `success_rate` encore a 0 (reste a apprendre a finir jusqu'a la sortie).

**Resultats finaux (3,05M pas cumules)** :

| Pas cumules | `death_rate` | `room_cleared_rate` | `kills_per_episode` | `success_rate` | `ep_rew_mean` |
|---|---|---|---|---|---|
| 2,05M (reprise) | 0.33 | 0.92 | 1.42 | 0 | +540 |
| 2,29M (pic) | 0.20 | **1.00** | 1.78 | 0 | +150 |
| **3,05M (fin)** | **0.53** | **0.60** | **1.06** | **0** | **+85** |

**Analyse - hypothese "base fragile" INVALIDEE** : `room_cleared_rate` atteint 100% a mi-parcours puis
**se degrade** jusqu'a 60% en fin de run, `death_rate` remonte, `ep_rew_mean` s'effondre.
`success_rate` reste a 0% sur l'integralite des DEUX tentatives de stage 2 avec lancer (run 12 et
run 12 v2), malgre une base stage 1 solide (99%) au demarrage de la v2 - la piste "juste pas assez
entraine" est donc ecartee.

**Nouvelle hypothese, plus ciblee** : si l'agent a lance son arme sans encore la recuperer au moment ou
le dernier ennemi meurt (poings en main), il a peut-etre appris un reflexe "se reequiper d'abord" qui
prend le pas sur "aller a la sortie", meme quand ce n'est plus utile (plus d'ennemi). Coherent avec
l'observation "coince dans un coin" du run 12 - possiblement coince a essayer de revenir vers son arme
lancee plutot que de foncer vers la sortie une fois desarme.

**Decision** : diagnostic visuel cible sur ce point precis (etat de l'arme du joueur au moment ou la
piece est nettoyee) avant de decider d'un correctif (ex. malus si l'agent reste immobile/loin de la
sortie alors que la piece est vide, ou revoir le bonus de lancer).

**Modele produit (NON retenu)** : `models/step2_throw_v2/final_model.zip` - meme blocage a 0% de succes.

## Pivot : randomisation du spawn stage 1 (2026-08-09)

**Hypothese du user** (avant meme la fin du diagnostic "arme au moment du clear", teste en parallele
mais interrompu par ce pivot) : le stage 1 tourne sur une carte totalement fixe (`map_seed=0`,
`fixed_map=True`) - a 99% de reussite, l'agent a tres probablement mémorise un trajet precis plutot
qu'un comportement general "reperer/engager/sortir", ce qui expliquerait l'echec systematique du
transfert vers room_stage=2 (une geometrie differente) malgre une base apparemment solide.

**Implemente** : `HotlineEnvConfig.simple_room_randomize_spawn` (defaut `False`) - joueur ET ennemi
spawnent a une position aleatoire n'importe ou dans la salle (room_stage=1 uniquement), sous contrainte
de distance minimale entre eux (90px) et d'evitement du mur de couverture/de la zone de sortie
(rejection sampling, `_random_room_point` dans `classes_functions.py`). Necessite `fixed_map=False`
(sinon `random.seed()` rejoue la meme position a chaque reset) - gere automatiquement par
`curriculum_step1_config(randomize_spawn=...)`. La direction de patrouille initiale de l'ennemi (dos
tourne) est desormais calculee dynamiquement (axe de plus grande separation) plutot que codee en dur,
puisque les positions varient.

**Iteration corrigee suite a un retour du user en testant** (`game.py --randomize-spawn`) : une
premiere version limitait le joueur a la moitie gauche de la salle et l'ennemi a la moitie droite -
jugee insuffisamment variee ("je respawn toujours au meme endroit"). Refonte : les deux spawnent
desormais n'importe ou dans TOUTE la salle (verifie : x/y couvrent quasiment toute la plage de la
salle sur 300 tirages, distance min. 90px toujours respectee, aucun chevauchement mur/zone).
Refactor associe : `create_simple_room` decide maintenant lui-meme le spawn joueur (au lieu de le
recevoir de `env.py`) et le retourne en 3e valeur, `_create_room_map` normalise ce contrat pour tous
les generateurs de carte (maze/room_stage 2/3 retournent leur spawn fixe habituel).

Verifie : `check_env.py` intégralement vert, smoke test sur les 3 stages (avec/sans randomisation),
couverture spatiale et contraintes de distance verifiees sur 300 resets, validation manuelle du user
en jouant (`game.py --simple-room --single-weapon --enable-throw --randomize-spawn`).

## Run 13 — `step1_throw_randspawn` (2026-08-09, en cours)

**Config** : identique au run 11/11-suite (stage 1, lancer actif), + `simple_room_randomize_spawn=True`
(donc `fixed_map=False`). Fine-tuning depuis `models/step1_throw_to2M/final_model.zip` (99% sur la
carte fixe). 1 000 000 pas.

**Resultats au demarrage (2,05M-2,06M pas cumules)** : `success_rate` chute a 0.42-0.47 (contre 99% sur
la carte fixe juste avant) - chute immediate et attendue, confirme que le modele precedent s'appuyait
au moins en partie sur la position fixe plutot que sur un comportement generalisable.

**Resultats finaux (3,05M pas cumules)** : progression reelle mais lente sur ce premier million de pas
de fine-tuning - `success_rate` 0.42->0.50, `death_rate` 0.55->0.46, `ep_rew_mean` 236->288. Pas
d'effondrement, mais loin des 99% de la carte fixe. Rappelle le pattern de la room 3 (progression lente
mais reelle, ayant fini par converger avec un budget de pas plus genereux).

**Decision (user)** : prolonger jusqu'a 8M pas cumules plutot que de s'arreter la, la generalisation
spatiale complete etant une tache nettement plus dure que la carte fixe - cf. run 13 (suite).

## Run 13 (suite) — `step1_throw_randspawn_to8M` (2026-08-09, en cours)

**Config** : identique au run 13, reprise depuis `models/step1_throw_randspawn/final_model.zip`
(3,05M pas). +4 968 384 pas pour atteindre 8M pas cumules.

**Resultats au demarrage (3,06M-3,07M pas cumules)** : `death_rate=0.48`, `success_rate=0.49` -
coherent avec la fin du run 13 (pas de rupture a la reprise).

**Resultats finaux (8,03M pas cumules)** :

| Pas cumules | `death_rate` | `kills_per_episode` | `success_rate` | `ep_rew_mean` |
|---|---|---|---|---|
| 3,06M (reprise) | 0.48 | 0.49 | 0.49 | +283 |
| 4,30M | 0.34 | 0.59 | 0.59 | +386 |
| 4,92M | 0.14 | 0.85 | 0.85 | +477 |
| 6,17M | 0.04 | 0.95 | 0.95 | +569 |
| **8,03M (fin)** | **0.00** | **0.99** | **0.99** | **+591** |

**Analyse** : progression continue et solide sur tout le run (aucune rechute), franchit le cap des 90%
vers 4,9M et se stabilise pres de 99-100% des 6-7M pas - confirme que **c'est cette fois une vraie
generalisation** (spawn joueur/ennemi/distance a la sortie tous aleatoires a chaque episode, donc pas
de memorisation possible d'un trajet fixe), contrairement au 99% precedent obtenu sur carte figee.
Nettement plus lent a converger que la carte fixe (99% des ~1M pas) mais le resultat final est
comparable en performance, avec une garantie de generalisation en plus.

**Modele retenu** : `models/step1_throw_randspawn_to8M/final_model.zip`. Base la plus solide obtenue a
ce stade pour retenter le transfert vers room_stage=2 (les deux precedentes tentatives etaient parties
d'une base carte-fixe potentiellement memorisee).

## Run 14 — `step2_throw_v3` (2026-08-09, en cours)

**Config** : identique aux runs 12/12v2, reprise depuis `models/step1_throw_randspawn_to8M/final_model.zip`
(base generalisee a 99%, spawn randomise). 2 000 000 pas cette fois (au lieu d'1M pour les tentatives
precedentes).

**Resultats au demarrage (8,04M-8,06M pas cumules)** : `death_rate=0`, `kills_per_episode=2`,
`room_cleared_rate=1.0` (100%) - transfert du combat quasi parfait des la reprise, nettement meilleur
que les deux tentatives precedentes (qui demarraient a 0.2-0.8 de mort, 20-50% de pieces nettoyees).
`success_rate` encore a 0 (reste a apprendre le trajet jusqu'a la sortie sur cette nouvelle geometrie).
A noter : `approx_kl` tres eleve au premier update (20.8, normalement ~0.01-0.02) - gros ajustement de
la fonction de valeur au changement de salle, a surveiller mais pas alarmant en soi a ce stade.

**Resultats finaux (10,04M pas cumules)** :

| Pas cumules | `death_rate` | `room_cleared_rate` | `kills_per_episode` | `success_rate` | `ep_rew_mean` | `ep_len_mean` |
|---|---|---|---|---|---|---|
| 8,04M (reprise) | 0.00 | 1.00 | 2.00 | 0 | +557 | 171 |
| 8,29M | 0.01 | 1.00 | 1.99 | 0 | +179 | 1486 |
| 9,55M | 0.30 | 0.90 | 1.60 | 0 | +140 | 1079 |
| **10,04M (fin)** | **0.04** | **0.96** | **1.92** | **0** | **+170** | **1441** |

**Analyse - 3e echec identique, hypothese "base non generalisee" ELIMINEE** : `room_cleared_rate` reste
excellent (90-100%, combat quasi parfait) mais `success_rate` retombe a 0% des le premier point de
mesure et n'en bouge plus jamais, `ep_rew_mean` s'effondre immediatement (+557->+179), `ep_len_mean`
explose (171->1400+). Meme symptome exact que les runs 12 et 12v2, cette fois avec une base *prouvee*
non-memorisee (spawn aleatoire sur les 8M pas precedents) - le probleme n'est donc PAS une question de
generalisation de la base. Il est specifiquement lie a `enable_throw` sur cette geometrie precise (le
run 9, sans lancer, avait reussi a 98% sur la meme salle room_stage=2).

**Modele produit (NON retenu)** : `models/step2_throw_v3/final_model.zip` - meme blocage a 0% de succes.

**Diagnostic proposé par le user (pas encore teste sur room_stage=2, applique au stage 1 a la place)** :
la zone de sortie du stage 1 n'a jamais ete randomisee (seuls le spawn joueur/ennemi l'etaient) - le
reseau a pu apprendre un raccourci "aller vers le pixel fixe (240,140)" plutot que reellement lire
`goal_hint` (direction relative), raccourci qui s'effondre des que la sortie change de position absolue
(room_stage=2). Coherent avec l'observation du run 12 : l'agent se coincait exactement a l'ancienne
position de la sortie du stage 1. Cf. section suivante pour le correctif (randomisation de la zone) et
`docs/agent_ia_design.md` pour le principe general (indice de direction cense etre utilise, pas mémorisé).

## Run 10 (suite) — `step1_room3_to5M` (2026-08-09)

**Config/reward** : identiques au run 10, reprise depuis `models/step1_room3/final_model.zip` (3,05M
pas), +1 968 384 pas pour atteindre exactement 5M pas cumules (decision user : poursuivre plutot que
diagnostiquer d'abord).

**Resultats au demarrage (3,06M-3,07M pas cumules)** : `death_rate` 0.81-0.83, `kills_per_episode`
0.84-0.86, `room_cleared_rate` 0.62-0.66, `success_rate` 0.17-0.19 - coherent avec la fin du run 10 (pas
de rupture a la reprise). A noter : `train/entropy_loss` (-0.42) et `train/std` (0.30) plus bas qu'aux
stages precedents a ce point d'entrainement - exploration deja assez reduite, a surveiller si
`success_rate` stagne au lieu de continuer a progresser.

**Resultats finaux (5,03M pas cumules)** :

| Pas cumules | `death_rate` | `kills_per_episode` | `room_cleared_rate` | `success_rate` | `ep_rew_mean` |
|---|---|---|---|---|---|
| 3,06M (reprise) | 0.83 | 0.86 | 0.66 | 0.17 | +161 |
| 3,80M | 0.58 | 1.32 | 0.86 | 0.42 | +336 |
| 4,55M | 0.49 | 1.52 | 0.95 | 0.51 | +399 |
| **5,03M (fin)** | **0.40** | **1.61** | **0.96** | **0.60** | **+457** |

**Analyse** : progression continue et solide jusqu'au bout, aucun signe de stagnation ni de rechute -
le run 10 initial (1M pas) etait simplement trop court pour cette etape plus difficile (menace a
distance dans un couloir etroit), contrairement aux stages precedents largement converges dans le meme
budget. `success_rate` 17%->60%, `room_cleared_rate` 96%, `death_rate` divise par deux (0.83->0.40).
`train/std` continue de baisser (0.30->0.18, politique plus confiante) sans freiner la progression -
l'inquietude notee sur l'exploration au demarrage de cette reprise ne s'est pas concretisee.

**Modele retenu** : `models/step1_room3_to5M/final_model.zip`.

## Pivot : randomisation de la zone de sortie, stage 1 (2026-08-09)

**Hypothese du user**, apres le 3e echec identique du transfert vers room_stage=2 (run 14) : la
randomisation du spawn (joueur/ennemi) ne suffisait pas car la **zone de sortie**, elle, restait a un
pixel fixe (`room_w-60, 140`) sur tout l'entrainement du stage 1 (8M pas). Rien n'obligeait donc le
reseau a vraiment lire `goal_hint` (direction relative, cos/sin) pour la rejoindre - un raccourci "aller
vers ce pixel absolu fixe" (en utilisant sa propre position absolue, egalement dans l'observation)
marchait tout aussi bien pendant l'entrainement et ne generalise evidemment pas a une sortie qui a
change de position (room_stage=2). Coherent avec l'observation du run 12 : l'agent se coincait beaucoup
plus a l'ancienne position fixe de la sortie du stage 1 qu'ailleurs dans la salle.

**Implemente** : `create_simple_room(randomize_spawns=True)` randomise desormais aussi la position de
la zone de sortie (n'importe ou dans la salle, meme mecanisme de rejection sampling que les spawns -
evite le mur de couverture, aucun chevauchement avec le spawn joueur/ennemi). Verifie : `check_env.py`
vert, test dedie (300 resets, zone couvrant quasiment toute la salle x:15-255/y:15-155, aucun
chevauchement), validation manuelle du user en jouant (`game.py --simple-room --single-weapon
--enable-throw --randomize-spawn`).

## Run 15 — `step1_throw_fullrand` (2026-08-09, en cours)

**Config** : identique au run 13 (stage 1, lancer, spawn randomise), + zone de sortie desormais
egalement randomisee. **Reprise depuis `models/step1_throw_to2M/final_model.zip`** (le checkpoint a 2M
pas, PAS le checkpoint a 8M du run 13 - decision explicite du user : repartir de la base la plus simple
plutot que d'empiler sur un modele deja specialise "spawn variable mais sortie fixe", pour eviter de
transporter un biais appris vers le raccourci de sortie fixe). 2 000 000 pas.

**Note** : une premiere tentative de ce run a demarre par erreur depuis `models/step1_throw_randspawn_to8M/`
(le mauvais checkpoint) - repérée et corrigee par le user avant que ca aille loin (stoppee a ~150k pas,
dossier `models/step1_throw_fullrand` d'origine supprime et recree proprement).

**Resultats au demarrage (2,03M pas cumules)** : `death_rate=0.65`, `success_rate=0.135`,
`room_cleared_rate=0.32`, `ep_rew_mean=+406` - chute par rapport a la fin du run 11-suite (99%),
attendue : la sortie n'a plus jamais ete a une position fixe, doit maintenant apprendre a
suivre `goal_hint` pour de vrai plutot que de recycler une position memorisee.

**Resultats finaux (4,05M pas cumules)** :

| Pas cumules | `death_rate` | `room_cleared_rate` | `success_rate` | `ep_rew_mean` |
|---|---|---|---|---|
| 2,05M (reprise) | 0.65 | 0.32 | 0.14 | +406 |
| 2,54M | 0.76 | 0.20 | 0.07 | +29 |
| 3,05M | 0.74 | 0.18 | 0.01 | -15 |
| **4,05M (fin)** | **0.72** | **0.22** | **0.04** | **+6** |

**Analyse - REGRESSION, pas juste lent** : tout se degrade simultanement sur les 2M pas -
`success_rate` 14%->4%, `death_rate` monte 0.65->0.72-0.76 (n'est pas juste stagnant, empire
reellement), `ep_rew_mean` passe meme negatif a mi-parcours (-15 vers 3,05M). Contrairement au run 13
(spawn seul), qui progressait lentement mais surement depuis la meme base, ici c'est une vraie chute.

**Hypothese** : repartir du checkpoint a 2M (tout fixe) en randomisant spawn ET sortie EN MEME TEMPS
est un saut de difficulte plus dur que ce qui a ete fait jusqu'ici - la randomisation du spawn seul
avait deja mis 8M pas a converger depuis la meme base ; demander d'apprendre trois degres de liberte
aleatoires simultanement (spawn joueur, spawn ennemi, position de sortie) depuis une politique qui n'en
connait aucun est probablement un saut de difficulte trop brutal en une seule etape.

**Modele produit (NON retenu en l'etat)** : `models/step1_throw_fullrand/final_model.zip` - regression
nette, pas exploitable tel quel.

**Correction du user sur l'historique** : la randomisation du spawn seul n'a PAS converge en 1M pas -
le run 13 initial (2,03M->3,05M, +1M pas) n'atteignait que 50% ; la convergence a 99% n'est venue
qu'apres le run 13 suite (3,05M->8,03M, +5M pas de plus). Le run 15 (celui-ci) ne comparait donc que 2M
pas de randomisation combinee (spawn+sortie, depuis une base qui ne connaissait ni l'un ni l'autre) a un
total de 6M pas necessaires pour la randomisation du spawn SEUL - comparaison injuste, pas un vrai
constat d'echec de l'approche.

**Decision** : repartir de `models/step1_throw_randspawn_to8M/final_model.zip` (deja adapte au spawn
variable a 99%) plutot que de `step1_throw_to2M` (rien de variable) - un seul changement a la fois (la
sortie), au lieu de deux en meme temps. Cf. run 16.

## Run 16 — `step1_throw_zonerand` (2026-08-09, en cours)

**Config** : identique au run 15 (stage 1, lancer, spawn+sortie randomises), mais reprise depuis
`models/step1_throw_randspawn_to8M/final_model.zip` (8,03M pas, deja a 99% avec spawn randomise) au
lieu de `step1_throw_to2M` - la sortie randomisee est ainsi la SEULE nouvelle variable a apprendre.
2 000 000 pas.

**Resultats au demarrage (8,03M-8,04M pas cumules)** : `death_rate=0`, `room_cleared_rate=1.0` (100%,
combat totalement intact), `success_rate=0.111` - nettement mieux que le run 15 au meme stade (0% puis
chute a 4%) : le combat n'a pas ete perturbe du tout, seule la recherche de sortie doit s'adapter.

**Resultats finaux (10,04M pas cumules)** :

| Pas cumules | `death_rate` | `room_cleared_rate` | `success_rate` | `ep_rew_mean` |
|---|---|---|---|---|
| 8,04M (reprise) | 0.00 | 1.00 | 0.11 | +550 |
| 8,29M (pic succes) | 0.37 | 0.62 | **0.16** | +129 |
| 9,55M | 0.78 | 0.22 | 0.01 | +14 |
| **10,04M (fin)** | **0.43** | **0.52** | **0.04** | **+60** |

**Analyse** : different des cas ou "il faut juste plus de temps" s'est verifie (room 3, spawn seul) -
ici le COMBAT lui-meme se degrade temporairement (`room_cleared_rate` 100%->20-52%, `death_rate` qui
oscille 0->0,78 sans direction claire sur ces 2M pas), pas seulement "la sortie pas encore apprise".
Bruite, sans tendance nette. Interpretation retenue (discussion user) : probablement un gros a-coup
d'ajustement de la fonction de valeur au changement d'objectif (comme l'`approx_kl`=20,8 du run 14 en
debut de transfert), pas necessairement un echec definitif - le combat etait acquis a 100% juste avant,
pas detruit.

**Decision (user)** : prolonger de 6M pas de plus plutot que de s'arreter sur ce signal ambigu, avec
suivi specifique de la re-stabilisation de `death_rate`/`room_cleared_rate` dans les 2-3 prochains
millions de pas - si ca continue a osciller sans direction, ce sera un signal plus net qu'il faut revoir
l'approche.

**Modele produit (provisoire)** : `models/step1_throw_zonerand/final_model.zip`.

## Run 16 (suite) — `step1_throw_zonerand_to16M` (2026-08-09) — interrompu par l'utilisateur, aucune résolution du signal ambigu

**Config** : identique au run 16, reprise depuis `models/step1_throw_zonerand/final_model.zip`
(10,04M pas). +6 000 000 pas visés pour atteindre ~16,04M cumulés.

**Résultats au démarrage (10,04M-10,05M pas cumulés)** : `death_rate=0.54`, `success_rate=0.15` —
cohérent avec la fin du run 16 (pas de rupture à la reprise).

**Interrompu par l'utilisateur à 11,99M pas cumulés** (~1,95M des 6M pas prévus, soit moins d'un
tiers du budget) — pas de `final_model.zip` produit, seulement des checkpoints intermédiaires et
`models/step1_throw_zonerand_to16M/best/best_model.zip`.

**Résultats sur la fenêtre effectivement exécutée (10,06M → 11,99M pas cumulés, `rollout/`, fenêtre
glissante 100 épisodes)** :

| Pas cumulés | `death_rate` | `room_cleared_rate` | `success_rate` | `kills_per_episode` | `ep_rew_mean` | `train/std` |
|---|---|---|---|---|---|---|
| 10,06M | 0.54 | 0.39 | 0.15 | 0.38 | +78 | 0.315 |
| 10,60M | 0.30 | 0.66 | 0.11 | 0.66 | +109 | 0.319 |
| 11,29M | 0.36 | 0.58 | 0.12 | 0.58 | +106 | 0.354 |
| 11,72M | 0.47 | 0.45 | 0.05 | 0.45 | +57 | 0.376 |
| **11,99M (dernier point)** | **0.45** | **0.54** | **0.04** | **0.54** | **+60** | **0.398** |

**Analyse** : le signal ambigu constaté à la fin du run 16 initial (oscillation sans tendance) **ne
s'est pas résolu** sur ce prolongement — il reste ambigu, avec même une légère tendance baissière sur
`success_rate` en toute fin de fenêtre (0.15 → 0.11 → 0.12 → 0.05 → 0.04) plutôt que la
re-stabilisation espérée. `kills_per_episode` reste très en dessous du niveau atteint juste avant la
randomisation de la sortie (2,00 à la fin du run 9/14) — le combat lui-même reste dégradé, pas
seulement « la sortie pas encore trouvée ».

Signal supplémentaire, absent des runs précédents : `train/std` grimpe de façon quasi monotone
(0,315 → 0,398) et `train/entropy_loss` devient de plus en plus négatif (-1,37 → -2,81) sur toute la
fenêtre — la politique devient **plus bruitée/incertaine** au fil de l'entraînement plutôt que de
converger, alors qu'`ent_coef` n'est pas fixé explicitement dans `train_ppo.py` (défaut SB3 = 0.0,
donc rien ne pousse artificiellement l'entropie à la hausse). Cohérent avec l'absence de tendance sur
les métriques de performance. `eval/mean_reward` (déterministe) oscille violemment entre -8.5 et +290
sans se resserrer, et `eval/mean_ep_length` est nettement bimodal (soit ~30-350 pas = mort rapide,
soit 1500 = timeout complet) — la politique « moyenne » alterne entre deux modes de comportement très
différents d'un éval à l'autre plutôt que de se stabiliser sur un seul.

**Décision** : run interrompu, pas exploité comme référence en l'état — contrairement à la room 3 ou
au spawn randomisé (progression lente mais déjà positive quand la décision de prolonger a été prise),
ici la tendance restait plate/légèrement négative avec en plus un indicateur d'instabilité nouveau
(`train/std` croissant). Prolonger à l'identique semble avoir peu de chances de percer ce plateau.
Discussion avec le user en cours sur la suite (retour à un checkpoint plus solide, randomisation de la
sortie plus progressive, ou ajustement des hyperparamètres PPO).

## Pivot : sortie randomisée entre 2 coins fixes au lieu de toute la salle (2026-08-09)

**Proposition du user** après l'échec du run 16 (sortie randomisée sur toute la salle) : réduire le
degré de liberté de la sortie à 2 positions fixes, toutes deux dans la colonne de droite de la salle
(au-delà du mur de couverture) — un coin en haut, un coin en bas — plutôt qu'un continuum sur toute la
salle. Palier intermédiaire entre sortie totalement figée (raccourci « pixel absolu » possible, cf.
diagnostic post-run 14) et sortie totalement libre (n'a pas convergé sur ~6M pas, runs 15/16).

**Implémenté** (`classes_functions.py`/`env.py`/`game.py`/`train_ppo.py`) : constante
`SIMPLE_ROOM_EXIT_CORNERS` (deux points, colonne de droite, haut/bas, symétriques par rapport au
centre vertical), nouveau flag `HotlineEnvConfig.simple_room_exit_right_corners` (défaut `False`,
ignoré si `simple_room_randomize_spawn=False` — comportement par défaut strictement inchangé), tiré
au hasard via `random.choice` à chaque reset au lieu de `_random_room_point`. CLI :
`--exit-right-corners` (`game.py`/`train_ppo.py`), combinable avec `--randomize-spawn` et
`--enable-throw`.

**Vérifié** : `check_env.py` intégralement vert (comportement par défaut inchangé), smoke test 400
pas avec `enable_throw` + `randomize_spawn` + `exit_right_corners` combinés sans crash, 300 resets
confirmant exactement 2 positions de sortie distinctes obtenues. **Validation manuelle du user en
jouant** (`game.py --simple-room --single-weapon --randomize-spawn --exit-right-corners`) : log de 23
épisodes (17 succès, 6 morts), sortie strictement alternée entre `(225,25)` et `(225,145)`, jamais
ailleurs — confirmé par le user (« parfait ca fonctionne »).

## Run 17 — `step1_throw_exitcorners` (2026-08-09, en cours)

**Config** : `simple_room=True, room_stage=1, enable_throw=True, randomize_spawn=True,
exit_right_corners=True`, reprise depuis `models/step1_throw_randspawn_to8M/final_model.zip` (8,03M
pas — base spawn randomisé consolidée à 99%, choisie plutôt que le checkpoint qui dérivait dans le
run 16, pour repartir d'une base saine et n'introduire qu'un seul nouveau degré de liberté à la fois :
la sortie). 2 000 000 pas.

**Résultats (courbes `rollout/`, fenêtre glissante 100 épisodes)** :

| Pas cumulés | `death_rate` | `room_cleared_rate` | `success_rate` | `kills_per_episode` | `ep_rew_mean` | `train/std` |
|---|---|---|---|---|---|---|
| 8,04M (reprise) | 0.00 | 1.00 | **0.68** | 1.00 | +551 | 0.232 |
| 8,40M (creux) | 0.86 | 0.12 | 0.04 | 0.12 | +14 | 0.228 |
| 8,95M | 0.42 | 0.56 | 0.53 | 0.56 | +314 | 0.235 |
| 9,49M | 0.40 | 0.58 | 0.55 | 0.58 | +326 | 0.238 |
| **10,04M (fin)** | **0.39** | **0.58** | **0.56** | **0.58** | **+326** | **0.233** |

**Analyse** : nettement meilleur que toutes les tentatives précédentes de randomisation de la sortie
(run 14 : 0% jusqu'au bout ; run 16 : 2-15% en oscillation avec `train/std` croissant). Ici, choc de
transfert classique en tout début (creux à 8,40M : `success_rate` 68%→4%, `approx_kl` très élevé au
premier update comme aux runs 14/16), mais **récupération franche et stabilisation** dès ~8,9M-9,1M
pas, autour de **50-58% de réussite**, sans dérive ensuite. `train/std` reste plat tout du long
(0,227-0,238) — contrairement au run 16 (0,315→0,398) — confirmant l'absence de l'instabilité de
politique observée sur la sortie totalement libre. `eval/mean_reward` (déterministe) se stabilise
aussi en fin de run (~350-480, un point isolé à 229) au lieu d'osciller entre valeurs négatives et
positives comme au run 16.

Reste une marge : `death_rate` (0.39-0.47) et `room_cleared_rate` (0.52-0.71) n'ont pas retrouvé le
niveau quasi parfait du checkpoint de départ (0%/100%) — le combat encaisse un coût réel du transfert
vers 2 sorties possibles, contrairement à la randomisation du spawn (run 13/13-suite) qui n'avait pas
dégradé le combat. Peut encore progresser avec plus de pas (comme les autres étapes du curriculum qui
ont mis plusieurs millions de pas à saturer), à confirmer par une prolongation.

**Décision** : hypothèse du user confirmée — réduire le degré de liberté de la sortie à 2 positions
fixes (au lieu d'un continuum) débloque une convergence que la randomisation totale n'obtenait pas,
sans réintroduire l'instabilité de `train/std` constatée au run 16. Modèle retenu :
`models/step1_throw_exitcorners/final_model.zip`. Prochaine étape à discuter : prolonger ce run pour
regagner le `death_rate`/`room_cleared_rate` perdus au transfert, ou passer directement au transfert
vers room_stage=2 avec cette base.

## Run 17 (suite) — `step1_throw_exitcorners_to12M` (2026-08-09, en cours)

**Config** : identique au run 17, reprise depuis `models/step1_throw_exitcorners/final_model.zip`
(10,04M pas). +2 000 000 pas pour atteindre ~12,04M cumulés. Décision (user) : prolonger pour
regagner le `death_rate`/`room_cleared_rate` perdus au transfert plutôt que d'enchaîner directement
sur room_stage=2.

**Résultats (courbes `rollout/`+`train/`, fenêtre glissante 100 épisodes)** :

| Pas cumulés | `death_rate` | `success_rate` | `ep_rew_mean` | `train/approx_kl` | `train/explained_variance` |
|---|---|---|---|---|---|
| 10,04M (reprise) | 0.33 | 0.62 | +370 | 0.021 | 0.87 |
| 10,90M (pic) | 0.24 | **0.72** | **+431** | 0.021 | 0.88 |
| **10,97M** | 0.21 | 0.63 | +390 | **15.40** | 0.90 |
| 11,11M | 0.31 | 0.57 | +341 | **17.85** | 0.88 |
| 11,32M | 0.40 | 0.21 | +153 | **22.94** | 0.87 |
| 11,39M (creux) | 0.61 | **0.03** | **+29** | **18.43** | 0.54 |
| 11,75M | 0.72 | 0.08 | +46 | 0.031 | 0.71 |
| **12,06M (fin)** | **0.57** | **0.31** | **+169** | **0.021** | **0.77** |

**⚠️ Incident découvert en cours de run, signalé par le user en observant TensorBoard en direct** :
autour de 10,97M pas, `train/approx_kl` (divergence KL moyenne d'une mise à jour PPO, normalement
~0,02) **explose à 15,40, puis 17,85, puis 22,94** sur les mises à jour suivantes — plusieurs centaines
de fois la valeur normale. Dans la foulée, tout s'effondre en quelques centaines de milliers de pas :
`success_rate` 72%→3%, `ep_rew_mean` +431→+29, `explained_variance` (qualité de la fonction de valeur)
0,88→0,54 — la fonction de valeur est détruite en même temps que la politique. Contrairement au run 16
(dérive lente, `train/std` croissant progressivement sur ~2M pas), c'est ici une **mise à jour de
gradient ponctuelle et catastrophique** sur un modèle qui progressait bien jusque-là (72% de réussite
juste avant, son meilleur score sur ce curriculum d'exit_right_corners). Aucune erreur/NaN dans les
logs - le processus tourne normalement, c'est un problème d'optimisation, pas un crash logiciel.

**Diagnostic** : `train_ppo.py` instancie `PPO("MlpPolicy", train_env, ...)` sans `target_kl` (defaut
SB3 = `None`). `target_kl` est le garde-fou prevu exactement pour ce cas : il est cense interrompre les
epoques de gradient d'une mise a jour (`n_epochs=10` par defaut) des que la KL moyenne depasse un
seuil, plutot que de continuer a pousser sur une politique qui a deja trop bouge. Sans lui, les 10
epoques s'executent quoi qu'il arrive - le `clip_range=0.2` (egalement par defaut) borne la
contribution de CHAQUE echantillon a la fonction de perte, mais ne borne pas l'effet cumule sur les
parametres de la politique continue (moyenne/ecart-type gaussien) sur l'ensemble du batch et des 10
epoques. Indice sur le declencheur : `ep_len_mean` etait tombe tres bas juste avant l'incident (episodes
courts, beaucoup de fins d'episode dans la meme fenetre de rollout de 2048 pas x 8 envs) - plus de bonus
terminaux (+500 succes, +100 kill, malus de mort) concentres dans un seul batch peut gonfler la variance
des estimations d'avantage bien au-dela de ce que la fonction de valeur avait calibre, et sans
`target_kl` pour couper court, ce batch a suffi a faire derailler la politique.

**Récupération partielle mais incomplète en fin de run** : `train/approx_kl` redevient normal (~0,02-0,05)
des la fenetre suivante (pas de rechute), mais les performances ne reviennent que partiellement -
`success_rate` remonte a 0,20-0,41 (bruite) en fin de run, loin des 72% du pic pre-incident.

**Décision** : ajouter `target_kl` (0,02-0,03) a l'appel `PPO(...)` dans `train_ppo.py` - fix standard
pour ce symptome exact, sans effet sur l'entrainement quand tout se passe normalement (arrete juste une
epoque plus tot si la KL derape). Repartir du checkpoint sain juste avant l'incident
(`models/step1_throw_exitcorners_to12M/ppo_hotline_10943392_steps.zip`, 10,94M pas, 72% de reussite)
plutot que de `final_model.zip` (12,06M pas, degrade) pour ne pas repartir d'un modele abime.
`models/step1_throw_exitcorners_to12M/final_model.zip` conserve comme trace de l'incident, non retenu
comme reference.

**Implémenté** : `train_ppo.py`, `TARGET_KL = 0.03` passe desormais a la fois a `PPO(...)` (demarrage a
zero) et a `PPO.load(..., target_kl=TARGET_KL)` (reprise depuis un checkpoint) - important pour ce
projet ou tous les runs sont des reprises (`--init-model`) : `PPO.load` ecrase les hyperparametres
sauvegardes avec les kwargs passes (`model.__dict__.update(kwargs)` apres restauration, cf. code
source SB3), donc le fix s'applique meme a un checkpoint qui n'avait pas `target_kl` a l'origine.
Vérifié par chargement du checkpoint 10,94M avec ce kwarg (`model.target_kl == 0.03` apres coup).

## Run 18 — `step1_throw_exitcorners_targetkl` (2026-08-09) — le fix tient, meilleur run de la série

**Config** : identique aux runs 17, reprise depuis le checkpoint sain
`models/step1_throw_exitcorners_to12M/ppo_hotline_10943392_steps.zip` (10,94M pas, 72% de reussite,
juste avant l'incident de KL du run 17 suite), avec `target_kl=0.03` desormais actif. 2 000 000 pas.

**Résultats (courbes `rollout/`+`train/`, fenêtre glissante 100 épisodes)** :

| Pas cumulés | `death_rate` | `room_cleared_rate` | `success_rate` | `ep_rew_mean` | `train/approx_kl` |
|---|---|---|---|---|---|
| 10,96M (reprise) | 0.33 | 0.65 | 0.63 | +373 | 0.015 |
| 11,48M | 0.15 | 0.84 | 0.83 | +498 | 0.016 |
| 11,89M | 0.26 | 0.74 | 0.74 | +435 | 0.011 |
| 12,29M | 0.23 | 0.77 | 0.76 | +455 | 0.028 |
| **12,96M (fin)** | **0.29** | **0.71** | **0.69** | **+412** | **0.018** |

**`approx_kl` maximal sur l'intégralité du run : 0,0421** (à 12,67M pas) — jamais rien approchant les
15-23 du run 17 (suite). Le garde-fou `target_kl=0.03` fonctionne comme prévu : aucune nouvelle
explosion sur les 2M pas, malgré des conditions similaires (même reward/config).

**Analyse** : run propre du début à la fin, aucun effondrement — mieux même que le pic pré-incident du
run 17 (`success_rate` 0,58-0,84 ici contre un pic isolé à 0,72 avant l'incident, `death_rate` descendu
jusqu'à 0,15 contre un plancher de 0,21 avant). `explained_variance` reste saine tout du long
(0,77-0,93, jamais l'effondrement à 0,54 observé pendant l'incident du run 17 suite). Confirme sans
ambiguïté que l'incident de KL n'était pas une limite de fond de cette configuration (spawn+2 sorties
randomisés) mais bien un trou de garde-fou dans `train_ppo.py` — corrigé, le curriculum progresse
normalement à nouveau.

**Décision** : `target_kl=0.03` conservé comme réglage par défaut de `train_ppo.py` pour tous les runs
futurs (pas seulement celui-ci). Modèle retenu : `models/step1_throw_exitcorners_targetkl/final_model.zip`
(~69% de réussite, combat proche de l'état pré-transfert). Prochaine étape à discuter : transfert vers
room_stage=2 avec cette base, ou prolonger encore ce stage.

**Choix (discuté avec le user) : transfert vers `room_stage=2` plutôt que prolonger le stage 1.**
Raisonnement : les 3 échecs précédents sur `room_stage=2` avec lancer (runs 12, 12v2, 14) n'ont jamais
été résolus par une base stage 1 plus solide — testé et invalidé explicitement au run 14 (base
spawn-généralisée à 99%, échec identique). Le vrai coupable diagnostiqué après coup était la sortie
FIXE du stage 1 d'alors, qui permettait de mémoriser un pixel absolu plutôt que de suivre `goal_hint` —
exactement le problème que les 2 coins randomisés viennent de traiter. `room_stage=2` a sa propre
sortie fixe, à une position différente des 2 coins d'entraînement du stage 1 : c'est donc le test le
plus direct pour vérifier si la politique suit vraiment la direction relative ou a seulement mémorisé
« aller vers l'un de ces 2 points précis ». Continuer à pousser le score du stage 1 (déjà 69-83%, pour
une tâche à 3 degrés de liberté aléatoires + lancer) aurait un rendement décroissant comparé à ce test.

## Run 19 — `step2_throw_exitcorners` (2026-08-09, en cours)

**Config** : `simple_room=True, room_stage=2, enable_throw=True, randomize_spawn=True,
exit_right_corners=True` (ces 2 derniers flags sans effet sur `room_stage=2`, qui a une géométrie/
sortie fixes — gardés pour cohérence avec le modèle de base). Reprise depuis
`models/step1_throw_exitcorners_targetkl/final_model.zip` (12,96M pas, 69% de réussite stage 1).
2 000 000 pas.

**Résultats (courbes `rollout/`, fenêtre glissante 100 épisodes)** :

| Pas cumulés | `death_rate` | `room_cleared_rate` | `success_rate` | `kills_per_episode` | `ep_len_mean` |
|---|---|---|---|---|---|
| 12,98M (reprise) | 0.91 | 0.53 | **0.00** | 0.62 | 156 |
| 13,91M | 0.85 | 0.93 | **0.00** | 1.05 | — |
| 14,26M | 0.69 | 0.90 | **0.00** | 1.14 | — |
| **14,97M (fin)** | **0.43** | **0.88** | **0.00** | **1.45** | **912** |

**`success_rate` reste EXACTEMENT à 0,00 sur les 203 points mesurés, du premier au dernier, sur toute
la durée du run** — pas juste faible, littéralement jamais un seul succès sur la fenêtre glissante,
alors que le combat progresse très bien (`room_cleared_rate` 53%→88-93%, `death_rate` divisé par deux,
`kills_per_episode` jusqu'à 1,45/2). `train/approx_kl` reste sain tout du long (max 0,0427) - le
`target_kl` du run 18 fonctionne, ce n'est pas un problème d'instabilité cette fois.

**L'hypothèse "sortie mémorisée" (qui motivait ce run) ne tient pas** : ce run utilisait justement la
base à sortie randomisée (2 coins) du run 18, précisément pour tester si la politique suit vraiment
`goal_hint` plutôt que d'avoir mémorisé un pixel fixe - avec une sortie inédite (position différente
des 2 coins d'entraînement), elle échoue quand même à 0% pile, comme les 3 tentatives précédentes
(runs 12, 12v2, 14) qui utilisaient toutes une base à sortie fixe. Donc la randomisation de la sortie
au stage 1, bien qu'utile en soi (run 17/18), **n'était pas le facteur bloquant le transfert vers
room_stage=2**.

**Diagnostic ciblé effectué (headless, `models/step2_throw_exitcorners/final_model.zip`, 100% du
diagnostic reproductible par script, pas d'observation visuelle nécessaire)** :
1. **Hypothèse "réflexe de récupération d'arme" (run 12v2) INVALIDÉE** : sur 38 épisodes ayant nettoyé
   la salle, **36 (95%) étaient ARMÉS (pas à poings) au moment du clear**, et ont quand même échoué à
   sortir. Seuls 2/38 étaient à poings à ce moment - ce n'est donc pas un cycle lancer/récupération qui
   bloque l'agent.
2. **Hypothèse "camping en salle 1" (observation visuelle du run 12) NE SE REPRODUIT PAS ici** : sur 32
   épisodes nettoyés, **32/32 (100%) quittent bien la salle 1, traversent le couloir et entrent en
   salle 2** (x ≥ 400) - contrairement au run 12 (base bien moins mature), cette base-ci progresse
   activement.
3. **Nouveau point de blocage identifié, très net** : l'abscisse maximale atteinte APRÈS le clear,
   sur ces 32 épisodes, est systématiquement comprise entre **x=491 et x=526** - un intervalle étroit,
   jamais au-delà. Or le deuxième ennemi est à x=620 et la sortie à x=640 : l'agent entre en salle 2
   (cellule (4,1) dans `nav_graph`, x:400-500) mais ne progresse quasiment jamais au-delà de la
   cellule (5,*) (x:500-600). Géométrie de `room_stage=2` : la salle 2 a son mur de couverture MIROIR
   qui bloque le passage bas entre les cellules (5,1) et (6,1) - pour atteindre (6,1) (où se trouvent
   l'ennemi 2 et la sortie), il faut un détour par la rangée du haut ((4,1)→(4,0)→(5,0)→(6,0)→(6,1))
   au lieu d'une ligne droite. C'est une manœuvre "monter puis traverser puis redescendre" jamais
   rencontrée sous cette forme dans le curriculum jusqu'ici (le mur de couverture de la salle 1 exige
   seulement un détour simple par le bas, une seule case).

**Hypothèse retenue pour la suite** : le signal de rapprochement vers la sortie (`reward_goal_approach_scale`,
0,1 par saut de cellule de flow field) est probablement trop faible/épars pour apprendre fiablement ce
détour en 2 temps, particulièrement si le flow field pousse d'abord "vers le bas" localement (vers la
cellule (5,1) directement adjacente) avant de devoir obliquer vers le haut - contrairement à un
gradient de récompense continu, un saut de cellule discret peut masquer localement la bonne direction à
plus long terme. Diagnostic non encore confirmé visuellement (`watch_agent.py --room-stage 2
--enable-throw --debug-flow-field`) - à faire avant de décider d'un correctif.

**Décision** : pas de nouveau run lancé immédiatement - diagnostic à approfondir (vérifier visuellement
le flow field autour de la cellule (5,1)/(6,1), et/ou renforcer le bonus de rapprochement vers la
sortie dans ce genre de détour) avant de retenter un transfert vers room_stage=2. Modèle produit (NON
retenu) : `models/step2_throw_exitcorners/final_model.zip` - combat solide, sortie jamais trouvée.

## Diagnostic visuel : le flow field n'est PAS le problème (2026-08-09)

Capture generee ad hoc (script temporaire, pas dans le repo) : le flow field complet vers la sortie
(une fleche par case, source = la sortie, meme principe que `_draw_debug_flow_field` mais applique a
`env._goal_flow_field` au lieu du flow field de poursuite) superpose aux murs reels de `room_stage=2`.
**Confirmé visuellement et textuellement** : `(4,1)→(4,0)→(5,0)→(6,0)→(6,1)` - le detour "monter puis
traverser puis redescendre" autour du mur miroir est correctement calcule et parfaitement aligne sur
les murs physiques. Pas de bug de routage/nav_graph.

**Cause retenue** : le bonus de rapprochement vers la sortie (`reward_goal_approach_scale=0.1` par
saut de cellule BFS, actif seulement une fois tous les ennemis morts, cf. run 16→17) est **net negatif**
en pratique. A `PLAYER_MOVE_VEL=5px/frame`, traverser une case (`CELL_SIZE=100px`) prend ~20 pas, donc
~20 × `reward_tick_penalty` (0.01) = 0.2 de malus de tick accumule par case traversee - avec l'ancienne
valeur (0.1), le bonus net d'une case franchie etait donc **0.1 - 0.2 = -0.1**, tant que le succes final
(+500) ne s'est encore jamais produit pour que la fonction de valeur en tienne compte par bootstrap.
Rien n'incitait donc, meme faiblement, a progresser cellule par cellule vers une sortie distante -
cohérent avec un `success_rate` bloque a exactement 0,00 malgre un combat quasi parfait.

**Décision (discutée avec le user)** : ne pas repartir de zero sur `room_stage=2` - reprendre le
meilleur modele de combat existant (`models/step2_throw_exitcorners/final_model.zip`, run 19, 88-93%
de pieces nettoyees) et augmenter uniquement `reward_goal_approach_scale` (`0.1 → 0.5` dans
`HotlineEnvConfig`, cf. `env.py`) pour rendre chaque case franchie nettement positive (0.5 - 0.2 =
+0.3) independamment du succes final - un seul changement a la fois, sur la base de combat deja acquise.
`check_env.py` toujours vert apres ce changement.

## Run 20 — `step2_throw_exitcorners_goalboost` (2026-08-09) — progrès réel mais succès toujours à 0%

**Config** : identique au run 19, reprise depuis `models/step2_throw_exitcorners/final_model.zip`
(14,97M pas, combat solide/sortie jamais trouvee), avec `reward_goal_approach_scale=0.5` (au lieu de
0.1) desormais actif, `target_kl=0.03` toujours actif. 2 000 000 pas.

**Résultats (courbes `rollout/`, fenêtre glissante 100 épisodes)** :

| Pas cumulés | `death_rate` | `room_cleared_rate` | `success_rate` | `kills_per_episode` | `ep_rew_mean` |
|---|---|---|---|---|---|
| 14,99M (reprise) | 0.20 | 1.00 | **0.00** | 1.80 | +118 |
| 15,30M (pic combat) | 0.05 | 1.00 | **0.00** | 1.95 | +168 |
| 15,92M (creux) | 0.77 | 0.85 | **0.00** | 1.04 | +80 |
| 16,45M | 0.50 | 0.99 | **0.00** | 1.45 | +121 |
| **16,99M (fin)** | **0.64** | **0.71** | **0.00** | **1.03** | **+83** |

**`success_rate` reste à nouveau EXACTEMENT 0,00 sur les 203 points, comme le run 19** - le bonus x5
(`0.1 → 0.5`) n'a, en apparence, rien changé à la métrique d'entraînement. `train/approx_kl` reste sain
(max 0,0764) - pas de souci d'instabilité.

**Diagnostic post-hoc (headless, 80 épisodes stochastiques, `models/step2_throw_exitcorners_goalboost/
final_model.zip`)** : contrairement à l'apparence des courbes, il y a bien un progrès réel mais partiel.
En reprenant le même test qu'au run 19 (abscisse maximale atteinte après le clear), l'agent va
**nettement plus loin** : jusqu'à **x=660** dans 5/14 épisodes nettoyés (contre un plafond dur à x≈526
avant le boost, cf. diagnostic run 19) - x=660 est déjà DANS la cellule (6,*) qui contient l'ennemi 2
(x=620) et la sortie (x=640,y=140), donc le détour "monter-traverser-redescendre" est bien franchi une
partie du temps maintenant. Mais sur un échantillon élargi (80 épisodes), **0/80 succès réels** malgré
26/80 pièces nettoyées - l'agent s'approche donc de la sortie sans jamais tout à fait la toucher/finir
le dernier ajustement de position. Le signal `rollout/success_rate` (mesuré uniquement pendant
l'entraînement, sur les actions échantillonnées à ce moment-là) n'a simplement jamais capté cette
amélioration marginale en 2M pas.

**Analyse** : le renforcement du bonus de rapprochement a un effet réel et mesurable (progression
spatiale bien au-delà de l'ancien plafond), donc l'hypothèse du diagnostic précédent (signal net
négatif) était correcte en tant que facteur limitant partiel - mais insuffisante à elle seule pour
franchir la ligne d'arrivée. Reste un dernier obstacle non identifié entre "arriver près de la sortie"
et "réussir réellement" (précision du dernier pas, hésitation dans la zone d'arrivée, ou peut-être
simplement encore un manque de budget d'entraînement sur cette nouvelle échelle de reward).

**Décision** : run journalisé, pas encore de décision sur la suite - discussion en cours avec le user
(piste évoquée mais pas encore détaillée). Modèle produit :
`models/step2_throw_exitcorners_goalboost/final_model.zip` - progrès net vs run 19, toujours pas
retenu comme référence de succès.

## Pivot : 3e coin de sortie (a gauche), stage 1 (2026-08-09)

**Idée du user** : plutôt que de continuer à pousser sur `room_stage=2`, revenir au stage 1 et ajouter
un 3e point candidat pour la sortie, à **gauche** de la salle (en plus des 2 existants à droite), avant
de retenter le transfert. Raisonnement (rejoint le diagnostic du run 19/20) : avec seulement des
sorties à droite, la politique peut généraliser un biais directionnel grossier ("la sortie est à
droite, entre haut et bas") plutôt que de vraiment lire `goal_hint` dans toutes les directions - un
point à gauche casse ce raccourci possible et devrait mieux préparer le transfert vers des géométries
où la sortie n'est pas nécessairement à droite.

**Implémenté** : `SIMPLE_ROOM_EXIT_CORNERS` passe de 2 à 3 points (2 à droite inchangés + 1 à gauche,
`(60, 100)`, centré verticalement pour rester distinct des 2 corners existants). Renommage à cette
occasion (le nom n'était plus exact) : `exit_right_corners` → `exit_corners` dans
`classes_functions.py`/`env.py`/`game.py`/`train_ppo.py` (flag CLI `--exit-right-corners` →
`--exit-corners`, champ `HotlineEnvConfig.simple_room_exit_right_corners` →
`simple_room_exit_corners`). Reward inchangée (garde `reward_goal_approach_scale=0.5` du run 20,
`target_kl=0.03` du run 18). Vérifié : plus aucune référence à l'ancien nom dans le code, `check_env.py`
intégralement vert, 500 resets confirmant les 3 positions de sortie distinctes obtenues (dont la
nouvelle à gauche).

## Run 21 — `step1_throw_exitcorners3_goalboost` (2026-08-09, en cours)

**Config** : `simple_room=True, room_stage=1, enable_throw=True, randomize_spawn=True,
exit_corners=True` (désormais 3 coins), reprise depuis
`models/step1_throw_exitcorners_targetkl/final_model.zip` (12,96M pas, 69% de réussite avec seulement
2 coins à droite). Reward actuelle conservée (`reward_goal_approach_scale=0.5`, `target_kl=0.03`).
**5 000 000 pas** (décision user, budget plus généreux que les runs précédents de ce stage vu le
changement de distribution des sorties).

**Résultats (courbes `rollout/`, fenêtre glissante 100 épisodes, 506 points mesurés)** :

| Pas cumulés | `death_rate` | `room_cleared_rate` | `success_rate` | `ep_rew_mean` | `ep_len_mean` |
|---|---|---|---|---|---|
| 12,98M (reprise) | 0.28 | 0.72 | 0.60 | +387 | 145 |
| 14,02M | 0.33 | 0.67 | 0.45 | +286 | ~300 |
| 15,60M | 0.33 | 0.67 | 0.47 | +293 | ~400 |
| 16,66M | 0.38 | 0.61 | 0.48 | +293 | ~450 |
| **17,97M (fin)** | **0.36** | **0.62** | **0.40** | **+248** | **426** |

Moyenne de `success_rate` par quart du run : 0,504 (1er quart) → 0,452 → 0,456 → **0,462** (dernier
quart) - quasi stable, aucune tendance claire à la hausse malgré 5M pas. `ep_len_mean` reste bien en
dessous du plafond de troncature (1500, identique aux runs 17/18) - jamais au-delà de 570, pas de
souci de troncature comme sur `room_stage=2`. `train/approx_kl` reste sain tout du long (max 0,078) -
pas d'instabilité.

**Analyse** : l'ajout du 3e coin (gauche) fait clairement chuter la performance par rapport au run 18
(2 coins, 58-84% de réussite en 2M pas) - ici plafond autour de **40-50%**, avec même une légère baisse
en toute fin (derniers points 0,50→0,38-0,40) plutôt qu'une consolidation. Contrairement au pattern
"juste besoin de plus de temps" qui a fonctionné pour la randomisation du spawn (run 13, 8M pas
nécessaires) ou pour la room 3 (run 10, 5M pas), ici 5M pas (2,5× le budget du run 18) ne suffisent pas
à seulement retrouver le niveau du run 18, plutôt un plateau bruité sans direction claire.

**Décision** : run journalisé, résultat mitigé - le 3e coin durcit sensiblement la tâche sans que le
budget supplémentaire compense. À discuter avec le user : prolonger encore, ou considérer que 3 coins
en une fois est un saut de difficulté trop brutal (comme le run 15 l'avait été pour spawn+sortie
simultanés) et repasser par une étape intermédiaire. Modèle produit :
`models/step1_throw_exitcorners3_goalboost/final_model.zip` - ~40-50% de réussite stage 1, pas encore
retenu pour un nouveau transfert vers room_stage=2.

## Observation visuelle du run 21 (`watch_agent.py --debug-directions --debug-flow-field`, 2026-08-09)

**Ajout technique préalable** : `watch_agent.py` ne supportait pas encore `--randomize-spawn`/
`--exit-corners` (jamais branché, cf. écart déjà noté au run 8) - ajouté pour pouvoir observer un
modèle entraîné avec ces flags dans sa vraie distribution d'entraînement plutôt que sur une carte figée.

**Observation utilisateur** (`models/step1_throw_exitcorners3_goalboost/final_model.zip`, stochastique,
15 épisodes demandés, fenêtre fermée après 12) : **9 succès / 3 échecs (2 morts, 1 troncature) sur les
12 épisodes observés, soit ~75%** - nettement mieux que ne le laissait penser la moyenne glissante des
courbes d'entraînement (~40-50% en fin de run). Écart cohérent avec le même phénomène déjà noté au run
4/4-suite (l'évaluation en direct sur un petit échantillon peut différer sensiblement de la moyenne
glissante à 100 épisodes, en mieux comme en pire selon l'échantillon).

**Décision (user)** : continuer l'entraînement plutôt que de revoir l'approche à 3 coins - le niveau
observé en direct est jugé suffisamment prometteur. Prolonger de **15 000 000 pas** (budget nettement
plus généreux que les runs précédents de ce stage) depuis `models/step1_throw_exitcorners3_goalboost/
final_model.zip` (17,97M pas), plutôt que de repartir sur une étape intermédiaire à 2-3 coins.

## Run 22 — `step1_throw_exitcorners3_goalboost_to33M` (2026-08-09, en cours)

**Config** : identique au run 21 (3 coins de sortie, `reward_goal_approach_scale=0.5`, `target_kl=0.03`),
reprise depuis `models/step1_throw_exitcorners3_goalboost/final_model.zip` (17,97M pas). 15 000 000 pas
supplémentaires (cumul visé ~32,97M).

**Résultats (courbes `rollout/`, fenêtre glissante 100 épisodes, 1516 points mesurés)** :

| Pas cumulés | `death_rate` | `room_cleared_rate` | `success_rate` | `ep_rew_mean` |
|---|---|---|---|---|
| 17,99M (reprise) | 0.29 | 0.71 | 0.60 | +299 |
| 21,25M | 0.13 | 0.86 | 0.84 | +499 |
| 27,11M | 0.11 | 0.87 | 0.87 | +522 |
| 31,67M (pic) | 0.08 | 0.92 | **0.91** | +567 |
| **32,98M (fin)** | **0.14** | **0.86** | **0.86** | **+516** |

Moyenne de `success_rate` par quart du run : **0,684 → 0,791 → 0,798 → 0,840** - progression quasi
continue jusqu'au bout, aucun plateau ni rechute (contrairement à ce que laissaient présager les 5M
pas du run 21 seuls). `train/approx_kl` reste sain tout du long (max 0,0526).

**Analyse** : confirme l'intuition du user - le plateau à 40-50% du run 21 n'était qu'un manque de
budget, exactement comme pour la randomisation du spawn (run 13, qui avait besoin de 8M pas pour
converger après un plateau similaire à 1M). Avec 3 coins de sortie (dont 1 à gauche, cassant le biais
directionnel), l'agent atteint finalement **86% de réussite** en régime stable (pics à 90-91%),
supérieur au meilleur résultat obtenu avec seulement 2 coins à droite (run 18, 58-84%) - la tâche plus
dure finit par produire une politique plus robuste une fois assez entraînée.

**Décision** : `models/step1_throw_exitcorners3_goalboost_to33M/final_model.zip` retenu comme nouvelle
référence de l'étape 1 du curriculum - la plus solide et la plus généralisée obtenue à ce stade (spawn
totalement randomisé + sortie randomisée sur 3 positions couvrant gauche/droite/haut/bas). Prochaine
étape à discuter : retenter le transfert vers `room_stage=2` avec cette base.

## Observation visuelle du run 22 (`watch_agent.py`, 2026-08-09)

**Confirmation utilisateur** (`models/step1_throw_exitcorners3_goalboost_to33M/final_model.zip`,
stochastique, 25 épisodes) : **23/25 succès (92%)** - cohérent avec la fin de courbe (~86-91%), meilleure
performance stage 1 obtenue à ce stade, validée visuellement.

## Pivot : sortie de room_stage=2 randomisée sur les 4 coins extrêmes du niveau (2026-08-09)

**Demande du user**, pendant l'observation du run 22 : plutôt que de retenter le transfert vers
`room_stage=2` avec sa sortie fixe (640,140) inchangée depuis toujours, généraliser la sortie de
`room_stage=2` de la même façon que le stage 1 (runs 17-22) - randomisée, mais cette fois sur les 4
coins extrêmes du niveau complet (salle 1 + salle 2), avant de relancer un transfert.

**Implémenté** : `ROOM_STAGE2_EXIT_CORNERS = ((45,45), (45,155), (655,45), (655,155))` - haut-gauche/
bas-gauche dans la salle 1, haut-droite/bas-droite dans la salle 2, marge de 10px par rapport à tous
les murs/mur de couverture/mur miroir. Nouveau paramètre `create_room_stage2(exit_corners=False)`,
nouveau flag `HotlineEnvConfig.room2_exit_corners` (défaut `False`, comportement par défaut
strictement inchangé), CLI `--room2-exit-corners` (`game.py`/`train_ppo.py`/`watch_agent.py`). Vérifié :
`check_env.py` intégralement vert, 300 resets confirmant les 4 positions distinctes, smoke test 400 pas
avec `enable_throw` combiné sans crash, sortie par défaut toujours (640,140) sans le flag.

**Observation visuelle AVANT tout entraînement** (`models/step1_throw_exitcorners3_goalboost_to33M/
final_model.zip` - stage 1 seul, jamais entraîné sur `room_stage=2`, transfert à froid) : sur 10
épisodes observés, **0 succès**, mais combat déjà solide (plusieurs épisodes avec les 2 ennemis tués) -
comportement attendu pour un transfert à froid, cohérent avec les runs 19/20 (combat transfère bien,
la sortie doit encore s'apprendre).

## Complément avant lancement : spawn randomisé aussi sur room_stage=2 (2026-08-09)

**Remarque du user** juste avant de lancer le run 23 : `room2_exit_corners` ne randomisait que la
sortie - le spawn joueur/ennemis de `room_stage=2` était resté figé ((50,100)/(230,100)/(620,100)),
contrairement au stage 1 où spawn ET sortie varient tous les deux depuis plusieurs runs. Corrigé avant
de lancer quoi que ce soit.

**Implémenté** : `create_room_stage2(randomize_spawns=False)` - reutilise `_random_room_point`
(généralisée avec un paramètre `origin` pour supporter la salle 2, qui ne commence pas à x=0) : joueur
et ennemi 1 n'importe où dans la salle 1, ennemi 2 n'importe où dans la salle 2, distance minimale
90px entre joueur et ennemi 1 (même salle), direction de patrouille initiale calculée dynamiquement
(dos tourné, axe de plus grande séparation, même logique que `create_simple_room`) au lieu de codée en
dur. Réutilise le flag existant `HotlineEnvConfig.simple_room_randomize_spawn` (pas de nouveau flag -
il couvre désormais `room_stage=1` ET `2`). `create_room_stage2` retourne maintenant `(map_objects,
nav_graph, player_spawn)` comme `create_simple_room` (au lieu de laisser `env.py` imposer un spawn
fixe en dur). Vérifié : comportement par défaut bit-à-bit identique (positions par défaut
reproduites exactement par le calcul dynamique de direction), `check_env.py` vert, 400 resets
confirmant la couverture spatiale (joueur/ennemi 1 dans toute la salle 1, ennemi 2 dans toute la
salle 2, 4 positions de sortie toujours correctes), smoke test 400 pas avec tout combiné
(`enable_throw` + `randomize_spawns` + `exit_corners`) sans crash.

## Run 23 — `step2_exitcorners4` (2026-08-09, en cours)

**Config** : `simple_room=True, room_stage=2, enable_throw=True, randomize_spawn=True` (couvre
désormais spawn joueur/ennemis ET, combiné à `room2_exit_corners=True`, la sortie), reprise depuis
`models/step1_throw_exitcorners3_goalboost_to33M/final_model.zip` (32,98M pas, 86% de réussite stage 1
sur 3 sorties). Reward actuelle conservée (`reward_goal_approach_scale=0.5`, `target_kl=0.03`).
**10 000 000 pas** (décision user).

**⚠️ Incident process découvert en cours de run** : le tout premier lancement du run 23 (avant l'ajout
du spawn randomisé pour `room_stage=2`, cf. section précédente) utilisait déjà `--run-name
step2_exitcorners4` et n'a **jamais été arrêté** - il a continué à tourner en arrière-plan (avec
l'ancien code : sortie randomisée sur 4 coins, mais spawn TOUJOURS fixe) pendant que ce second
lancement (spawn+sortie randomisés) tournait EN PARALLÈLE sous le même nom. Les deux processus ont
écrit dans les mêmes dossiers (`models/step2_exitcorners4/`, `runs/step2_exitcorners4_0/` -
coïncidence de calcul d'ID de run SB3, chacun avec son propre fichier d'événements distinct grâce au
PID dans le nom de fichier, donc heureusement pas de mélange AU SEIN d'un même fichier). Repéré grâce
à une remarque du user sur une analyse de courbe qui s'est avérée être celle du MAUVAIS processus
(glob avait pris le fichier du premier lancement, pas du second).

**Dégât** : `models/step2_exitcorners4/final_model.zip` du premier lancement (sortie seule
randomisée, spawn fixe) a été écrasé par le second avant sauvegarde (confirmé par hash MD5 identique
entre ma copie de "sauvegarde" et le fichier actuel - la copie a eu lieu APRÈS l'écrasement, donc a
involontairement dupliqué le second modèle au lieu de préserver le premier). Modèle du premier
lancement perdu, mais **sa courbe TensorBoard complète reste intacte** (fichier d'événements distinct,
non écrasé) et ce n'était de toute façon plus la branche retenue (le user avait demandé le spawn
randomisé juste après ce lancement). Checkpoints numérotés intermédiaires de `models/step2_exitcorners4/`
non fiables (mélange des deux processus sur toute la durée où ils tournaient en parallèle) - dossier
archivé sous `models/step2_exitcorners4_MIXED_ARCHIVE_do_not_use/`, à ne plus utiliser. Le
`final_model.zip` du second lancement (spawn+sortie randomisés, celui qu'on voulait) a été confirmé et
isolé proprement dans `models/step2_exitcorners4_randspawn/final_model.zip`.

**Résultats finaux (les deux runs sont allés jusqu'au bout de leurs 10M pas pendant la confusion,
courbes complètes 1011 points chacune)** :

| Run | `success_rate` par quart | `death_rate` par quart | succès max jamais atteint |
|---|---|---|---|
| Premier lancement (sortie seule, **perdu**) | 0,009 → 0,006 → 0,06 → 0,002 | 0,51→0,48→0,66→0,47 | 0,27 |
| **Second lancement (spawn+sortie, retenu)** | 0,006 → 0,005 → 0,024 → **0,08** | 0,73→0,79→0,66→0,54 | 0,23 |

**Analyse** : contrairement à l'impression donnée par les courbes partielles observées en direct
(« ça semble boucler »), **aucun des deux runs n'a convergé sur l'intégralité des 10M pas** - ce
n'était pas une oscillation qui allait se stabiliser, les deux terminent avec `success_rate` proche de
0. Le run retenu (spawn+sortie randomisés) montre une légère amélioration en toute fin (0,08 sur le
dernier quart) mais reste loin d'une convergence. `approx_kl` reste sain sur les deux (max 0,055 et
0,064) - pas de problème d'instabilité, juste une tâche pas encore résolue avec ce budget.

**Décision** : prolonger de 15M pas supplémentaires depuis `models/step2_exitcorners4_randspawn/
final_model.zip` (confirmé, 42,99M pas), comme convenu avec le user - budget nettement plus généreux,
cohérent avec ce qui a fini par débloquer le stage 1 (run 21→22, plateau à 5M puis franche
convergence à +15M). Nom de run vérifié comme n'existant nulle part ailleurs avant lancement, pour ne
plus jamais reproduire cet incident.

## Run 24 — `step2_exitcorners4_to58M` (2026-08-09) — interrompu par le user, dégradation nette

**Config** : identique au run 23 (spawn+sortie de `room_stage=2` randomisés, `reward_goal_approach_scale=0.5`,
`target_kl=0.03`), reprise depuis `models/step2_exitcorners4_randspawn/final_model.zip` (42,99M pas).
15 000 000 pas visés (cumul cible ~58M).

**Interrompu par le user à 49,94M pas cumulés** (~6,95M des 15M prévus, un peu moins de la moitié) -
dernier checkpoint sauvegardé `models/step2_exitcorners4_to58M/ppo_hotline_49940496_steps.zip`, pas de
`final_model.zip` (run non terminé).

**Résultats sur la fenêtre effectivement exécutée (43,01M → 49,89M pas cumulés, 696 points)** :

| Pas cumulés | `death_rate` | `room_cleared_rate` | `success_rate` | `ep_rew_mean` |
|---|---|---|---|---|
| 43,01M (reprise) | 0.82 | 0.54 | 0.04 | +80 |
| 44,97M | 0.72 | 0.49 | 0.03 | +75 |
| 46,94M | 0.84 | 0.37 | 0.03 | +50 |
| 48,41M | 0.61 | 0.65 | 0.01 | +88 |
| **49,89M (dernier point)** | **0.85** | **0.29** | **0.00** | **+30** |

`train/approx_kl` reste sain tout du long (max 0,0504) - pas de problème d'instabilité de gradient
cette fois, contrairement au run 17 suite.

**Analyse** : dégradation nette et sensible par rapport au point de reprise, pas juste une stagnation.
`room_cleared_rate` (qualité du combat, jusque-là le point fort de tous les runs `room_stage=2`
précédents) chute de ~0,54-0,65 à un plancher de **0,29** en toute fin - la compétence de combat
elle-même se dégrade, pas seulement la navigation vers la sortie. `death_rate` reste élevé et empire
plutôt qu'il ne s'améliore (0,82 → jusqu'à 0,85 en fin de fenêtre, avec des creux à 0,61 sans tendance
stable). `success_rate` retombe à 0,00 sur le tout dernier point mesuré. Repère utile pour le
diagnostic : ce combo (spawn ET sortie de `room_stage=2` randomisés simultanément) est déjà celui qui
avait produit une oscillation marquée au run 23 (0% de succès sur l'intégralité de ses 10M pas,
`death_rate` jamais descendu sous 0,54) - ce run 24 confirme que prolonger à l'identique n'a pas
suffi à inverser la tendance, contrairement à ce qui avait fonctionné pour le stage 1 (run 21→22).

**Décision (user)** : arrêt du run et de TensorBoard - "tout est en train de se casser la gueule",
réflexion sur la suite avant de relancer quoi que ce soit. Pistes à discuter (non tranchées) : revenir
à un changement isolé sur `room_stage=2` (spawn seul OU sortie seule randomisés, pas les deux à la
fois - ce qui n'a jamais été testé isolément sur ce stage, contrairement au stage 1 où chaque degré de
liberté a toujours été ajouté un par un), ou revoir un autre aspect (reward, hyperparamètres) avant de
prolonger encore l'entraînement brut. Checkpoint le plus récent disponible si besoin de reprendre :
`models/step2_exitcorners4_to58M/ppo_hotline_49940496_steps.zip` (49,94M pas) - non retenu comme
référence en l'état, dégradé par rapport au point de départ (`models/step2_exitcorners4_randspawn/
final_model.zip`, 42,99M pas).

## Réflexion (hors run) : hypothèses après le run 24, avant de relancer quoi que ce soit (2026-08-09)

> Discussion tenue avec le user après l'arrêt du run 24, à froid, sans nouvel entraînement lancé.
> Objectif : lister les hypothèses et pistes avant de choisir la prochaine expérience, pour ne pas
> reperdre le fil si une piste est explorée plus tard. Décision retenue en fin de section : lancer
> l'isolement spawn/sortie (piste 1) en premier.

### 1. Le run 24 reproduit l'erreur du run 15 — piste retenue en premier

**Constat** : le run 15 (stage 1) avait déjà échoué exactement de cette façon — randomiser spawn **et**
sortie **en même temps**, depuis une base qui ne connaissait ni l'un ni l'autre
(`step1_throw_to2M`) → régression nette, pas juste lenteur (cf. run 15 ci-dessus). Le correctif qui a
fonctionné (run 16→17) : isoler la sortie seule, en partant d'une base *déjà* consolidée sur le spawn
(`step1_throw_randspawn_to8M`, 99%) — un seul nouveau degré de liberté à la fois.

Les runs 23-24 (`room_stage=2`) reproduisent exactement le schéma du run 15 : spawn **+** sortie (4
coins) randomisés **en même temps**, dès le premier transfert, jamais isolés l'un de l'autre sur ce
stage — contrairement au stage 1 où chaque degré de liberté a toujours été ajouté séparément. C'est la
discipline "un seul changement à la fois" (déjà le principe directeur de tout ce journal) qui n'a pas
été appliquée ici.

**Piste retenue** : reprendre `models/step1_throw_exitcorners3_goalboost_to33M/final_model.zip` (base
stage 1 à 86%, spawn+3 sorties déjà maîtrisés) et transférer vers `room_stage=2` avec **un seul** degré
de liberté nouveau à la fois :
- d'abord spawn randomisé seul (sortie fixe `(640,140)` comme à l'origine),
- consolider,
- **puis seulement** ajouter `room2_exit_corners` par-dessus cette base consolidée.

C'est la piste choisie pour la prochaine expérience (cf. section suivante de ce journal une fois
lancée).

### 2. Signal plus inquiétant : le run 24 dégrade le combat lui-même, pas seulement la navigation

Différence qualitative avec tous les échecs précédents sur `room_stage=2` (runs 19, 20) : dans ces
runs-là, la sortie n'était jamais trouvée mais le combat restait excellent (`room_cleared_rate`
88-100%, stable). Dans le run 24, `room_cleared_rate` s'effondre aussi (0,54→0,29) — pas seulement "la
nav n'est pas encore apprise", mais une **compétence déjà acquise qui se dégrade** en cours de route.
Signature différente : de l'interférence catastrophique, pas de la lenteur d'apprentissage.

**Hypothèse A — perte de plasticité après un très long enchaînement de fine-tuning continu.** Le
modèle repris au run 24 avait déjà ~43M pas d'entraînement cumulés, tous en fine-tuning séquentiel
(jamais de reset de l'optimiseur ni d'une partie du réseau depuis le tout début du curriculum). C'est
le régime où la littérature RL documente une perte de plasticité du réseau ("primacy bias" / "loss of
plasticity", ex. Nikishin et al., Dohare et al.) : plus un réseau enchaîne les fine-tunings sur des
distributions qui changent, moins il reste capable d'apprendre du nouveau sans détruire l'ancien.
**Test pas cher envisageable** : reprendre le même checkpoint avec un reset partiel (dernières couches
et/ou état de l'optimiseur Adam) avant de retenter room_stage=2, comparer à un fine-tuning classique sur
un budget de pas identique et court.

**Hypothèse B — absence de tout mécanisme de "rehearsal".** Rien n'empêche le gradient de room_stage=2
d'écraser ce qui a été appris pour le combat au stage 1 — c'est un fine-tuning pur, pas un multi-tâche.
Pistes non testées : mélanger occasionnellement des épisodes `room_stage=1` pendant la transition, ou
pénaliser la divergence KL par rapport au modèle de départ le temps que la nav s'installe (une forme
légère d'EWC).

### 3. Le signal de shaping domine peut-être trop le signal de combat

`reward_goal_approach_scale=0.5`/case est dense et fréquent sur un trajet salle1→couloir→salle2, face à
des événements de combat rares et espacés (+100/kill, au plus deux fois par épisode). Ce déséquilibre de
fréquence pourrait pousser le gradient à sur-investir sur "suivre le gradient de distance" au détriment
du placement/visée en combat — cohérent avec le symptôme observé au run 24. Le coefficient a été retuné
par calcul manuel (annuler le malus de tick, cf. diagnostic post-run 19) mais jamais formulé en **reward
shaping potentiel** (Ng et al., `γΦ(s') − Φ(s)`), qui garantit de ne pas altérer la politique optimale
sous-jacente — contrairement à un bonus proportionnel ad hoc. Pas certain que ce soit LE facteur ici,
mais testable isolément (réduire temporairement `reward_goal_approach_scale` pendant la phase
room_stage=2 et observer si `room_cleared_rate` se maintient mieux).

### 4. Piste plus structurelle : arrêter de faire réapprendre la navigation par RL pur

Le moteur calcule déjà le chemin optimal vers la sortie à chaque frame (flow field/BFS, alimente
`goal_hint`) — mais l'agent doit quand même redécouvrir comment le suivre via des millions de pas de
descente de gradient sur une récompense éparse. Étonnant au vu du principe déjà acté dans
`agent_ia_design.md` ("réutiliser ce que le moteur expose, pas le redériver"), appliqué jusqu'ici
seulement à l'observation, jamais au comportement.

Deux déclinaisons possibles, non testées :
- **Perte auxiliaire de type behavioral cloning** sur la direction de déplacement : quand `goal_hint`
  est actif et qu'aucun ennemi n'est en chase, ajouter une perte supervisée
  `(move_x, move_y) ≈ flow_field_direction` en plus de la perte PPO, pour bootstrap directement la nav
  plutôt que d'espérer qu'elle émerge du reward shaping seul.
- **Politique hiérarchique/modulaire** : un contrôleur (même codé en dur au départ — "s'il reste un
  ennemi vivant → sous-politique combat, sinon → suivre le flow field") plutôt qu'un seul MLP plat
  sommé sur un seul reward scalaire censé apprendre à composer deux comportements assez différents.
  Rejoint la logique de machine à états déjà utilisée pour l'IA ennemie dans le moteur.

### 5. Trous méthodologiques indépendants du problème actuel

- **Métrique d'entraînement bruitée** : `rollout/success_rate` (fenêtre glissante 100 épisodes) a déjà
  donné des lectures trompeuses à plusieurs reprises (runs 4-suite, 16, 20-21 — écarts notables avec des
  évals déterministes ou des observations visuelles ponctuelles). Pas de script d'éval standard (n=200+,
  stochastique ET déterministe, lancé systématiquement sur chaque `final_model.zip`) — chaque diagnostic
  a été reconstruit ad hoc après coup (runs 19, 20). À formaliser une bonne fois.
- **Pas de heatmap de visite automatique.** Le diagnostic du run 19 ("bloqué entre x=491 et x=526")
  était efficace mais bricolé (script temporaire). Une heatmap de positions visitées générée
  automatiquement après chaque run localiserait ce genre de blocage sans script sur-mesure à chaque
  fois.
- **Lignée unique, séquentielle, un seul seed.** Le run 6 vs 7 a confirmé que la variance de seed est
  réelle et significative. Avant d'engager 10-15M pas sur une direction (comme les runs 23/24), lancer
  2-3 seeds en parallèle sur un budget court (1-2M pas) pour choisir la meilleure lignée coûterait
  relativement peu (le parallélisme `SubprocVecEnv` existe déjà par run) et éviterait de découvrir après
  7M pas qu'une mauvaise graine a été tirée.
- **Hyperparamètres PPO jamais revisités depuis le choix initial**, à part `target_kl` (fix réactif
  après l'incident du run 17-suite). LR, taille de batch, `ent_coef`, `clip_range` sont restés aux
  défauts SB3 sur ~50M pas cumulés et des changements de tâche très différents. Pas forcément coupable
  ici, mais jamais réexaminé.

**Décision** : prochaine expérience = piste 1 (isolement spawn/sortie sur `room_stage=2`, un seul degré
de liberté à la fois). Les pistes 2 à 5 restent ouvertes, à reconsidérer si l'isolement ne suffit pas à
lui seul à débloquer `success_rate`.

### Vérifications faites avant de lancer l'isolement

- **Pas de couplage caché** entre `simple_room_randomize_spawn` et `room2_exit_corners` dans
  `create_room_stage2()` (`classes_functions.py`) - deux paramètres indépendants, confirmé en lisant le
  code. Isoler le spawn seul = `--randomize-spawn` sans `--room2-exit-corners` (sortie fixe `640,140`).
- **Nom de run vérifié comme n'existant nulle part** (`models/`, `runs/`) avant lancement, et aucun
  process Python résiduel - leçon du run 23 appliquée.
- **Découverte en vérifiant** : le flag CLI `--enemy-count` de `train_ppo.py` (défaut `1`) ne sert qu'à
  calculer `room_cleared_rate` (`EpisodeOutcomeCallback(expected_enemies=...)`) - il ne change ni le
  nombre réel d'ennemis sur `room_stage=2` (toujours 2, fixé par `create_room_stage2`) ni
  l'entraînement. **Aucun run `room_stage=2` passé (9, 12, 14, 19, 20, 23, 24) ne documente la valeur
  utilisée pour ce flag** - si la valeur par défaut (1) a été utilisée à chaque fois, leur
  `room_cleared_rate` rapporté mesurait en réalité "au moins 1 ennemi tué" et non "les 2" (métrique plus
  généreuse que supposé). Impossible de vérifier rétroactivement (`train_ppo.py`/`env.py` non versionnés
  dans git à ce stade - aucun historique de commandes). N'invalide pas le diagnostic du run 24 (fondé
  surtout sur `success_rate`, resté strictement à 0, et sur `death_rate`), mais reste une incertitude
  sur les valeurs `room_cleared_rate` publiées jusqu'ici pour ce stage. **Correctif pour la suite** :
  `--enemy-count 2` désormais explicite sur tous les runs `room_stage=2`.

## Run 25 — `step2_spawnonly` (2026-08-09) — isolement spawn seul, succès toujours à 0%

**Config** : `simple_room=True, room_stage=2, enable_throw=True, randomize_spawn=True` (sortie fixe
`(640,140)`, PAS de `room2_exit_corners` - un seul nouveau degré de liberté par rapport à la base),
reprise depuis `models/step1_throw_exitcorners3_goalboost_to33M/final_model.zip` (32,98M pas, 86% stage
1). `--enemy-count 2` explicite (cf. correctif ci-dessus). 2 000 000 pas.

**Résultats (80 points d'évaluation déterministe, `eval_freq=25000`, couvrant l'intégralité du run)** :

| Pas cumulés | `death_rate` | `room_cleared_rate` | `kills_per_episode` | `success_rate` | `eval/mean_reward` |
|---|---|---|---|---|---|
| 33,00M (reprise) | 0.52 | 0.48 | 1.20 | 0 | 170 |
| 33,40M (pic) | 0.51 | **0.49** | 1.33 | 0 | 192 |
| 34,20M (pic) | 0.39 | **0.61** | 1.47 | 0 | 150 |
| 34,60M | 0.70 | 0.30 | 1.13 | 0 | 103 |
| 34,80M | 0.74 | 0.26 | 1.15 | 0 | 137 |
| **34,98M (fin)** | **0.80-0.81** | **0.18-0.19** | **0.95-1.01** | **0** | 39-103 (bruite) |

**`success_rate` reste EXACTEMENT à 0,00 sur les 80 points, du premier au dernier** - aucun succès
enregistré une seule fois sur l'intégralité du run, malgré un seul degré de liberté nouveau (spawn) et
une sortie fixe déjà "familière" en position absolue pour un modèle de ce curriculum. Le combat oscille
dans une bande raisonnable (`room_cleared_rate` 0.37-0.61) sur les ~1,4M premiers pas, puis se dégrade
nettement sur les ~600k derniers (0.61→0.18-0.19, `death_rate` 0.39→0.80-0.81) - même signature que le
run 24 (dégradation du combat lui-même, pas seulement absence de succès), mais apparue plus tard dans le
budget et un peu moins brutale.

**Observation secondaire** : le garde-fou `target_kl=0.03` déclenche un arrêt anticipé
("Early stopping ... max kl") sur la quasi-totalité des 123 mises à jour PPO du run (dès la toute
première), avec des pics à 0,15-0,27 en toute fin - notablement plus fréquent que sur les runs stage 1
(run 18 : max `approx_kl` sur tout le run 0,0421). `train/approx_kl` (moyenne rapportée) reste toutefois
dans une fourchette bien plus modeste (0,012-0,075) - pas une explosion comparable au run 17 (suite,
15-23), mais une instabilité de mise à jour clairement plus présente ici que sur le reste du curriculum.
Éventuellement lié à la dégradation de fin de run, pas encore établi comme causal.

**Modèle produit** : `models/step2_spawnonly/final_model.zip` - combat correct mais jamais stabilisé,
sortie jamais atteinte, non retenu comme référence de succès.

### Reformulation de l'hypothèse après ce run : le vrai palier "tout fixe" n'a jamais reçu de gros budget

En reprenant l'historique complet de `room_stage=2` pour préparer cette isolation, un fait plus
fondamental apparaît, qui remet en question la piste 1 telle que formulée initialement : **avant les
runs 23/24, la sortie de `room_stage=2` a TOUJOURS été fixe** (`room2_exit_corners` n'existe que depuis
juste avant le run 23) et **le spawn de `room_stage=2` a TOUJOURS été fixe avant le run 23**
(`simple_room_randomize_spawn` n'avait aucun effet sur `room_stage=2` avant cette date, cf. commentaire
`env.py`). Autrement dit, les runs 12, 12v2, 14, 19 et 20 - tous les échecs `enable_throw` précédents -
tournaient déjà sur une carte **entièrement figée** (spawn ET sortie), la configuration la plus simple
possible, structurellement identique à ce qui avait donné 98% de réussite sans `enable_throw` (run 9).
**Aucun de ces runs "tout fixe + lancer" n'a jamais dépassé 2M pas avant d'être abandonné** au profit
d'un changement d'approche (spawn/sortie randomisés, boost de reward) - contrairement au stage 1, qui a
eu besoin de jusqu'à 33M pas cumulés pour bien converger avec `enable_throw` (runs 11→22).

**Comparaison qui n'a donc jamais été faite** : est-ce que `room_stage=2` + `enable_throw`, sur la carte
figée la plus simple (spawn et sortie fixes, comme le run 9 sans lancer), converge avec un budget
nettement plus généreux (10-15M pas, comme ce qui a fini par débloquer le stage 1 aux runs 17→18 et
21→22) au lieu des ~1-2M pas donnés à chaque tentative jusqu'ici ? Le run 20 (`goalboost`, carte figée,
2M pas) montrait déjà une progression spatiale réelle (jusqu'à x=660, dans la cellule de la sortie) sans
jamais y arriver tout à fait - cohérent avec "pas assez de budget" plutôt que "structurellement bloqué".
Point favorable supplémentaire : ce run 25 a pris moins de 8 minutes de calcul pour 2M pas (`fps`
~4400-5200) - un budget beaucoup plus généreux sur la version figée resterait rapide à tester.

**Nuance sur la piste 1 initiale** : l'idée "un seul degré de liberté à la fois" reste valable comme
principe (elle a fonctionné au stage 1), mais son application à `room_stage=2` ratait une étape : au
stage 1, chaque nouveau degré de liberté était ajouté **par-dessus une base déjà consolidée sur la
version plus simple** (spawn variable ajouté après une base déjà à 99% sur spawn+sortie fixes, cf. run
11-suite). Sur `room_stage=2`, aucune base "spawn+sortie fixes, `enable_throw`" n'a jamais été consolidée
avant que ce run 25 y ajoute le spawn variable - contrairement à l'apparence, il ne s'agissait donc pas
vraiment d'un "seul nouveau degré de liberté par-dessus une base maîtrisée", mais d'apprendre en même
temps toute la géométrie inédite de `room_stage=2` (jamais vue avec `enable_throw` sur un budget
suffisant) ET le spawn variable.

**Décision** : pas encore tranchée - à discuter avec le user avant de relancer quoi que ce soit.
Candidat proposé : reprendre `models/step2_throw_exitcorners_goalboost/final_model.zip` (run 20, carte
100% figée, `enable_throw` + `reward_goal_approach_scale=0.5`, progression spatiale déjà observée) avec
un budget nettement plus généreux (10-15M pas) avant de réintroduire spawn et/ou sortie randomisés,
plutôt que de continuer sur la lignée `step2_spawnonly` de ce run.

## Run 26 — `step2_goalboost_to32M` (2026-08-10) — 15M pas, "juste plus de budget" REFUTE

**Config** : identique au run 20 (carte `room_stage=2` **100% figée**, spawn et sortie fixes,
`enable_throw=True`, `reward_goal_approach_scale=0.5`, `target_kl=0.03`), reprise depuis
`models/step2_throw_exitcorners_goalboost/final_model.zip` (16,99M pas, fin du run 20). `--enemy-count 2`
explicite. **15 000 000 pas** (contre 1-2M à chaque tentative précédente sur cette configuration) -
décision prise avec le user suite à la reformulation d'hypothèse post-run 25 (voir section précédente).

**Résultats (600 points d'évaluation déterministe, `eval_freq=25000`, échantillon régulier sur
l'intégralité des 15M pas)** :

| Pas cumulés | `death_rate` | `room_cleared_rate` | `kills_per_episode` | `success_rate` | `eval/mean_reward` |
|---|---|---|---|---|---|
| 17,01M (reprise) | 0.72 | 0.23 | 0.90 | 0 | +120 |
| 18,01M | 0.38 | 0.54 | 1.49 | 0 | +180 |
| 19,01M | 0.33 | 0.61 | 1.48 | 0 | +179 |
| 20,01M | 0.27 | 0.73 | 1.55 | 0 | +172 |
| 21,01M (pic) | **0.01** | **0.98** | 1.97 | 0 | +79 |
| 22,01M | 0.55 | 0.45 | 1.45 | 0 | +172 |
| 24,01M | 0.74 | 0.14 | 1.14 | 0 | **-147** |
| 26,01M | 0.88 | 0.12 | 1.11 | 0 | +48 |
| 28,01M | 0.05 | 0.73 | 1.71 | 0 | **-181** |
| 29,01M | 0.39 | 0.21 | 1.18 | 0 | -10 |
| 31,01M | 0.22 | 0.52 | 1.4 | 0 | **-183** |
| **31,99M (fin)** | 0.34 | 0.43 | 1.37 | 0 | -155 |

**`success_rate` reste EXACTEMENT à 0,00 sur les 600 points, du premier au dernier pas des 15M** -
aucun succès enregistré une seule fois. **L'hypothèse "il suffit de donner plus de budget à la
configuration 100% figée" (formulée après le run 25) est donc réfutée** : contrairement à tous les
paliers précédents du curriculum où "encore plus de pas" avait fini par débloquer une percée (spawn
randomisé stage 1 : 8M pas ; 3 coins de sortie stage 1 : +15M pas après un plateau à 5M), ici 15M pas
supplémentaires sur la version la plus simple possible de la tâche n'ont produit aucun signe de
convergence.

**Signal le plus parlant : aucune tendance, juste du bruit.** `death_rate` et `room_cleared_rate`
oscillent violemment et sans direction sur tout le run (`room_cleared_rate` : 0,12 à un point, 0,98 au
point suivant quelques millions de pas plus loin, puis retombe) - pas un plateau stable, pas une
dégradation progressive comme les runs 23/24/25, littéralement une absence de tendance. `eval/mean_reward`
(déterministe, 5 épisodes) devient franchement négatif sur plusieurs points du 2e tiers du run (-147,
-181, -183, avec un écart-type très faible sur certains points comme 28,01M `+/- 1.56` ou 31,01M
`+/- 2.72`) - suggère que la politique déterministe se bloque de façon quasi identique sur ses 5 épisodes
d'éval à ces moments-là (comportement répétitif/bloqué plutôt qu'aléatoire), sans qu'un diagnostic visuel
ait encore confirmé ce que fait précisément l'agent à ces points.

**Découverte potentiellement plus importante : le garde-fou `target_kl=0.03` se déclenche sur
LITTÉRALEMENT 100% des 916 mises à jour PPO du run** (comme déjà observé sur le run 25, 123/123) -
`approx_kl` moyen rapporté grimpe jusqu'à 0,12 par endroits (vs max 0,0421 sur l'intégralité du run 18,
stage 1, qui lui avait bien convergé). Ce n'est pas un incident ponctuel comme le run 17 (suite) : c'est
une caractéristique **systématique** de cette configuration précise (carte `room_stage=2` + `enable_throw`
+ reward actuelle), présente aussi bien sur 2M pas (run 25) que sur 15M pas (ce run). Conséquence
directe : chaque mise à jour PPO est coupée après **1 seule époque** au lieu des 10 nominales
(`n_epochs=10` jamais atteint) - la politique ne reçoit donc jamais que 10% du nombre d'époques de
gradient prévu par mise à jour, quel que soit le nombre total de pas d'environnement accumulés. Ça
change la lecture du problème : le facteur limitant n'est peut-être pas "pas assez de pas
d'environnement" (testé et réfuté par ce run) mais "pas assez d'époques de gradient exploitées par pas
d'environnement", à cause d'un déclenchement quasi-permanent du garde-fou - plus de pas ne compense pas
ça, puisque chaque mise à jour individuelle reste tout aussi tronquée.

**Temps de calcul** : ~4484s (~75 min) pour 15M pas (~3350 pas/s) - confirme que ce genre de test grande
échelle reste rapide à mener sur cette configuration.

**Modèle produit** : `models/step2_goalboost_to32M/final_model.zip` - combat très instable (0,12 à 0,98
de `room_cleared_rate` selon le moment), sortie jamais atteinte, non retenu comme référence de succès.

**Hypothèses pour la suite (pas encore testées)**, par ordre de priorité suggéré :
1. **Le taux d'apprentissage (ou la taille de batch/`n_steps`) est probablement trop élevé pour cette
   configuration de reward** - piste la plus actionnable : réduire `learning_rate` (défaut SB3 0,0003,
   jamais retouché depuis le début du projet) et/ou augmenter `n_steps`/taille de batch pour réduire la
   variance des estimations d'avantage par lot, plutôt que de compter sur `target_kl` pour rattraper le
   problème après coup à chaque mise à jour.
2. **Diagnostic visuel ciblé** sur les points à `eval/mean_reward` très négatif et faible écart-type
   (24,01M, 28,01M, 31,01M) - `watch_agent.py --room-stage 2 --enable-throw --deterministic` sur les
   checkpoints correspondants, pour voir concrètement ce que fait la politique déterministe à ces
   moments (bloquée dans un coin ? boucle ? fonce dans un mur ?).
3. Revenir aux pistes structurelles déjà notées après le run 24 (dégradation combat = interférence
   catastrophique / perte de plasticité après un très long enchaînement de fine-tuning ; signal de
   shaping qui domine le signal de combat) - toujours pertinentes, pas encore testées.

**Décision** : hypothèse 1 (learning rate trop eleve) retenue pour test immediat - cf. run 27.

## Correctif : `--learning-rate` ajouté à `train_ppo.py` (2026-08-10)

Nouveau flag CLI (`train_ppo.py`), défaut `3e-4` (= défaut SB3, comportement inchangé si absent),
branché à la fois sur `PPO(...)` (démarrage à zéro) et `PPO.load(..., learning_rate=...)` (reprise -
même mécanisme que `target_kl`, les kwargs de `PPO.load` écrasent les hyperparamètres sauvegardés).
`check_env.py` intégralement vert après ce changement (toutes verifications passees, comportement par
defaut inchange).

## Run 27 — `step2_goalboost_lr1e4` (2026-08-10) — le LR etait bien le probleme de stabilite, mais pas celui de la sortie

**Config** : identique au run 26 (même base `step2_throw_exitcorners_goalboost`, 16,99M pas, carte
`room_stage=2` 100% figée, `enable_throw=True`, `reward_goal_approach_scale=0.5`, `target_kl=0.03`),
**`learning_rate=0.0001`** (au lieu du défaut `0.0003` utilisé par tous les runs précédents du projet).
2 000 000 pas - budget modéré pour un premier test rapide, comme le run 25.

**Résultats (80 points d'évaluation déterministe sur l'intégralité des 2M pas)** :

| Pas cumulés | `death_rate` | `room_cleared_rate` | `kills_per_episode` | `success_rate` | `eval/mean_reward` |
|---|---|---|---|---|---|
| 17,01M (reprise) | 0.77 | 0.17 | 0.83 | 0 | +159 |
| 17,41M | 0.28 | 0.69 | 1.67 | 0 | +179 |
| 17,81M | 0.02 | 0.94 | 1.94 | 0 | +173 |
| 18,41M (pic) | 0.04 | **0.96** | 1.96 | 0 | +180 |
| 18,61M (pic) | **0.02** | **0.98** | 1.98 | 0 | +180 |
| 18,81M | 0.10 | 0.88 | 1.82 | 0 | +174 |
| **18,99M (fin)** | 0.27 | 0.70 | 1.54 | 0 | +176 |

**`train/approx_kl` maximal sur l'intégralité du run : 0,041** (vs 0,12 sur le run 26 avec l'ancien LR) -
nettement plus proche de la fourchette saine du stage 1 (run 18 : max 0,0421). `target_kl` se déclenche
encore souvent (122/123 mises à jour), mais l'amplitude de la divergence KL par mise à jour est
redescendue à un niveau normal, plus rien de comparable aux pics à 0,15-0,27 des runs 25/26.

**Résultat net : combat stable et excellent, mais `success_rate` reste EXACTEMENT à 0,00 sur les 80
points, comme tous les runs précédents.** Contraste très net avec le run 26 (même base, même reward,
ancien LR) : ici `death_rate` descend jusqu'à 0,02, `room_cleared_rate` atteint 0,94-0,98, et **aucune
oscillation chaotique** - progression puis stabilisation propre dans une bande 0,64-0,98 jusqu'à la fin,
sans le bruit erratique (0,12↔0,98 d'un point à l'autre) ni les effondrements du run 26.
`eval/mean_reward` reste positif et stable tout du long (+159 à +182), plus aucun point fortement négatif
comme les -147/-181/-183 du run 26.

**Analyse - deux problèmes distincts, maintenant démêlés** : le learning rate trop élevé (0,0003) était
bien responsable de l'instabilité chaotique du run 26 (confirmé - le combat est maintenant stable et
au meilleur niveau jamais observé sur `room_stage=2` avec `enable_throw`, comparable aux pics du run 20).
**Mais ce n'était pas la cause du blocage sur la sortie** : même avec un combat quasi parfait et stable,
l'agent ne trouve jamais la sortie, pas une seule fois sur 2M pas. Ça recentre le problème exactement là
où le diagnostic du run 19/20 l'avait laissé avant la parenthèse "budget"/"learning rate" : le signal qui
doit guider l'agent jusqu'à la sortie une fois la salle nettoyée (`reward_goal_approach_scale`, le detour
"monter-traverser-redescendre" autour du mur miroir) reste insuffisant, indépendamment de la stabilité de
l'entraînement.

**Modèle retenu** : `models/step2_goalboost_lr1e4/final_model.zip` - **meilleure référence de combat
obtenue à ce jour sur `room_stage=2` avec `enable_throw`** (stable, jusqu'à 98% de pièces nettoyées),
bonne base pour la suite malgré l'absence de succès. `learning_rate=0,0001` à conserver comme réglage
par défaut pour les prochains runs sur cette configuration (et probablement à réévaluer plus largement,
cf. piste méthodologique notée après le run 24 : hyperparamètres PPO jamais retunés depuis le début du
projet).

**Décision** : diagnostic visuel d'abord, puis reward shaping - cf. sections suivantes.

## Diagnostic visuel du run 27 (`watch_agent.py --stochastic --debug-directions`, 2026-08-10)

**Observation utilisateur (screenshot, `models/step2_goalboost_lr1e4/final_model.zip`)** : l'agent
hésite pile au coin du détour de `room_stage=2` (sommet du mur miroir de la salle 2, juste après avoir
traversé par le haut) plutôt que de redescendre dans la dernière case (celle qui contient la sortie).
**Confirmé par les logs de la session** (12 épisodes, stochastique) : 11/12 se terminent en troncature
avec les 2 ennemis tués (`kills=2`), 1 en mort - jamais un seul succès, cohérent avec `success_rate=0`
sur l'entraînement.

**Cause identifiée dans le code** (`env.py`, `_compute_reward`) : `reward_goal_approach_scale` n'est
accordé qu'au **franchissement complet d'une frontière de case** (`progress = self._prev_goal_hops -
hop_count`, où `hop_count` vient de `_player_cell()` - un entier qui ne change que tous les ~20 pas au
rythme de déplacement du joueur). **Aucun gradient de récompense à l'intérieur d'une case** - un agent
qui hésite/recule pile à un coin n'a donc aucune incitation locale à continuer, seulement le malus de
tick qui s'accumule pendant l'hésitation. Diagnostic déjà évoqué au run 7 (bonus "sparse" `~1 fois tous
les ~20 steps`) mais jamais corrigé jusqu'ici - seule la magnitude avait été retouchée (run 19→20,
`0.1→0.5`), jamais la granularité.

## Correctif : `goal_approach_continuous` (2026-08-10)

**Implémenté** (`env.py`) : nouveau flag `HotlineEnvConfig.goal_approach_continuous` (défaut `False`,
comportement/modèles existants strictement inchangés). Quand actif, remplace le saut discret par une
distance continue en pixels le long du flow field (`_goal_remaining_px(cell, px, py)`) : distance jusqu'au
centre de la PROCHAINE case du chemin, plus `CELL_SIZE` par saut restant au-delà ; distance directe à la
sortie une fois dans sa case (`hop_count == 0`). Le reward devient `(reward_goal_approach_scale /
CELL_SIZE) * (distance_precedente - distance_actuelle)`, dense à chaque pas au lieu d'une seule fois par
case franchie.

**Propriété théorique** : reste un potentiel valide au sens de Ng et al. (fonction de l'état seul,
`reward = Φ(s) - Φ(s')`) - ne devrait donc pas, en principe, altérer la politique optimale sous-jacente,
juste rendre le signal plus facile à suivre pendant l'apprentissage.

**Vérifié avant de lancer un entraînement** :
- `check_env.py` intégralement vert (comportement par défaut inchangé).
- Script ad hoc (déplacement direct du joueur, sans passer par `step()`, pour isoler le calcul) :
  la distance décroît en continu à l'intérieur d'une case (delta ~1,5-1,9px pour 2px de déplacement,
  cohérent). **Au passage d'une frontière de case, un saut résiduel existe** (observé jusqu'à 14px sur
  le test, contre une transition théoriquement parfaite à 0) - la fonction n'est pas parfaitement C0
  aux frontières où le chemin tourne, parce qu'elle mesure la distance au centre de la case suivante
  plutôt qu'à un point de passage réel sur la frontière. Reste très largement plus dense que le
  mécanisme discret qu'elle remplace (saut de `CELL_SIZE` entier à 100% concentré sur un seul pas,
  contre un résidu de quelques px à ~14px ici) - accepté comme approximation raisonnable plutôt que
  bloquant, à revoir seulement si l'empirique ne s'améliore pas.

**Décision** : test empirique lancé directement (piste peu coûteuse à vérifier, cf. runs 25-27 : 2M pas
= quelques minutes) plutôt que de sur-raffiner la formule sans données - cf. run 28.

## Run 28 — `step2_goalcontinuous` (2026-08-10) — 0% de succès, mais l'agent arrive a 60-70px de la sortie

**Config** : identique au run 27 (même base `step2_goalboost_lr1e4`, ~19,03M pas cumulés, `room_stage=2`
100% figée, `enable_throw=True`, `learning_rate=0.0001`, `target_kl=0.03`), **`goal_approach_continuous=True`**
en plus. 2 000 000 pas.

**Résultats (80 points d'évaluation déterministe)** : `success_rate` reste à 0,00 sur les 80 points, comme
tous les runs précédents sur cette configuration. Mais **stabilité préservée** (comme le run 27, pas de
dégradation comme le run 26) : `death_rate` 0,01-0,21, `room_cleared_rate` 0,79-0,99,
`train/approx_kl` max 0,041 (même fourchette saine que le run 27).

**Diagnostic ciblé (headless, 80 épisodes stochastiques, `models/step2_goalcontinuous/final_model.zip`)** -
même méthode que le run 19, mais avec une mesure de distance 2D (x ET y) au centre de la sortie plutôt
que la seule abscisse (l'abscisse seule s'est avérée trompeuse - un x élevé atteint au mauvais y, ex.
en haut du détour, ne veut pas dire "proche de la sortie") :

- **78/80 épisodes nettoient la salle** (2 ennemis tués), **0/80 succès réel**.
- **Distance minimale au centre de la sortie jamais atteinte par épisode : 60,4px (meilleur cas) à
  70,5px (pire des meilleurs cas)** - c'est-à-dire que **CHAQUE épisode nettoyé s'approche à moins de
  71px de la sortie à un moment donné**, contre un plafond dur à ~526px de distance en x avant le boost
  de reward (run 19) et une réussite irrégulière (5/14, jamais un vrai succès) même avec le boost seul
  sans signal continu (run 20).
- **Point de blocage précis identifié** : les positions les plus proches jamais atteintes se regroupent
  autour de `(579-580, 126-134)` - c'est-à-dire **bon alignement vertical avec la sortie** (y=140±15,
  dans la bande de la zone) **mais bloqué horizontalement juste avant `x=590`**, la frontière gauche
  exacte du mur miroir (`mirror_wall_rect = (590, 100, 20, 100)`, qui bloque précisément la bande
  `y:100-200`). L'agent semble s'aligner sur le y de la cible avant d'avoir fini de traverser par le
  haut (`y<100`, seul passage ouvert), et se retrouve physiquement coincé contre le mur à cette hauteur
  plutôt que de finir le détour "monter → traverser → redescendre" jusqu'au bout.

**Analyse** : progrès net et mesurable par rapport à toutes les tentatives précédentes sur `room_stage=2`
avec `enable_throw` - l'agent n'a plus un plafond dur loin de la sortie, il en est systématiquement tout
proche (60-70px, contre des centaines de px avant). Mais **jamais un seul succès sur 80+80 épisodes
observés (train + diagnostic)** - la dernière portion du détour (finir de traverser par le haut avant de
redescendre, plutôt que de couper au plus court et se coincer contre le mur) n'est pas encore fiabilisée.
Schéma cohérent avec les paliers précédents du curriculum qui ont eu besoin d'un budget nettement plus
généreux après un premier plateau proche du but (room 3 : run 10, 60% après +5M pas ; 3 coins de sortie
stage 1 : run 21→22, 40-50% après 5M pas puis 86% après +15M pas) plutôt que d'un blocage structurel.

**Modèle produit** : `models/step2_goalcontinuous/final_model.zip` - combat stable et solide, agent
systématiquement à 60-70px de la sortie, jamais un succès réel. Prometteur mais pas encore la référence
recherchée.

**Décision** : prolonger l'entraînement sur cette même lignée plutôt que de rediagnostiquer davantage -
le signal continu fonctionne (rapprochement mesurable et systématique), le plus probable est un manque
de budget sur la toute dernière portion du trajet, comme observé à plusieurs reprises déjà sur ce
curriculum. Cf. run 28 (suite).

## Run 28 (suite) — `step2_goalcontinuous_to26M` (2026-08-10) — combat parfait, blocage IDENTIQUE malgre 5M pas de plus

**Config** : identique au run 28, reprise depuis `models/step2_goalcontinuous/final_model.zip` (~21,03M
pas cumulés). 5 000 000 pas supplémentaires (cumul ~26,04M).

**Résultats (306 points d'évaluation déterministe)** : `success_rate` reste à 0,00 sur **l'intégralité
des 306 points**. Stabilité encore meilleure qu'au run 28 (`train/approx_kl` max **0,034**, la meilleure
valeur de toute la lignée `room_stage=2` ; `target_kl` ne se déclenche plus que sur 186/306 mises à jour,
61% contre 99-100% aux runs 25-28). Combat quasi parfait en fin de run : `death_rate` 0-0,05,
`room_cleared_rate` 0,95-1,00, `kills_per_episode` jusqu'à 2,00 pile.

**Diagnostic positionnel repris (80 épisodes headless, `models/step2_goalcontinuous_to26M/final_model.zip`)** :
**80/80 salles nettoyées** (contre 78/80 au run 28) - combat désormais parfait. Mais **distance minimale
au centre de la sortie : 64,2 à 70,3px - STRICTEMENT IDENTIQUE (à quelques px près) au run 28** (60,4 à
70,5px), malgré 5M pas d'entraînement supplémentaires et un signal de reward continu qui, en théorie,
pousse en permanence vers la sortie une fois la salle vide. Positions les plus proches jamais atteintes :
`(578-580, 110-120)` - même zone qu'au run 28 (`579-580, 126-134`), collée contre le même bord du même
mur (`mirror_wall_rect`, frontière gauche à x=590).

**Analyse - ce N'EST PAS un manque de budget, contrairement à l'hypothèse retenue après le run 28** :
la métrique qui compte vraiment ici (distance minimale à la sortie) n'a **pas bougé d'un pixel
significatif** sur 5M pas, alors que le combat a continué de progresser jusqu'à la perfection sur la
même période - le signal continu n'est manifestement pas en train de "presque y arriver et convergence
lente", c'est un **point d'accumulation stable** que l'entraînement ne parvient pas à franchir, quel que
soit le budget donné. Contredit le pattern "juste besoin de plus de pas" qui avait fonctionné pour la
room 3 (run 10) et les 3 coins de sortie stage 1 (run 21→22) - ici, la courbe est simplement plate sur la
métrique qui compte.

**Hypothèses pour expliquer ce blocage stable (pas encore testées)** :
1. **Discontinuité résiduelle de `_goal_remaining_px` pile à ce corner** (déjà notée comme limite connue
   lors de l'implémentation, cf. section précédente) - si franchir cette frontière précise cause
   localement un delta de reward moins favorable qu'ailleurs sur le trajet (a cause de l'approximation
   "distance au centre de la case suivante" plutôt qu'un vrai gradient de plus court chemin), ce serait
   un puits artificiel invisible en apparence mais bien réel pour le gradient de politique.
2. **Effondrement d'exploration** : `train/std` reste bas tout du long (~0,19-0,22, jamais retenu comme
   probleme jusqu'ici) et `ent_coef` n'a jamais été réglé (défaut SB3 = 0,0, cf. piste méthodologique
   notée après le run 24) - une politique déjà très confiante (quasi-déterministe) a peut-être trop peu
   de bruit résiduel pour "découvrir" le bon franchissement de ce corner précis, même si le gradient de
   valeur le favoriserait en théorie.
3. **Diagnostic visuel jamais fait sur ce point precis** (le screenshot du user portait sur le run 27,
   avant le fix continu) - pas encore vu ce que fait concrètement l'agent a cet endroit sur le modele
   actuel (oscillation ? collision repetee contre le mur ? renoncement net ?).

**Modèle produit** : `models/step2_goalcontinuous_to26M/final_model.zip` - meilleur combat de toute la
lignée `room_stage2` (80/80, quasi 2,0 kills/épisode), mais succès toujours à 0%, point de blocage
positionnel confirmé stable.

**Décision** : diagnostic visuel cible sur ce point precis avant de relancer un entrainement a l'aveugle
- cf. section suivante.

## Diagnostic visuel du run 28 (suite) (`watch_agent.py --debug-flow-field`, 2026-08-10)

**Observation utilisateur** (`models/step2_goalcontinuous_to26M/final_model.zip`, stochastique) :
**l'agent se colle contre le mur en haut du détour et ne bouge plus** - pas d'oscillation ni de tentative
répétée, un gel net. Confirme directement l'hypothèse 2 (effondrement d'exploration) plutôt que
l'hypothèse 1 (discontinuité de la formule de reward, qui aurait plutôt produit une hésitation/un
va-et-vient qu'un arrêt complet) : la politique, quasi-déterministe à ce stade (`train/std` ~0,19-0,22,
jamais retouché), a convergé vers une action qui bute sur le mur à cette position précise et n'a plus
assez de bruit résiduel pour en sortir.

## Correctif testé : `--ent-coef` (2026-08-10)

**Implémenté** (`train_ppo.py`) : nouveau flag `--ent-coef` (défaut `0.0` = défaut SB3, inchangé si
absent), branché sur `PPO(...)` et `PPO.load(..., ent_coef=...)` comme `learning_rate`/`target_kl`.
`check_env.py` intégralement vert.

**Décision** : test empirique avec `ent_coef=0.01` (contre 0.0 par défaut, jamais retouché depuis le
début du projet), reprise depuis `models/step2_goalcontinuous_to26M/final_model.zip` (~26,04M pas,
meilleur combat de la lignée, blocage confirmé visuellement) - `target_kl=0.03` reste actif comme
garde-fou. Cf. run 29.

## Run 29 — `step2_entcoef` (2026-08-10) — combat degrade, mais premiere trace de franchissement du coin bloquant

**Config** : identique au run 28 (suite), reprise depuis `models/step2_goalcontinuous_to26M/final_model.zip`
(~26,06M pas cumulés), **`ent_coef=0.01`** en plus. 2 000 000 pas, allé jusqu'au bout.

**Résultats (300 points d'évaluation déterministe)** : `success_rate` reste à 0,00 sur l'intégralité du
run. **Dégradation nette et mesurable du combat, observée en direct par le user pendant le run** :
`death_rate` 0 → 0,07-0,27 (bruité, stabilisé autour de 0,10-0,16 en fin de run), `room_cleared_rate`
1,00 → 0,84-0,93. **Pas une instabilité (`train/approx_kl` reste sain tout du long, 0,005-0,011, très
en dessous de `target_kl=0.03`) - une vraie dégradation progressive et propre**, cohérente avec le
mécanisme attendu : `train/std` monte continûment (0,177 → 0,337, quasi doublé) tout du long, confirmant
que `ent_coef` fait effectivement remonter l'exploration, au coût attendu de précision en combat (viser/
se positionner).

**Diagnostic positionnel (80 épisodes headless, `models/step2_entcoef/final_model.zip`)** - même méthode
que les runs 28/28-suite : 56/80 salles nettoyées (baisse cohérente avec le combat dégradé), 0/80 succès
réel. **Mais signal encourageant que les métriques globales masquaient** :
- **Distance minimale au centre de la sortie sur le MEILLEUR épisode : 42,4px** - nettement mieux que le
  plancher dur de 60-70px observé aux runs 28/28-suite (jamais franchi sur 5M pas supplémentaires sans
  exploration boostée).
- **Nouveau cluster de positions proches, distinct de l'ancien** : plusieurs des 10 positions les plus
  proches se situent maintenant autour de `(654-670, 99-104)` - **au-delà de x=610** (la frontière droite
  du mur miroir), donc dans la bonne colonne de case (celle de la sortie), à une hauteur encore un peu
  trop haute (y≈100 au lieu de y≈140). L'ancien point de blocage (`579-580, ~115`, jamais franchi aux
  runs 28/28-suite) apparaît encore dans le top 10 mais n'est plus systématique.
- Interprétation : une partie des épisodes (pas encore la majorité) **franchit maintenant le coin qui
  bloquait tous les runs précédents**, et se retrouve dans la bonne cellule mais pas encore à la bonne
  hauteur pour toucher la zone. Le blocage n'est donc pas structurel/impossible à franchir avec cette
  géométrie - juste rare avec le niveau d'exploration précédent (quasi nul).

**Analyse** : `ent_coef=0.01` confirme l'hypothèse d'effondrement d'exploration - un peu de bruit
supplémentaire suffit à parfois franchir un coin que la politique quasi-déterministe ne franchissait
JAMAIS (0/160 épisodes observés aux runs 28+28-suite). Mais le coût en combat est réel et le taux de
franchissement encore trop rare pour se traduire en succès mesurable sur ce budget. Compromis à trouver :
`0.01` est peut-être plus fort que nécessaire (coût élevé, bénéfice encore partiel) - un coefficient plus
modeste pourrait débloquer une part du gain sans autant abîmer le combat, ou le même coefficient avec
plus de budget pourrait suffire à consolider le franchissement plutôt que juste l'esquisser.

**Modèle produit** : `models/step2_entcoef/final_model.zip` - combat dégradé mais premier modèle a avoir
jamais atteint <50px de la sortie sur ce diagnostic. Pas retenu comme référence finale, mais preuve de
concept precieuse.

**Décision** : discuter avec le user - prolonger ce run (plus de budget au meme ent_coef), essayer un
ent_coef plus modeste (ex. 0.003-0.005) depuis la meme base, ou une autre piste.

## Run 29 (suite) — `step2_entcoef_to31M` (2026-08-10) — interrompu, ent_coef constant tourne en rond

**Config** : identique au run 29, reprise depuis `models/step2_entcoef/final_model.zip` (28,05M pas).
3 000 000 pas visés. **Interrompu par le user après ~1,4M pas** ("on perd du temps, ça décolle pas") -
`death_rate` oscillait entre 0,10 et 0,45 sans tendance claire sur toute la portion exécutée, aucune
consolidation ni dégradation nette, juste du bruit. Pas de `final_model.zip` (run non terminé), pas
retenu.

**Diagnostic** : `ent_coef` constant maintient un bruit d'exploration permanent qui empêche à la fois la
consolidation du franchissement (utile) et la stabilisation du combat (coûteux) - les deux tirent dans
des directions opposées sans jamais se départager sur ce budget.

## Correctif : `--ent-coef-decay-steps` (2026-08-10)

**Implémenté** (`train_ppo.py`) : `EntCoefDecayCallback`, décroissance linéaire de `--ent-coef` (valeur
de départ) vers `0.0` sur `--ent-coef-decay-steps` pas de CE run (pas un total absolu - relatif au
nombre de pas déjà accumulé par le modèle chargé). Défaut `0` = comportement inchangé (`ent_coef`
constant, comme avant). Log `train/ent_coef_scheduled` ajouté pour suivre la valeur réelle dans
TensorBoard. Principe : un coup de pouce d'exploration ponctuel pour (re)découvrir le franchissement du
coin, suivi d'un retour progressif à une politique précise pour consolider - plutôt qu'un bruit
permanent qui empêche les deux.

**Vérifié** : `check_env.py` intégralement vert, smoke test dédié (20 000 pas, décroissance sur 20 000
pas) confirmant numériquement la décroissance réelle (`ent_coef_scheduled` : 0,00795 → 0,0059 → 0,00386
→ 0,00181 → 0).

**Décision** : test avec `ent_coef=0.01` décroissant sur le premier tiers du budget (1M pas), puis 0
pour le reste (2M pas de consolidation), depuis `models/step2_entcoef/final_model.zip` (fin propre du
run 29, pas la prolongation dégradée du run 29-suite). Cf. run 30.

---

[PERFORMANCE.md]
# Performance de la boucle de jeu (Hotline Berlin)

_Genere automatiquement par `benchmark_fps.py` le 2026-08-08 12:39 UTC._

Objectif : mesurer le FPS theorique max de la logique de simulation dans plusieurs situations, en vue d'un futur entrainement d'agent RL (SAC/PPO). Le jeu affiche aujourd'hui plafonne artificiellement a ~50 FPS (`pg.time.delay(20)` dans `game.py`) quel que soit le cout de calcul reel : ce plafond n'a aucun sens pour un entrainement RL, qui voudra faire tourner l'environnement le plus vite possible (potentiellement en dizaines/centaines d'instances paralleles, sans rendu a l'ecran). Ce document mesure donc le cout REEL, sans ce plafond.

Chaque scenario est mesure deux fois : **logique seule** (mise a jour IA/collisions/tirs, sans dessiner - ce qui se rapproche le plus d'un futur environnement RL headless) et **logique+rendu** (ce que fait reellement `game.py` aujourd'hui, avec tous les `pg.draw.*`).

Parametres de mesure : 200 frames mesurees par scenario (apres 15 frames de chauffe).

## Resultats

| Scenario | Mode | FPS theorique | temps moyen/frame | min | max |
|---|---|---:|---:|---:|---:|
| carte_reelle_patrouille | logique seule | 13148 | 0.076 ms | 0.053 ms | 0.119 ms |
| carte_reelle_patrouille | logique+rendu | 437 | 2.290 ms | 1.891 ms | 3.621 ms |
| carte_reelle_poursuite | logique seule | 11268 | 0.089 ms | 0.067 ms | 0.362 ms |
| carte_reelle_poursuite | logique+rendu | 495 | 2.020 ms | 1.831 ms | 3.484 ms |
| salle_ouverte_poursuite_armee_5 | logique seule | 31761 | 0.031 ms | 0.029 ms | 0.081 ms |
| salle_ouverte_poursuite_armee_5 | logique+rendu | 8999 | 0.111 ms | 0.100 ms | 0.244 ms |
| salle_ouverte_poursuite_armee_10 | logique seule | 17728 | 0.056 ms | 0.049 ms | 0.094 ms |
| salle_ouverte_poursuite_armee_10 | logique+rendu | 6439 | 0.155 ms | 0.138 ms | 0.286 ms |
| salle_ouverte_poursuite_armee_20 | logique seule | 6532 | 0.153 ms | 0.119 ms | 0.423 ms |
| salle_ouverte_poursuite_armee_20 | logique+rendu | 3683 | 0.271 ms | 0.239 ms | 0.553 ms |
| salle_ouverte_poursuite_armee_40 | logique seule | 2289 | 0.437 ms | 0.356 ms | 0.796 ms |
| salle_ouverte_poursuite_armee_40 | logique+rendu | 1553 | 0.644 ms | 0.522 ms | 1.834 ms |
| stress_100_balles | logique seule | 13503 | 0.074 ms | 0.049 ms | 0.109 ms |
| stress_100_balles | logique+rendu | 511 | 1.956 ms | 1.849 ms | 2.992 ms |
| items_au_sol_15 | logique seule | 1024066 | 0.001 ms | 0.001 ms | 0.001 ms |
| items_au_sol_15 | logique+rendu | 130 | 7.690 ms | 6.067 ms | 16.567 ms |
| generation_carte_seule | N/A (pas une frame) | 1572 appels/s | 0.636 ms | 0.611 ms | 0.732 ms |

## Description des scenarios

- **carte_reelle_patrouille** : Carte generee normalement (create_map_broadsearch), 5 ennemis en patrouille, joueur immobile.
- **carte_reelle_poursuite** : Carte generee normalement, 5 ennemis forces en poursuite (chase) a la batte : cout du flow field (BFS sur la grille) + glissement le long des murs, sans tir.
- **salle_ouverte_poursuite_armee_5** : Salle sans mur, 5 ennemis en poursuite armes (pistolet/fusil), ligne de vue toujours degagee, tirent en continu (cooldown reel) : pire cas IA a distance.
- **salle_ouverte_poursuite_armee_10** : Salle sans mur, 10 ennemis en poursuite armes (pistolet/fusil), ligne de vue toujours degagee, tirent en continu (cooldown reel) : pire cas IA a distance.
- **salle_ouverte_poursuite_armee_20** : Salle sans mur, 20 ennemis en poursuite armes (pistolet/fusil), ligne de vue toujours degagee, tirent en continu (cooldown reel) : pire cas IA a distance.
- **salle_ouverte_poursuite_armee_40** : Salle sans mur, 40 ennemis en poursuite armes (pistolet/fusil), ligne de vue toujours degagee, tirent en continu (cooldown reel) : pire cas IA a distance.
- **stress_100_balles** : Carte reelle + 100 balles actives simultanement (positions/directions aleatoires fixes) : isole le cout de la boucle balles x objets de la carte.
- **items_au_sol_15** : 15 items pistolet/shotgun au sol, dessines chaque frame : pistolItem/shotgunItem.draw() rechargent l'image PNG depuis le disque a CHAQUE appel (pas de cache) -> candidat evident a optimiser en premier.
- **generation_carte_seule** : cout de `create_map_broadsearch()` seul, appele a chaque mort du joueur et a chaque fin de niveau reussie (donc potentiellement tres frequent dans un entrainement RL avec des episodes courts).

## Pistes d'optimisation identifiees

1. **`pistolItem.draw()` / `shotgunItem.draw()` rechargent l'image PNG depuis le disque a CHAQUE frame** (`pg.image.load('assets/...')` dans `draw()`), au lieu de charger l'image une seule fois et de reutiliser la surface (comme le fait deja `weapon_sprites` dans `game.py`). Voir le scenario `items_au_sol_15` ci-dessus pour l'impact mesure - c'est probablement le gain le plus facile et le plus important a court terme.
2. **La detection/collision ennemi fait une boucle O(n) sur tout `map_objects` par ennemi par frame** (`for object_to_compare in map_objects`) - avec plus d'ennemis ou une carte plus grande ce cout grandit vite. Une grille spatiale (deja disponible via `nav_graph`/les cases de `CELL_SIZE`) pourrait limiter les tests de collision aux objets de la case courante et des cases voisines plutot qu'a la carte entiere.
3. **Le rendu (`pg.draw.*`, `pg.image.load`, `pg.transform.scale`) domine largement le cout total** (comparer les colonnes logique seule / logique+rendu ci-dessus) - un environnement RL headless qui desactive le rendu recupere donc l'essentiel du gain de vitesse gratuitement, avant meme d'optimiser la logique elle-meme.
4. **`create_map_broadsearch()`** reconstruit toute la grille + relance un DFS/BFS a chaque reset - voir si son cout devient un goulot d'etranglement une fois les episodes RL tres courts (regarder le scenario `generation_carte_seule`).

## Comment relancer

```
python benchmark_fps.py
```

Regenere ce fichier et ajoute une ligne par scenario dans `docs/performance_history.csv` (avec la date) pour suivre l'evolution des optimisations dans le temps.

---

[ideas_backlog.md]
# Idées mises de côté

> Pistes discutées et jugées valables mais pas retenues pour l'instant (pas abandonnées) — à reprendre
> une fois la lignée en cours (`docs/training_log_v2.md`) stabilisée.

## Deux politiques PPO séparées : combat vs navigation post-combat (2026-08-10)

**Contexte** : après ~30M pas sur `room_stage=2` (`docs/training_log.md`), diagnostic répété que
`ent_coef` nécessaire pour franchir le coin bloquant de la sortie dégrade systématiquement la précision
du combat — les deux objectifs tirent dans des directions opposées sur les besoins d'exploration au sein
d'une seule politique.

**Idée** : entraîner deux PPO distincts plutôt qu'une seule politique qui doit faire les deux :
- **Politique combat** : active tant qu'au moins un ennemi est en vie, peut rester une politique
  quasi-déterministe et précise sans compromis.
- **Politique navigation** : prend le relais une fois `enemies_alive == 0` (condition monotone dans une
  salle de ce design — ne redevient jamais vraie une fois fausse, donc pas de risque de va-et-vient entre
  les deux politiques), entraînée sur une salle déjà vide, avec juste le reward de progression vers la
  sortie et son propre `ent_coef`, sans avoir à préserver la précision de tir.

**Avantage attendu** : supprime le compromis à la racine — chaque politique a ses propres
hyperparamètres, pas de tension entre precision de tir et exploration.

**Pourquoi mis de côté (pour l'instant)** : le user a préféré d'abord repartir sur une lignée où le
combat lui-même est mieux généralisé (`docs/training_log_v2.md`, `room1` avec mur randomisé, aucune
connaissance de la sortie) avant de rattaquer la partie navigation, plutôt que de complexifier tout de
suite l'architecture d'inférence (chargement de deux modèles + logique de switch).

## Contrôleur scripté par flow field pour la navigation post-combat (2026-08-10)

**Contexte** : même diagnostic que ci-dessus (coin bloquant de `room_stage=2`, jamais franchi de façon
fiable par RL malgré 30M+ pas).

**Idée** : le jeu dispose déjà d'un flow field BFS conscient des murs vers la sortie
(`HotlineEnv._goal_flow_field` / `_flow_field_direction`, `env.py`), déjà utilisé pour calculer
l'observation `gdir_cos/gdir_sin` ET pour faire marcher les ennemis vers le joueur en évitant les murs
(`object_.walk`, `env.py`). Plutôt que de faire *apprendre* à l'agent à suivre cette direction (ce que
RL n'a jamais réussi à faire de façon fiable sur ce coin précis), utiliser directement
`(gdir_cos, gdir_sin)` comme action du joueur quand `enemies_alive == 0` — contrôleur scripté,
déterministe, zéro entraînement, zéro risque d'effondrement d'exploration.

**Avantage attendu** : quasi gratuit à tester (10-15 min), donnerait un run complet fonctionnel
immédiatement si la géométrie est effectivement franchissable (ce qui validerait aussi qu'il ne s'agit
pas d'un problème de géométrie de niveau).

**Inconvénient à surveiller si repris** : rendu potentiellement moins "naturel" que la physique du
joueur (inertie, collisions) si le flow field est suivi trop rigidement — à tester visuellement avant de
généraliser.

**Pourquoi mis de côté (pour l'instant)** : le user veut d'abord une politique de navigation
véritablement apprise, pas un contournement scripté — cette option reste un filet de sécurité si la
politique apprise (via l'idée ci-dessus, ou une autre) continue de ne pas converger après le nouveau
travail de généralisation du combat.

---

[GAMEPLAY.md]
# Mécaniques de jeu (Hotline Berlin)

Non, il n'y avait pas de doc à jour avant celle-ci — le `README.md` ne dit que
"c'est un clone minimaliste de Hotline Miami, il faut Python 3 + pygame".
Ce document décrit l'état réel du jeu tel qu'implémenté dans `game.py`,
`classes_functions.py`, `weapons.py` et `items.py`.

## Contrôles

| Touche / bouton | Action |
|---|---|
| Z / Q / S / D | Déplacement (ZQSD, clavier AZERTY) |
| Souris | Vise le personnage vers le curseur |
| Clic gauche | Attaque : mêlée si poings/batte équipés, tir si arme à feu équipée |
| Clic droit | Lance l'arme équipée vers le curseur (aucun effet si poings) |
| Molette | Bascule entre les poings et l'arme actuellement portée |
| Échap | Quitte le jeu |

## Le joueur

- Rayon 10px (boîte de collision 20x20), vitesse de déplacement 5px/frame.
- Meurt instantanément au contact d'un ennemi non étourdi, ou touché par une
  balle ennemie. La mort remet les points à 0, régénère entièrement la carte
  et renvoie le joueur au point de spawn.

## Armes

Le joueur ne porte **qu'une seule arme à la fois** (en plus des poings, qui
sont toujours disponibles et ne peuvent pas être perdus). Ramasser une arme
au sol ne l'équipe que si elle est **strictement meilleure** que celle en
main, selon ce classement :

```
poings (FISTS) < batte (BAT) < pistolet (PISTOL) < fusil à pompe (SHOTGUN)
```

Ramasser une arme de rang inférieur ou égal ne fait rien (elle reste au sol) —
sauf s'il s'agit du **même type d'arme déjà en main**, auquel cas ça
recharge les munitions sans rien changer d'autre. Équiper une arme
supérieure fait tomber l'ancienne au sol (ramassable) à la position du
joueur.

| Arme | Type | Cooldown | Portée / munitions | Remarques |
|---|---|---:|---:|---|
| Poings (FISTS) | mêlée | 350 ms | 30px depuis le centre | Par défaut, infinie, jamais jetable |
| Batte (BAT) | mêlée | 550 ms | 65px depuis le centre | Ramassable au sol uniquement |
| Pistolet (PISTOL) | à distance | 200 ms | +7 munitions au ramassage | Tir simple visé à la souris |
| Fusil à pompe (SHOTGUN) | à distance | 1180 ms | +2 munitions au ramassage | 3 projectiles en éventail (±10°) |

- **Mêlée** : scan instantané au clic (pas une hitbox permanente) — tue
  l'ennemi le plus proche à portée, sans notion d'angle/de cône. Silencieuse
  (n'alerte pas les autres ennemis).
- **Armes à feu** : consomment des munitions, jouent un son, et le tir
  **alerte les ennemis à distance** (voir plus bas).
- **Lancer** (clic droit) : éjecte l'arme en main vers le curseur à la même
  vitesse qu'une balle (20px/frame). Si elle touche un mur/le bord de
  l'écran, elle tombe au sol à cet endroit (ramassable). Si elle touche un
  ennemi, elle l'**étourdit 2,5s** (immobile, inoffensif, ne meurt pas) au
  lieu de le tuer, et tombe à ses pieds. Le joueur repasse automatiquement
  aux poings après un lancer.
- Un indicateur (trait coloré) part du personnage dans sa direction de visée
  et change de couleur/forme selon l'arme portée — grisé pendant le cooldown
  de l'arme de mêlée équipée.

## Les ennemis

Chaque ennemi est armé au hasard d'une **batte, d'un pistolet ou d'un fusil**
(jamais à mains nues). À sa mort (par balle ou par mêlée), il laisse tomber
son arme au sol, sauf s'il avait une batte de type poings... (N/A, les
poings ne sont jamais un loadout ennemi).

### Machine à états

```
patrouille --(repère le joueur)--> alerté --(0.35s)--> poursuite
    ^                                                       |
    |                                                       v
    +---------------------- (aucun retour automatique) -----+
poursuite --(touché par une arme lancée)--> étourdi --(2.5s)--> poursuite
```

- **Patrouille** : va-et-vient en ligne droite sur un axe (horizontal ou
  vertical), rebondit en cas de collision avec un mur/autre ennemi.
- **Alerté** (temps de réaction, 0,35s) : reste totalement immobile, se
  tourne vers le joueur (visible via l'indicateur d'arme), mais ne bouge pas
  et ne tire pas encore — laisse une petite fenêtre de réaction au joueur.
- **Poursuite** : se déplace directement vers le joueur en suivant le chemin
  le plus court à travers les couloirs de la carte (voir "Navigation"
  ci-dessous). S'il est armé à distance, tire sur le joueur dès qu'il a une
  ligne de vue dégagée, avec le cooldown de son arme.
- **Étourdi** : ne bouge pas, ne tue pas le joueur au contact, se relève
  seul en poursuite après 2,5s. Aucune mécanique d'exécution/achèvement
  (délibérément exclue).
- Une fois en poursuite, un ennemi **n'y retourne jamais** en patrouille
  (pas de désescalade/perte d'intérêt) — simplification volontaire.

### Détection

Un ennemi en patrouille passe en alerte si l'une de ces conditions est vraie :
- **Vue** : le joueur est à moins de **220px**, dans son **cône de vision de
  80°** (±40° autour de sa direction de marche, donc toujours un axe
  cardinal), **et** aucun mur ne coupe la ligne droite entre les deux
  (vérifié par intersection segment/rectangle, un test par mur).
- **Ouïe** : un coup de feu (pas la mêlée, silencieuse) a été tiré il y a
  moins d'une seconde, à moins de **350px** de l'ennemi — non directionnel,
  through-wall (le son traverse les murs, contrairement à la vue).

### Navigation (poursuite)

Les ennemis en poursuite ne foncent pas juste en ligne droite : ils suivent
un **flow field** calculé une seule fois par frame (BFS partagé depuis la
case du joueur sur la grille de la carte, ~8x6 cases de 100px), que tous les
ennemis en poursuite consultent pour savoir dans quelle case avancer —
beaucoup moins coûteux qu'un pathfinding individuel par ennemi. En cas de
collision (mur/autre ennemi), l'ennemi tente de glisser en ne gardant que
l'axe de déplacement non bloqué (X ou Y) plutôt que de se figer.

**Limitation connue** : c'est un plus-court-chemin sur la grille, pas de la
vraie navigation continue — un ennemi peut donc encore rester bloqué
quelques frames contre un coin de mur mal aligné avant de s'en dégager.

## Niveau

- Carte générée proceduralement à chaque partie/mort/niveau réussi : un
  labyrinthe parfait (arbre couvrant, donc sans boucle) creusé par DFS
  randomisé sur une grille de cases de 100px.
- 5 ennemis, quelques pistolets/fusils/battes au sol, une zone de sortie
  (rectangle rose) placée en bas à droite.
- **La zone de sortie ne fonctionne que si tous les ennemis de la carte sont
  morts** — sinon marcher dessus ne fait rien.
- Terminer un niveau (zone atteinte, plus aucun ennemi) : +500 points,
  nouvelle carte, joueur renvoyé au spawn.
- Tirer une arme à feu : -50 points (encourage la discrétion/la mêlée).
- Tuer un ennemi (balle ou mêlée) : +100 points.
- Mourir : points remis à 0, nouvelle carte.

## Limitations assumées (pertinent pour un futur agent RL)

- Pas de vraie ligne de vue pour l'alerte sonore (l'ouïe traverse les murs).
- Le tir ennemi vérifie la ligne de vue au moment du tir, mais pas en continu
  pendant qu'il vise/se déplace.
- Pas de désescalade : un ennemi alerté reste une menace jusqu'à sa mort.
- La navigation en poursuite suit la grille de cases (pas de pathfinding
  fin pixel par pixel), avec un déblocage "glissement d'axe" en cas de coin.
- Un seul flow field par frame, partagé par tous les ennemis en poursuite
  (recalculé à chaque frame depuis la case du joueur).

Voir [`PERFORMANCE.md`](PERFORMANCE.md) pour le coût mesuré de chacune de ces
mécaniques (utile pour savoir ce qu'il faut optimiser avant de faire tourner
l'environnement à grande vitesse pour un entraînement SAC/PPO).

---

[agent_ia_design.md]
# Conception de l'agent IA (RL) — notes de travail

> Doc vivant. Objectif : garder trace des décisions de conception de l'agent qui apprend à jouer,
> et surtout **pourquoi**, pour pouvoir reprendre le fil sans tout re-débattre.
> Dernière mise à jour : 2026-08-08.

## Contexte et objectif

Le jeu (`game.py`, `classes_functions.py`, `weapons.py`, `items.py`) est un clone type Hotline Miami
en vue du dessus, déjà fonctionnel et optimisé (voir historique git : IA ennemie à états, flow field
partagé, génération de labyrinthe). L'objectif de ce chantier : entraîner un agent (RL) à jouer ce
jeu, en réutilisant au maximum ce qui existe déjà côté moteur (états ennemis, `nav_graph`, flow field)
plutôt que de le redériver.

Principe directeur retenu dès le départ : **partir simple, itérer**. On simplifie volontairement le
problème pour une v1 (une arme, peu d'ennemis, carte fixe, indice de direction), et on complexifie
ensuite par curriculum une fois qu'une brique fonctionne.

## Ce que le moteur expose déjà (à réutiliser, pas à redériver)

- **Machine à états ennemis** (`classes_functions.py`, classe `enemy`) : `patrol / alerted / chase /
  stunned`, détection par cône de vision + ligne de vue (`sees`, `has_line_of_sight`) et par bruit
  (`HEARING_RADIUS`, `last_noise`).
- **Carte = labyrinthe parfait** : `create_map_broadsearch` génère un arbre couvrant aléatoire sur une
  grille de cellules 100px (8×6 à 800×600). `nav_graph` contient exactement les passages ouverts entre
  cellules adjacentes, et un passage ouvert occupe **toute la largeur** de la frontière entre les deux
  cellules (cf. `coordinates_to_wall`) — donc "connecté dans `nav_graph`" ⟺ "physiquement traversable
  en ligne quasi droite", pas besoin de raycasting fin pour la structure du labyrinthe.
- **`compute_flow_field(nav_graph, start_cell)`** : BFS déjà utilisé chaque frame pour faire chasser
  les ennemis vers le joueur. Le même algorithme, appliqué depuis la `zone` de sortie, donne un indice
  de direction "vers la sortie" pour l'agent — aucun nouveau calcul à inventer.
- **Visée continue partout** : `aim_steps` (`weapons.py`) calcule un angle continu, utilisé identiquement
  par le tir du joueur (souris) et `enemyshoot`. Rien n'est discrétisé côté visée dans le jeu existant.
- **Reward implicite déjà présent** : `game_points` (+100 kill, -50 par tir, +500 fin de niveau). La mort
  déclenche `reset_game`, qui **régénère une carte aléatoire** — donc l'agent ne peut jamais mémoriser un
  layout, il doit généraliser dès le départ (sauf si on fige la carte via un flag, voir plus bas).
- **Pas de PV** : un contact ennemi = mort instantanée (`check_colission` + `reset_game`). Signal de
  reward très sparse tant que l'agent ne sait pas encore éviter le contact.

## Décisions actées

### 1. Espace d'observation : vecteur d'état structuré (pas des pixels)

**Décision** : observation = vecteur numérique construit à partir de l'état du jeu (positions, états,
connectivité de carte), pas une capture d'écran.

**Pourquoi** : le jeu est géométrique (positions, distances, angles, connectivité de grille) — un CNN
sur pixels réapprendrait depuis zéro des informations qu'on peut lire directement dans le code. Le
vecteur d'état donne un entraînement bien plus rapide (sample efficiency), tourne sans GPU si besoin,
et s'intègre nativement à PPO/MLP dans Stable-Baselines3. Pixels restent une option pour plus tard si
on veut un jour un agent qui généralise à un rendu visuel variable.

**Contenu du vecteur (v1)** :

- **Joueur** : position normalisée (x, y), arme courante (one-hot), munitions normalisées de l'arme
  courante.
- **Ennemis** (k plus proches, taille fixe avec padding "absent" si moins d'ennemis) : pour chacun,
  **direction unitaire (cos, sin) + distance normalisée séparément** (pas un delta brut dx/dy — voir
  raison ci-dessous), état one-hot (`patrol/alerted/chase/stunned`), arme one-hot.
- **Menace prioritaire** : direction (cos, sin) + distance de l'ennemi en `chase` le plus proche,
  exposée séparément des k-plus-proches génériques, pour ne pas obliger l'agent à "deviner" quel slot
  est urgent.
- **Carte locale** : connectivité issue de `nav_graph` autour de la cellule du joueur (4 booléens
  N/S/E/W pour la cellule courante, extensible à une fenêtre 3×3 si besoin).
- **Objectif** : direction cardinale vers la `zone` de sortie (flow field symétrique à celui des
  ennemis, calculé depuis la sortie), distance restante normalisée, flag "ennemis restants".

  > Décision liée : **on donne cet indice de direction dès la v1** plutôt que de laisser l'agent
  > apprendre à explorer seul. Raison : on veut isoler l'apprentissage du combat/positionnement (la
  > partie intéressante d'un agent "Hotline") de l'apprentissage de l'exploration/pathfinding, qui est
  > un problème déjà résolu classiquement dans le moteur (BFS). Curriculum envisagé : une fois le combat
  > maîtrisé, retirer l'indice progressivement pour forcer l'exploration autonome (nécessitera alors une
  > politique avec mémoire, ex. LSTM, car sans indice le problème devient partiellement observable dans
  > le temps).

**Pourquoi direction unitaire + distance plutôt que delta brut (dx, dy)** : un delta brut mélange
direction et distance dans deux nombres dont l'échelle dépend de la taille de la carte, ce qui est plus
dur à apprendre pour le réseau. Décomposer en (cos, sin, distance) isole explicitement "où regarder" de
"à quelle distance", ce qui correspond directement à ce dont l'agent a besoin pour piloter la visée.

### 2. Espace d'action : entièrement continu

**Décision** : `Box(-1, 1, shape=(5,))` = `[move_x, move_y, aim_x, aim_y, tirer]` (le booléen tirer
obtenu en seuillant `tirer > 0` dans le `step()`), plutôt qu'un espace discret/`MultiDiscrete`.

**Pourquoi (révision par rapport à la proposition initiale à 8 directions)** : le jeu n'a **aucune**
discrétisation de la visée ni du déplacement de chasse chez les ennemis — `aim_steps` calcule un angle
continu (utilisé identiquement par le joueur à la souris et par `enemyshoot`), et `enemy.walk` en état
`chase` se déplace selon un vecteur continu (`dx/dist, dy/dist`), pas seulement sur 4/8 axes. Un agent
limité à 8 (voire 16/32) directions de visée serait donc structurellement désavantagé par construction
dès que la cible n'est pas alignée pile sur un rayon — augmenter la résolution discrète retarde le
problème sans le supprimer. Passer déplacement + visée en continu restaure la parité avec ce que peuvent
faire les ennemis et un joueur humain à la souris.

**Bénéfice secondaire** : un espace `Box` unique est aussi plus simple à implémenter qu'un espace
hybride discret/continu (qui n'est pas nativement supporté par PPO dans Stable-Baselines3 — il aurait
fallu soit un `MultiDiscrete` + un `Box` combinés via une politique custom, soit un `Dict`/`Tuple`
action space non standard). Ici, un seul `Box` continu = PPO continu classique, bien supporté.

**Actions volontairement exclues de la v1** : lancer d'arme (clic droit), changement d'arme (molette).
Curriculum : à réintroduire une fois déplacement + combat de base maîtrisés.

> **Mise à jour (curriculum étape 4, 2026-08-09)** : le lancer d'arme est réintroduit via le flag
> `HotlineEnvConfig.enable_throw` — 6e dimension d'action `throw` (seuillée comme `fire`), ramassage
> réactivé en `single_weapon`, bloc d'observation "arme au sol la plus proche" (+4 dims, `OBS_DIM`
> 79→83), bonus de reward `reward_throw_stun_bonus`. Détails et résultats dans
> `docs/training_log.md` ("Curriculum étape 4", runs 11+). Le changement de switch d'arme (molette)
> reste exclu pour l'instant.

### 3. Reward

**v1 (run 1, cf. `docs/training_log.md`)** : reward = delta de `game_points` (+100 kill, -50 par tir,
+500 fin de niveau) + malus par tick + bonus de rapprochement vers la sortie quand aucun ennemi n'est
en `chase` + gros malus sur mort. **Résultat mesuré : l'agent a appris à fuir, jamais à engager** — le
malus fixe de -50 par tir punissait autant un tir bien visé qu'un tir à l'aveugle, et une politique
passive (ne jamais tirer, éviter tout contact) accumulait strictement moins de malus qu'une politique
qui tente le combat sans encore savoir viser. Diagnostic détaillé dans `docs/training_log.md`, run 1.

**v2 (à partir du run 2)** : reward détaché de `game_points` (qui reste l'affichage humain à l'écran,
inchangé — -50/tir, +100/kill, +500/niveau, aucun changement de gameplay humain). Composantes
explicites du reward RL :

- `+100` par kill,
- **qualité de visée au moment du tir**, remplace le malus fixe : `+2` si le tir part dans un cône de
  15° autour d'un ennemi présent, `-5` sinon (0 si plus aucun ennemi en vie) — encourage à *tenter*
  d'engager plutôt que de sanctionner toute tentative de tir,
- `+500` en fin de niveau (succès),
- malus par tick (`0.01`),
- bonus de rapprochement vers la sortie quand aucun ennemi n'est en `chase` (`0.1` × sauts de cellule
  gagnés),
- malus fixe sur mort (`50.0`).

**Résultat mesuré (run 2)** : le bonus de visée retarde la fuite (pic temporaire à ~16% d'épisodes
avec un kill) mais ne suffit pas — il ne se déclenche que si l'agent ose déjà tirer, or rien ne le
pousse à s'approcher d'un ennemi pour en arriver là. La fuite pure reste l'optimum local dominant sur
la durée. Diagnostic détaillé dans `docs/training_log.md`, run 2.

**v3 (run 3)** : ajout d'un bonus de rapprochement vers l'ennemi le plus proche (tout état confondu,
pas seulement `chase`), symétrique au bonus de rapprochement vers la sortie mais en pixels bruts (un
ennemi se déplace en continu, pas de notion de "case") : `0.001` × pixels de rapprochement par step,
échelle choisie pour être comparable au bonus de sortie (~100px ≈ 1 saut de cellule ≈ 0.1).

**Résultat mesuré (run 3)** : `success_rate` apparaît enfin (jusqu'à 16% au pic), mais retombe à 0 en
fin d'entraînement comme aux runs précédents. Constat plus précis : même à son pic de performance,
`ep_rew_mean` (-103 à -180) restait bien pire que celui de la fuite pure (-20 à -30) — l'engagement
n'était pas encore rentable en espérance, à cause du cumul des malus (mort -50, tirs à l'aveugle -5 ×
un nombre non borné vu les munitions illimitées) qui dépassait les gains rares. Diagnostic détaillé
dans `docs/training_log.md`, run 3.

**v4 (à partir du run 4)** : réduction conjointe de deux malus pour rendre l'engagement rentable même à
faible taux de réussite : `reward_shot_wild_penalty` `5.0 → 2.0`, `reward_death_penalty` `50.0 → 10.0`.
Changement à deux coefficients à la fois (dérogation ponctuelle à l'approche "un changement à la fois")
car les deux visent le même objectif (rendre le calcul espérance-de-gain favorable à l'engagement) et
sont soupçonnés d'agir dans le même sens.

**Résultat mesuré (run 5, après correction du bug de traversée de murs)** : combat authentique et solide
(91% de pièces nettoyées, 12% de morts), mais `success_rate` (nettoyer + sortir) resté à **0% sur les
2M pas** — l'agent ne cherche jamais la sortie une fois l'ennemi mort. Observation visuelle (session
utilisateur) : l'agent "campe" et vise/tire sur place au lieu d'aller au contact, laissant l'ennemi
alerté venir de lui-même. Diagnostic détaillé dans `docs/training_log.md`, run 5.

**v5 (à partir du run 6)** : trois corrections liées à la conscience des murs et à la ligne de vue :
- **Bug découvert en creusant la demande utilisateur** : la direction vers la sortie (`goal_hint`)
  était en réalité une **ligne droite** vers le centre de la `zone`, ignorant les murs, alors que seule
  la *distance* affichée passait par le flow field (BFS) — contrairement à ce que ce document affirmait
  depuis le run 1. Corrigé : la direction utilise maintenant le flow field comme la distance
  (`_flow_field_direction`, cf. `env.py`). A pu contribuer au 0% de succès du run 5.
- **Bonus de rapprochement vers l'ennemi (run 3) et la "menace prioritaire" de l'observation** :
  utilisaient une ligne droite (`reward_enemy_approach_scale` en px, direction à vol d'oiseau) —
  remplacés par un flow field depuis la cellule de l'ennemi le plus proche (tout état confondu),
  recalculé à chaque step puisque l'ennemi se déplace (contrairement à la sortie, fixe pour l'épisode).
  `reward_enemy_approach_scale` repassé en unité "sauts de cellule" (`0.001 → 0.1`, même échelle que
  `reward_goal_approach_scale`) pour correspondre au changement d'unité (px → sauts).
- **Bonus de visée (run 2)** : ne compte plus un ennemi comme "bien visé" si un mur bloque la ligne de
  vue (`has_line_of_sight`, déjà utilisée par l'IA ennemie) — tirer droit sur un ennemi cache derrière
  un mur ne peut de toute façon pas le toucher, ne doit pas être récompensé comme un engagement.
- **Debug** : flag `debug_show_directions` (jamais actif par défaut) affiche deux flèches sur la
  fenêtre de rendu — bleu vers la sortie, orange vers l'ennemi le plus proche — pour vérifier
  visuellement le pathfinding (`watch_agent.py --debug-directions`).

Approche itérative assumée : une composante à la fois, on regarde l'effet sur les courbes
(`death_rate`, `room_cleared_rate`, `kills_per_episode`, `success_rate`) avant le prochain ajustement,
plutôt que de tout retuner en une fois. Historique complet des runs et des changements de reward dans
`docs/training_log.md`.

### 4. Refactor du moteur : flags, gameplay humain intact

**Décision explicite de l'utilisateur** : le refactor de structure est libre, mais **aucune règle de
gameplay n'est supprimée** — tout changement de comportement doit être **activable/désactivable par un
flag**, avec le comportement par défaut identique au jeu actuel (jouable au clavier/souris sans rien
activer).

Flags prévus :

- `HEADLESS` — désactive `pg.display.update()` / `pg.time.delay(20)` pour tourner à vitesse CPU max
  pendant l'entraînement.
- `FIXED_MAP` — fige une carte unique (seed fixe) pour la v1 d'entraînement ; la randomisation à chaque
  mort reste le comportement par défaut.
- `ENEMY_COUNT` — override du nombre d'ennemis générés (démarrer à 1-2 au lieu de ~5 par carte).
- `SINGLE_WEAPON` — l'agent démarre avec un pistolet à munitions illimitées, pickup/switch désactivés
  (uniquement en mode agent ; le mode humain garde l'arsenal complet).
- `GOAL_HINT` — active l'exposition du flow field vers la sortie dans l'observation (cf. section 1).

**Chantier technique associé** : extraire l'état aujourd'hui en variables globales + boucle
`while running` de `game.py` dans une classe `HotlineEnv(gymnasium.Env)` avec `reset()` / `step(action)`,
découplée de `pg.key.get_pressed()` / `pg.mouse.get_pos()` (l'action vient de l'agent, pas des
périphériques). Le mode humain reste un point d'entrée `if __name__ == "__main__":` qui pilote cette
même classe via clavier/souris réels, pour ne rien dupliquer.

### 5. Stack technique

- **Gymnasium** pour l'interface d'environnement (`reset`/`step`/`observation_space`/`action_space`).
- **Stable-Baselines3, PPO (action continue)** comme premier algorithme — robuste, bien documenté,
  gère nativement un `Box` d'action, policy MLP suffisante pour un vecteur d'état de cette taille.
- **GPU disponible** côté utilisateur : peu déterminant pour la taille du réseau (MLP petit vu la
  taille du vecteur d'observation), mais utile pour paralléliser beaucoup d'environnements
  (`SubprocVecEnv`) et/ou si on introduit plus tard une politique récurrente (LSTM) pour le curriculum
  "sans indice de direction" (section 1) ou une branche pixels (option écartée pour la v1, cf. section 1).

### 6. Curriculum envisagé (ordre approximatif)

1. Carte fixe, 1-2 ennemis, une arme illimitée, indice de direction vers la sortie actif → valider que
   l'agent apprend déplacement + combat de base.
2. Augmenter le nombre d'ennemis, garder la carte fixe.
3. Randomiser la carte (comportement par défaut du jeu) → généralisation.
4. Réintroduire pickup/switch d'arme, lancer d'arme.
5. Retirer progressivement l'indice de direction vers la sortie → exploration autonome (nécessite
   probablement une politique récurrente).

## Implémentation v1 (statut : fait)

Le refactor décrit ci-dessus est implémenté et vérifié (`check_env.py` : conformité à l'API Gymnasium
via `gymnasium.utils.env_checker`, smoke test de 2000 steps aléatoires, déterminisme de `FIXED_MAP`,
débit headless mesuré à ~136× le plafond du mode humain à 50 FPS). Playtest manuel du mode humain
(`game.py`) validé : déplacement, tir, corps-à-corps, lancer/switch d'arme, ramassage, transition de
niveau, mort, ESC.

**Vecteur d'observation final** (79 dimensions, `Box(-1, 1, (79,))`, ordre exact de `HotlineEnv._get_obs`) :

| Bloc | Dimensions | Contenu |
|---|---|---|
| Joueur | 7 | position (x, y) normalisée, arme courante one-hot (FISTS/PISTOL/SHOTGUN/BAT), munitions normalisées |
| Ennemis proches (k=5) | 60 (5×12) | par slot : présence, direction (cos, sin), distance normalisée, état one-hot, arme one-hot |
| Menace/cible prioritaire | 4 | présence, direction (cos, sin) **consciente des murs** (flow field depuis la cellule de l'ennemi vivant le plus proche, tout état confondu — mis à jour depuis le run 6, cf. `docs/training_log.md`), distance en sauts de cellule |
| Connectivité locale | 4 | passages ouverts N/S/E/W de la cellule du joueur (lu dans `nav_graph`) |
| Objectif | 4 | direction (cos, sin) **consciente des murs** (flow field vers la sortie — corrigé au run 6, c'était une ligne droite avant, cf. `docs/training_log.md`), distance en sauts de cellule normalisée, flag ennemis restants |

**Action finale** : `[move_x, move_y, aim_x, aim_y, tirer]`, `Box(-1, 1, (5,))`. La visée est reconstruite
comme un point très éloigné dans la direction `(aim_x, aim_y)` (constante `AIM_LOOKAHEAD`), puisque
`aim_steps` ne dépend que de l'angle, pas de la distance au point visé.

**Reward v1 (implémentation initiale, dépassée)** : delta de `game_points` (+100 kill, -50 tir réussi,
+500 niveau) − malus par tick (`reward_tick_penalty=0.01`) + bonus de rapprochement vers la sortie quand
aucun ennemi n'est en `chase` (`reward_goal_approach_scale=0.1` × sauts de cellule gagnés ce step) −
malus de mort (`reward_death_penalty=50.0`). **Voir section 3 ci-dessus (v2 à v5) et
`docs/training_log.md` pour l'état actuel** — le reward a été révisé à chaque run suite aux résultats
mesurés (détachement de `game_points`, bonus de visée, bonus de rapprochement ennemi, corrections de
conscience des murs/ligne de vue).

**Flags implémentés** (défaut = comportement humain actuel dans tous les cas) : `headless`, `fixed_map`
(+ `map_seed`), `enemy_count`, `single_weapon`, `goal_hint`, `max_episode_steps`.

### Découverte en cours d'implémentation : horloge simulée

Les cooldowns d'armes (`weapons.py`) et les timers d'IA ennemie (`classes_functions.py` : délai de
réaction, durée d'étourdissement, fraîcheur du bruit) étaient basés sur `time.time()` réel — cohérent
avec un jeu plafonné à 50 FPS réels, mais incompatible avec l'intérêt même du mode headless (tourner
bien plus vite que le temps réel) : sans correction, ces mécaniques restaient bridées à leur rythme
temps réel habituel quel que soit le nombre de `step()` exécutés par seconde. Correction : paramètre
optionnel `now=None` (défaut = `time()`/`time.time()` réel, comportement humain inchangé) ajouté à
`shootweapon`, `meleeattack`, `melee_on_cooldown`, `enemyshoot` (`weapons.py`) et à `enemy.stun`,
`enemy.update_state` (`classes_functions.py`). `HotlineEnv` maintient une horloge simulée
(`self._sim_time`, +1/50s par `step()` — un step = une frame simulée à 50 FPS comme le jeu d'origine ;
jamais réinitialisée entre épisodes pour rester monotone comme le serait `time.time()` réel) et la
propage à tous ces appels.

### Bug critique corrigé : traversée de murs par mouvement continu non aligné

Découvert en observant un agent entraîné jouer (`watch_agent.py`) : le joueur pouvait traverser les
murs. `_apply_player_movement` s'appuyait sur `compute_player_axis_blocks`, qui détecte un mur par
égalité stricte de pixels (`mur.left == joueur.left + joueur.width`) — correct uniquement si le joueur
se déplace par pas exacts de `PLAYER_MOVE_VEL` (vrai au clavier, faux pour une action continue d'agent
qui peut désaligner le joueur de la grille). Corrigé en appliquant le déplacement de façon tentative et
en l'annulant sur chevauchement réel (pas juste un contact exact), comme pour le glissement des ennemis
le long des murs. **Un run d'entraînement complet (run 4, cf. `docs/training_log.md`) s'est avéré
n'avoir appris qu'à exploiter ce bug** (90% de réussite mesurée pendant l'entraînement → 0% après
correction, sur le même modèle) — invalidé, à refaire. Régression couverte par `check_env.py`
(vérification 5).

### Contrainte connue : une seule instance HotlineEnv par processus

pygame/SDL n'a qu'un seul état d'affichage global par processus. Pour paralléliser l'entraînement,
utiliser un VecEnv à processus séparés (`SubprocVecEnv` de Stable-Baselines3), pas un `DummyVecEnv`
(qui ferait tourner plusieurs `HotlineEnv` dans le même processus et se marcheraient dessus au niveau
de cet état global).

### Environnement de développement

Dépendances dans `requirements.txt`. Environnement virtuel dédié `.venv/` à la racine du repo (isolé de
l'installation Miniconda de base, vu le poids de `torch`). `pip install -r requirements.txt` installe
`torch` en version CPU par défaut ; pour un GPU NVIDIA (ex. RTX 3050 utilisée en dev), réinstaller la
variante CUDA correspondante ensuite (commande donnée en commentaire dans `requirements.txt`).

## Questions ouvertes / à trancher plus tard

- Coefficients précis du reward shaping : des valeurs par défaut sont en place
  (`reward_tick_penalty=0.01`, `reward_goal_approach_scale=0.1`, `reward_death_penalty=50.0`) mais pas
  encore tunées empiriquement — à ajuster une fois l'entraînement lancé.
- Taille de la fenêtre de connectivité de carte dans l'observation (v1 : cellule courante seule, pas de
  fenêtre 3×3).
- Valeur de *k* (v1 : 5, choisi car c'est aussi le nombre d'ennemis par défaut d'une carte).
- Faut-il un système de PV avant d'entraîner sérieusement, ou la mort instantanée reste-t-elle une
  règle de gameplay à garder telle quelle (v1 : gardée telle quelle, pas de flag PV pour l'instant) ?
- Fréquence de décision de l'agent (v1 : un `step()` par frame simulée à 50 FPS, pas de frame-skip —
  à revisiter si l'entraînement s'avère trop lent à converger en nombre de steps).

## Prochaines étapes

- ~~Script d'entraînement PPO de fumée sur la config curriculum étape 1~~ → fait (`train_ppo.py`),
  validé par un run court (4000 steps, `SubprocVecEnv`, checkpoints + éval + logs tensorboard OK).
  Constat au passage : **`device="cpu"`** est nettement plus rapide que `"cuda"` ici (506 vs 174 FPS
  sur le smoke test) — attendu, SB3 déconseille le GPU pour une politique `MlpPolicy` de cette taille
  (le transfert CPU↔GPU coûte plus qu'il ne rapporte sur un si petit réseau). `train_ppo.py` utilise
  `cpu` par défaut, `--device cuda` reste possible si besoin.
- Lancer un vrai entraînement (plusieurs centaines de milliers à quelques millions de pas) sur l'étape 1
  du curriculum, suivre les courbes via `tensorboard --logdir runs`.
- Tuning empirique des coefficients de reward shaping une fois les premières courbes disponibles.
- Suivre le curriculum en 5 étapes (section 6) une fois l'étape 1 validée.

Le champ "usedExcerpts" de l'outil est obligatoire : renseigne-le toujours avec les passages copiés mot pour mot que tu as effectivement utilisés (jamais une reformulation), même un seul suffit s'il n'y en a qu'un.
Plateforme cible : linkedin. LinkedIn : format texte long ou carrousel, registre professionnel / personal branding B2B, storytelling orienté valeur et expertise plutôt que vente directe, peu ou pas de vidéo courte type ASMR, hashtags sobres (3-5).
Catégorie de contenu visée : Tips Tech. Proposer des tutoriels courts, des astuces de code et des best‑practices autour du développement de jeux indie et d’apps ludiques.
Angle à adopter pour ce script (structure/format de hook à respecter) : Défi ludique — Lancez un challenge lié au produit ou à la technologie, présentez les règles, montrez les premières tentatives et révélez le résultat final pour engager le spectateur dès le départ.
Type de contenu : text. Format texte seul, sans visuel : l'accroche est la première phrase du texte.
Génère le contenu via l'outil fourni, en respectant strictement son format.
```

## Sortie brute générée (OpenAI)

```json
{
  "contentType": "text",
  "title": "Défi PPO : apprendre à sortir sans tricher",
  "caption": "Et si je lançais un défi à mon agent PPO : nettoyer la salle… puis trouver la sortie, sans traverser les murs ?\n\nLes règles étaient simples :\n1. L’agent doit combattre les ennemis.\n2. Il doit respecter les collisions et les murs.\n3. Il doit atteindre la zone de sortie une fois la salle nettoyée.\n4. Je change une seule variable à la fois pour comprendre ce qui fonctionne réellement.\n\nPremières tentatives :\n— certains agents apprennent à fuir plutôt qu’à combattre ;\n— d’autres campent après avoir éliminé les ennemis ;\n— un modèle a même semblé réussir avant que je découvre qu’il exploitait un bug de traversée des murs ;\n— sur room_stage=2, le combat pouvait être excellent, mais la sortie restait introuvable.\n\nLe vrai défi n’était donc pas seulement de “faire monter le score”. Il fallait distinguer une compétence réelle d’un raccourci appris par le modèle.\n\nLe tournant est venu avec deux idées :\n— stabiliser PPO avec un learning rate plus bas et un garde-fou target_kl ;\n— rendre le signal de navigation plus précis grâce à un rapprochement continu vers la sortie, plutôt qu’un bonus distribué uniquement au franchissement d’une case.\n\nLe résultat final est nuancé :\nmon agent sait désormais nettoyer une petite salle de manière beaucoup plus fiable et généraliser avec des positions de départ variables. En revanche, sur room_stage=2, il atteint encore systématiquement un point de blocage près du dernier détour avant la sortie.\n\nConclusion : en reinforcement learning, un score élevé ne suffit pas. Je dois aussi observer les trajectoires, vérifier les collisions, isoler les variables et tester les modèles sur des situations qu’ils n’ont jamais mémorisées.\n\nC’est moins spectaculaire qu’un “agent à 100%”, mais beaucoup plus utile pour construire une IA de jeu fiable.",
  "hashtags": [
    "#GameDev",
    "#IndieDev",
    "#ReinforcementLearning",
    "#PPO",
    "#TechTips"
  ],
  "usedExcerpts": [
    "`success_rate` reste EXACTEMENT à 0,00 sur les 600 points, du premier au dernier pas des 15M",
    "Le moteur calcule déjà le chemin optimal vers la sortie à chaque frame (flow field/BFS, alimente `goal_hint`)",
    "`target_kl=0.03` conservé comme réglage par défaut de `train_ppo.py` pour tous les runs futurs",
    "la distance minimale au centre de la sortie : 64,2 à 70,3px",
    "le learning rate (ou la taille de batch/`n_steps`) est probablement trop élevé pour cette configuration de reward"
  ],
  "hookText": "Et si je lançais un défi à mon agent PPO : nettoyer la salle… puis trouver la sortie, sans traverser les murs ?"
}
```
