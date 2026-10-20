# SPEC — Fil narratif (posts de récit dans une série)

Statut : cadrage arrêté, 2026-10-20. Périmètre : **une seule livraison**, les quatre types ensemble.
Les décisions laissées ouvertes dans le brouillon du 19 sont tranchées en §14, avec leur raison.

## 1. Le problème

Le rédacteur par événements produit de bons posts, mais chacun est une tranche : un événement, un
lecteur, une forme, et le post s'arrête avant l'événement suivant. Une série entière ne dit donc
jamais pourquoi le projet existe, où il va, ni où il en est. C'est ce qui sépare encore Telovo d'un
ghostwriter : le fil, pas les épisodes.

Ce qu'on sait de ce qui marche en build in public (sources en §14) : le récit d'origine fait mieux
que les annonces, les décisions dures et les ratés font mieux que les vitrines, et un point d'étape
**marque un vrai progrès — jamais une cadence à tenir**.

## 2. Ce que ce n'est pas

Ce n'est **pas** le retour du rédacteur en chef retiré le 2026-10-17 (`SPEC_REDACTEUR_EN_CHEF.md`).
Le rédacteur en chef planifiait des épisodes à partir de thèmes, de haut en bas, et inventait des
temps forts. Ici :

- rien n'est inventé : chaque post de récit lit des **événements existants** de la ligne de
  temps, plus les champs du sujet ;
- le placement est une **règle de code**, pas un appel au modèle ;
- le rédacteur par événements (prompts 21, 22, 23) garde son fonctionnement, sans aucune addition.

## 3. Principes

1. **La primitive reste le post.** L'auteur voit des posts dans son calendrier, les retouche, les
   marque prêts. Il ne voit ni « créneau narratif », ni suggestion, ni réglage. S'il ne veut pas
   d'un post de récit, il le supprime ou demande une autre idée, comme pour n'importe quel post.
2. **Le système place, il ne propose pas.** Les posts de récit sont posés aux positions définies
   ci-dessous, sans validation intermédiaire.
3. **De bas en haut.** Un post de récit ne lit que des événements, les champs du sujet et, pour la
   promesse, un post publié. Les contrôles du code (extraits retrouvés dans la matière, langue,
   longueurs, tournures) s'appliquent tels quels.
4. **Un rang de plus, pas un remplacement.** Le niveau événement (un fait par post) reste le mode
   par défaut.
5. **La substance, pas la cadence.** Un post de récit se déclenche parce que la matière le
   justifie. Si elle ne le justifie jamais, il n'y a pas de post de récit — le progrès silencieux
   n'a pas à s'excuser.

## 4. État réel du code (vérifié le 2026-10-20)

Le brouillon partait de quatre hypothèses fausses. Corrigées ici, elles changent le périmètre.

| Hypothèse du brouillon | Réalité |
| :--- | :--- |
| `scripts.promisesMade` n'est jamais écrit | **Faux.** `eventWriter.ts:195` le déclare *required* dans `submit_post`, `scriptService.ts:256` l'enregistre. Les essais de `docs/tests/2026-10-17/` montrent une promesse par post. **La pièce « capture » est déjà faite.** Seul `promiseHonored` dort vraiment |
| Le sujet porte un champ `whatBuilding` | **Faux.** `products` porte `name`, `description`, `valueProposition`, `problem`. La vision lit les trois derniers |
| Un créneau peut porter son `kind` dès la pose | **Faux en pratique.** `seriesSlotSync.ts` crée des créneaux **vides** sur 28 jours à partir du seul rythme ; l'événement n'est choisi qu'à l'écriture (`buildEventBriefForSeries`). Rien ne numérote les créneaux |
| Le prompt du rédacteur de récit sera le 24 | **Pris.** Le 24 est « Qualification des événements par public », le dernier est le 27 → ce sera le **28** |

Autres points vérifiés, utilisés plus bas :

- Genres d'événement : `failure` · `decision` · `result` · `feedback` · `milestone`
  (`materialEventKindEnum`). Pas de genre « déclencheur ».
- `material_events.whatChanged` est **nullable** : « ce que ça a changé » est une information
  présente ou absente, exploitable comme signal.
- Statuts de script : `draft` · `planned` (Ready) · `shot` · `published` (Posted). `published` se
  met **à la main** depuis l'éditeur (`PATCH /api/scripts/:id`), il ne dépend pas du rattachement
  Performance.
- Un événement est « raconté » quand un script de la série porte son `eventId` — il n'y a pas de
  colonne `toldByScriptIds`.
- Un post = **deux scripts** (LinkedIn et X) sur le même créneau, écrits l'un après l'autre par
  `postPairService.ts` à partir du même événement.

## 5. Les types de posts de récit

| Type | Ce qu'il lit | Ce qu'il dit | Ce qu'il ne fait pas |
| :--- | :--- | :--- | :--- |
| **Origine** | **Large** : les 12 plus anciens événements de la ligne de temps, plus les **trois champs du sujet** — ce qui est construit (`description`), pour qui (`targetAudience`), le problème (`problem`) | Le problème avant la solution : ce qui a été vu ou entendu, et pourquoi ça ne pouvait pas rester comme ça | Ne nomme pas le produit avant la dernière phrase ; ne décrit pas de fonctionnalité |
| **Vision** | `description`, `problem`, `valueProposition`, `targetAudience` du sujet + les événements de genre `decision` | Où ça va et pour qui, ancré sur une décision réelle | Pas de promesse chiffrée, pas de date, pas de roadmap |
| **Point d'étape** | Les événements racontés depuis le dernier post de récit | Ce qui a changé entre le premier et le dernier, pas chacun d'eux | Ne re-raconte aucun épisode ; ne reprend pas les chiffres des épisodes voisins |
| **Promesse tenue** | Une promesse faite dans un post publié (texte exact + le post) + l'événement postérieur qui la tient | Ce que l'auteur avait dit, puis ce qui s'est passé, sans commentaire | Ne juge pas, ne s'excuse pas, ne reformule pas la promesse |

### Écarté

**Échec revisité** : un échec est déjà un événement (`kind = failure`) et le prompt 23 le raconte.
Le « retour sur un échec un mois après » est une promesse tenue à l'envers ; il rentre dans
Promesse tenue si besoin, pas dans un type à part.

## 6. Le rang d'un post

Les positions se comptent **en posts écrits de la série**, jamais en dates : changer le rythme,
sauter une semaine ou déplacer un jour ne déplace pas le fil. Le lecteur ne voit pas les jours vides
du calendrier.

> **Rang d'un post à écrire** = nombre de dates distinctes déjà écrites pour cette série (créneaux
> dont le `scriptId` est renseigné), + 1.

Conséquence assumée : supprimer un post fait reculer le rang des suivants. Supprimer le post
d'origine fait donc réécrire une origine au prochain post — c'est le comportement voulu
(« supprimer et redemander » rend une autre version du même type).

## 7. Placement

| Type | Condition | Si elle n'est pas remplie |
| :--- | :--- | :--- |
| **Origine** | **Obligatoire** au rang 1 de la **première série** d'un sujet, dès que la ligne de temps n'est pas vide. Aucune autre condition : c'est le post qui dit le mieux pourquoi suivre la série, il ne se saute pas | Rien à sauter : sans aucun événement, il n'y a de toute façon rien à générer (le chemin par événements répond 409) |
| **Vision** | Rang 3 de la première série, `problem` et `valueProposition` remplis, au moins un événement de genre `decision` | Reportée au rang suivant, jusqu'à ce que ce soit vrai |
| **Point d'étape** | Depuis le dernier post de récit de la série : au moins **3 événements racontés dont le `whatChanged` est rempli**, **et** au moins **4 épisodes normaux écrits** | Rien. Pas de point d'étape |
| **Promesse tenue** | Une promesse d'un post `published` de l'auteur est appariée à un événement postérieur pas encore raconté | Rien : le type n'apparaît que quand l'appariement existe |

Règles qui s'appliquent par-dessus :

- **Jamais deux posts de récit à la suite.** Un rang qui suit immédiatement un post de récit est un
  épisode normal, quelle que soit la condition remplie.
- **Priorité** quand plusieurs conditions sont vraies : origine > vision > promesse tenue > point
  d'étape. Les deux premières sont positionnelles, elles ne se représentent pas.
- Le plancher de 4 épisodes du point d'étape est **un plancher, pas une cadence** : il empêche deux
  points d'étape de se coller, il n'en force jamais un.

Conséquences à noter :

- Avec `/start`, **le premier post que la personne reçoit par email devient le post d'origine**.
  C'est voulu : c'est le post qui dit le mieux pourquoi suivre la série. Coût : il lit plus de
  matière que les autres, à mesurer sur la durée de génération (≈ 1 min 20 aujourd'hui).
- Seule la première série d'un sujet porte l'origine et la vision. Une deuxième série sur le même
  sujet n'a que des points d'étape et des promesses tenues.
- Un post de récit **ne marque aucun événement comme raconté** (pas d'`eventId`), sauf l'origine
  qui marque le **plus ancien** événement — celui sur lequel elle s'ancre — et la promesse tenue qui
  marque l'événement qui la tient. Les onze autres événements du périmètre de l'origine, comme ceux
  résumés dans un point d'étape, restent disponibles pour leurs épisodes : l'origine les **lit pour
  comprendre**, elle ne les raconte pas.

## 8. La promesse tenue

Deux pièces à écrire ; la capture existe déjà (§4).

**Contrôle de la capture.** `submit_post` accepte déjà `promisesMade`. Le code vérifie désormais que
chaque phrase déclarée se retrouve dans le post (même recherche approximative que `usedExcerpts`,
`citationMatching.ts`). Comme pour les citations, l'échec n'est signalé que si **aucune** phrase
déclarée n'est retrouvée : une promesse inventée de toutes pièces renvoie le post au modèle, une
reformulation légère passe.

**Appariement.** À chaque relecture de la matière (nouveaux événements), pour chaque script
`published` dont une promesse n'est pas encore tenue : un appel au modèle avec la promesse, le post
qui l'a faite, et les événements candidats — ceux du sujet, pas encore racontés, postérieurs au
post. Réponse : l'id de l'événement, ou aucun. 30 candidats au plus, les plus récents.

Le seuil est **permissif**, parce que les vraies promesses captées sont molles (« dans un prochain
épisode, je montrerai comment… », cf. `docs/tests/2026-10-17/`). La question posée au modèle est
donc « cet événement permet-il de dire ce que l'auteur avait annoncé ? », pas « cet événement
tient-il cette promesse ? ». Une seule réponse non nulle suffit à ouvrir le type.

**Clôture.** Le post de promesse tenue porte `promiseHonored` = le texte exact de la promesse, et
`promiseSourceScriptId` = le script qui l'avait faite. Une promesse dont le texte est déjà présent
dans un `promiseHonored` n'est plus candidate.

## 9. Interaction avec l'existant

| Mécanisme | Aujourd'hui | Changement |
| :--- | :--- | :--- |
| Choix de ce qu'on écrit (`buildEventBriefForSeries`) | Le prochain événement de la ligne de temps filtrée sur le lecteur | Un `buildNarrativeBriefForSeries` est consulté **d'abord** : s'il rend un brief, le post est un post de récit ; sinon on garde le chemin actuel, inchangé |
| Aiguillage (`generateScript`) | `eventBrief` → rédacteur 23, sinon V3 | Troisième branche : brief de récit → rédacteur 28 |
| Créneau du calendrier | Porte `scriptId`, `status` | Porte en plus `kind` (`event` par défaut, `narrative`) et `narrative_kind`, écrits **à l'écriture**, comme trace de la décision — pas comme prédiction. C'est ce qui fait que les deux réseaux du même post et « autre idée, même brief » repartent sur le même type |
| Deuxième réseau du même post (`postPairService`) | Reprend l'événement de la première version écrite | Reprend aussi le type et le périmètre de récit |
| Suppression + nouveau post, « autre idée, même brief » | Repart sur l'événement du créneau | Un créneau `narrative` repart sur le **même type et le même périmètre**. Supprimer le post **et** le créneau fait recalculer le rang (§6) |
| Déplacement, changement de rythme | Les créneaux suivent | Rien : positions en rangs, pas en dates |
| Nouvelle matière après remplissage | Événements insérés, parfois dans le passé | Un post de récit déjà écrit n'est pas réécrit. L'appariement des promesses tourne à ce moment |
| Prompt 23 | — | **Inchangé** (la capture existe déjà) ; seul le contrôle de code s'ajoute |
| Forme de série (prompt 22) | Décrit les ingrédients d'un épisode | Inchangée. Un post de récit n'en utilise que « ses mots » et le registre ; sa structure vient du 28, par type |
| Voisins « just before / just after » (prompt 23) | Deux événements avant, un après | Un voisin de récit est annoncé comme tel, pour que l'épisode suivant un point d'étape ne le répète pas |
| Micro-retouches, style appris, 5 derniers posts, contrôles | — | Identiques. Le contrôle des extraits vérifie contre plusieurs documents, et contre le post de promesse pour la promesse tenue |
| Quota | Semaines | Inchangé |
| Ligne de temps corrigeable (`/context`) | L'auteur peut ajouter un événement | Inchangé ; c'est le seul levier de l'auteur sur le fil, et il est indirect |

## 10. Prompt 28 — contrat (pas le texte)

- **Système** : `SCRIPT_CORE_PROMPT` partagé + un bloc `<what_makes_a_post>` **par type** (quatre
  blocs, un seul injecté).
- **Utilisateur** : lecteur, mots de la forme, style appris, 5 derniers posts, règles du réseau,
  langue ; et le **périmètre** : la liste exacte des événements que ce post a le droit de lire
  (ids + titres + dates), les champs du sujet pour origine et vision, le post et la phrase de
  promesse pour la promesse tenue.
- **Outils** : `read_source`, `read_timeline` (ici **pour raconter**, limité au périmètre),
  `read_post` (promesse tenue seulement), `review_draft`, `submit_post` (avec `promisesMade`).
  Mêmes plafonds qu'au 23 (tours, brouillons, soumissions).
- **Règles communes aux quatre types** : pas de call to action ; pas de bilan chiffré hors
  événements du périmètre ; le post ne dit pas « point d'étape », « récap », « vision »,
  « promesse » ni aucun nom de type ; il s'arrête sur un fait, comme les épisodes.
- **Ce qu'il ne fait pas** : il ne choisit ni son type ni son périmètre (le code les lui donne), il
  ne lit rien hors périmètre, il n'écrit pas la forme de série.

Le texte du prompt se rédige au Lot 3, après les règles de placement.

## 11. Données

- `calendar_entries` : `kind` (`event` | `narrative`, défaut `event`), `narrative_kind`
  (`origin` | `vision` | `checkpoint` | `promise`, nullable).
- `scripts` : `narrative_kind` (même enum, nullable) ; `promise_source_script_id` (nullable, FK
  `scripts.id`, SET NULL) ; `promiseHonored` réactivé (texte exact de la promesse tenue) ;
  `promisesMade` déjà écrit, inchangé.
- Aucune table nouvelle (règle des verticales, `schemaInvariants.test.ts`).

## 12. Banc d'essai

Le banc actuel juge un post seul. Il faut un cas qui contient une série entière (pack MyKiné :
origine + vision + épisodes + point d'étape + une promesse tenue) et qui juge :

- l'origine : le produit n'apparaît pas avant la fin ; le déclencheur est reconnaissable dans la
  matière ;
- la vision : chaque affirmation sur l'avenir s'appuie sur une décision de la ligne de temps ;
- le point d'étape : aucun épisode n'est re-raconté ; ce qui a changé est dit avec les faits du
  périmètre et rien d'autre ;
- la promesse tenue : la phrase citée est exactement celle du post ; l'événement cité permet bien de
  dire ce qui avait été annoncé ;
- la série lue d'un bloc : pas deux posts avec le même squelette, pas de chiffre repris d'un épisode
  voisin.

Le cas MyKiné doit contenir au moins une vraie promesse dans un post d'épisode, sinon le type ne se
teste pas. Les essais du 2026-10-17 montrent que le rédacteur en pose spontanément.

## 13. Ordre de construction (une livraison)

1. Données (§11) et calcul du rang (§6).
2. Règles de placement (§7) dans `buildNarrativeBriefForSeries`, consulté avant le brief
   d'événement ; `kind` / `narrative_kind` écrits à l'écriture.
3. Prompt 28, quatre blocs ; aiguillage dans `generateScript` ; régénération qui respecte le type.
4. Promesse tenue : contrôle de la capture, appariement, clôture (§8).
5. Cas de banc série entière ; itérations jusqu'à ce que les cinq critères du §12 passent.

## 14. Décisions prises (2026-10-20)

Les sept points laissés ouverts le 19, tranchés avec l'auteur.

| # | Décision | Raison |
| :--- | :--- | :--- |
| 1 | Le point d'étape n'a **pas** de N : il se déclenche sur la substance — 3 événements racontés au `whatChanged` rempli, plancher de 4 épisodes | Décidé par l'auteur : « un post de récit, c'est quand il faut un post de récit ». Les guides disent de ne pas fabriquer de point d'étape pour tenir une cadence |
| 2 | Vision au rang 3 | Laisse un épisode normal entre l'origine et elle (jamais deux posts de récit de suite), et les trois premiers posts disent déjà pourquoi et où ça va |
| 3 | **Révisé le 2026-10-20** après le premier lancement réel. L'origine est **obligatoire** et lit **large** : les 12 plus anciens événements et les trois champs du sujet, au lieu d'un seul événement daté. Elle s'ancre sur le plus ancien et ne marque que celui-là comme raconté | Décidé par l'auteur : « un post origine qui prend ses infos de globalement un peu tout est nécessaire quand on fait du build in public ». La version initiale (un seul événement daté, et pas d'origine sans lui) rendait le post le plus important du fil à la fois pauvre et facultatif. Les trois champs de `/start` sont les mots de l'auteur sur pourquoi le projet existe : c'est de la matière d'origine, pas du remplissage |
| 4 | Le point d'étape ne marque rien comme raconté | Proposition du brouillon, conservée : un événement résumé en une ligne mérite encore son épisode |
| 5 | Deuxième série sur le même sujet : points d'étape et promesses seulement | Proposition du brouillon, conservée |
| 6 | « Publié » = **Posted** | Vérifié dans le code : `published` se met à la main dans l'éditeur, sans dépendre du rattachement Performance jamais essayé en réel |
| 7 | Appariement **permissif**, promesses molles comprises | Décidé par l'auteur : « toute promesse, qu'elle soit molle ou puissante ». Un seuil net n'apparierait jamais les promesses réellement captées |

Choix supplémentaires faits au cadrage, non présents dans le brouillon : le rang se compte en posts
écrits et non en créneaux (§6) ; le `kind` se décide à l'écriture et non à la pose du créneau (§9) ;
le prompt est le 28 et non le 24 (§4) ; priorité entre types et interdiction de deux posts de récit
consécutifs (§7).

**Sources build in public** consultées le 2026-10-20 :
[monday.com](https://monday.com/blog/project-management/project-milestones/) ·
[usmanjatoi.com](https://usmanjatoi.com/operations/best-champions-operations/showcase-cadence-weekly-vs-milestone/) ·
[buildinpublic.guide](https://buildinpublic.guide/templates/weekly-update) ·
[socialync.io](https://www.socialync.io/blog/founder-build-in-public-content-playbook-2026) ·
[peerpush.com](https://peerpush.com/blog/how-to-build-in-public)

## 15. Précisions pour qui implémente

Trous relevés à la relecture du document par un œil de développeur, bouchés ici. Aucun ne change ce
qui est construit ; tous sont des choix de cadrage, pas de l'auteur.

| Question | Réponse |
| :--- | :--- |
| Une série sans sujet, sans lecteur ou sans forme | N'a **jamais** de post de récit, exactement comme elle n'a pas de brief d'événement aujourd'hui (`buildEventBriefForSeries` rend `null`). `buildNarrativeBriefForSeries` applique la même garde en premier |
| « Première série d'un sujet » | La plus ancienne par `createdAt` **parmi les non archivées** du même `productId`. Un sujet par sujet : un auteur à trois sujets a trois origines |
| Comment compter le rang exactement | `count(distinct scheduledDate)` sur les `calendar_entries` de la série dont le `scriptId` est renseigné. Les scripts dont le créneau a été supprimé ne comptent pas |
| « Depuis le dernier post de récit » quand il n'y en a jamais eu | Depuis le début de la série |
| « Événement postérieur » pour l'appariement d'une promesse | Événement dont la `date` est **strictement après** la date du créneau du post qui a fait la promesse. Les événements sans date ne sont jamais candidats |
| Où vit le résultat de l'appariement entre la relecture de la matière et l'écriture | Colonne `scripts.promise_match` (jsonb nullable, `{ promise, eventId }`) sur le script **qui a fait** la promesse. Écrite par la relecture, lue par l'écriture, vidée quand le post de promesse tenue est écrit. Évite un appel au modèle à chaque écriture |
| Contre quoi `usedExcerpts` est vérifié pour un post de récit | Les documents source des événements du périmètre (`materialEvents.sourceMaterialId`), réunis. Pour la promesse tenue, le post de promesse s'y ajoute |
| Un post de récit peut-il être `visual` / animé | Oui, mêmes règles qu'un épisode. Le type de récit ne change que le texte et le périmètre |
| Les contrôles du code | `checkGeneratedPost` s'applique tel quel, y compris l'anti-répétition sur les 5 derniers posts — c'est ce qui empêche deux posts de récit d'avoir le même squelette |
