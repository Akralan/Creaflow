# SPEC — CHAQUE SÉRIE A SON RYTHME

> **Statut : validée et implémentée le 2026-10-17** sur `feature/prompt-generation-v3` (Lots 0 à 5), migration `0042` appliquée en base de dev, reprise et recalcul vérifiés sur les deux séries de dev (Devlog le mercredi sur X, CreaFlow en chantier le samedi sur LinkedIn et X, posts rédigés intacts). Écrans pas encore cliqués dans un navigateur. Écarts : §8.
>
> **Constat (2026-10-17).** L'auteur crée une seconde série, « Devlog Leaderbaord », avec un poids de 50 %. Elle n'obtient aucun créneau.
> - Le calendrier se remplit une fois par mois. Il prend les jours de publication du profil, puis tire au sort quelle série prend quel créneau, selon un pourcentage.
> - Créer une série ne touche pas au mois déjà rempli. La série apparaîtra le mois suivant, à des jours que l'auteur ne choisit pas.
> - Le pourcentage est abstrait. Personne ne pense « 34 % de mes créneaux » ; on pense « le devlog, c'est le mercredi ».
> - Avec plusieurs séries, le calendrier mélange tout sur une seule bande : on ne voit pas où vit chaque série.
>
> **Objectif.**
> 1. Chaque série a **son rythme** : ses jours, chaque semaine ou une semaine sur deux.
> 2. Le calendrier se remplit **tout de suite**, et en continu, à partir de ces rythmes.
> 3. Avec plusieurs séries, le calendrier montre **une ligne par série**.

---

## 1. Décisions tranchées

| Sujet | Décision |
| :--- | :--- |
| Rythme | Chaque série a des **jours de la semaine** (1 à 7) et une **fréquence** : chaque semaine, ou une semaine sur deux. Il remplace le poids en %. |
| Deux séries le même jour | **Autorisé** (choix de l'auteur) : deux posts ce jour-là. Le sélecteur de jours montre quelles séries occupent déjà chaque jour, sans rien interdire. |
| Posts libres | **Plus de posts libres générés.** Tout créneau automatique appartient à une série. Un post ponctuel reste possible à la main (script placé sur le calendrier, import), comme aujourd'hui. |
| Réseaux | Une série publie sur ses réseaux ciblés, ou sur tous les réseaux actifs si elle n'en cible aucun. On a un créneau par jour du rythme **et** par réseau, comme aujourd'hui. Couper un réseau dans Paramètres reste l'interrupteur. |
| Remplissage | Il n'y a plus de génération mensuelle. Le calendrier est tenu à jour en continu, sur **28 jours** devant soi (l'horizon déjà utilisé par l'affichage). Il se recalcule quand une série est créée, quand son rythme ou ses réseaux changent, quand elle est retirée, quand un réseau est activé ou coupé, et à l'ouverture du calendrier (pas de cron). |
| Ce qui ne bouge jamais | Un créneau passé, publié ou déjà rédigé n'est ni déplacé ni supprimé par le recalcul. Seuls les créneaux **vides à venir** sont ajoutés ou retirés. |
| Jours de publication du profil | Ils ne placent plus les posts. Ils deviennent « les jours où tu peux publier » : ils proposent les jours d'une nouvelle série, et servent à l'onboarding (§5). |
| Retrait d'une série | Ses créneaux vides à venir sont supprimés. Ses posts rédigés quittent le calendrier, et leurs scripts restent dans les scripts, comme corrigé aujourd'hui. Les jours ne passent plus à une autre série : chaque série a les siens. |
| Poids des séries | Il n'est plus lu nulle part et disparaît des écrans et des prompts. La colonne reste en base (pas de migration destructive), ignorée. |
| Poids des rôles | Il ne servait qu'à choisir le rôle des posts libres : sans posts libres, il ne place plus rien. Le mix des rôles reste affiché comme description. Le **rééquilibrage par la performance** des rôles ne changerait plus le calendrier : on cesse de le proposer (§7). |
| Rédacteur en chef | Rien ne change. Il choisit l'épisode suivant d'après le plan de la série, pas d'après les créneaux. L'affichage continue d'attribuer les épisodes prévus aux créneaux vides de la série, dans l'ordre des dates. |

---

## 2. Données

- `content_series.rhythm` (jsonb, nullable) :
  ```ts
  { days: number[];        // 1 = lundi … 7 = dimanche, au moins un
    every: 1 | 2;          // 1 = chaque semaine, 2 = une semaine sur deux
    anchor: string | null } // lundi (YYYY-MM-DD) d'une semaine où la série publie ; requis si every = 2
  ```
  `null` veut dire que la série n'a pas encore de rythme et ne crée aucun créneau (elle est signalée dans Direction).
- Migration `0042` : colonne, puis reprise des données.
  - **Une seule série active** : elle prend les jours de publication du profil, chaque semaine.
  - **Plusieurs séries** : les jours du profil sont répartis entre elles, la plus lourde d'abord. Une série qui reste sans jour partage le jour de la plus lourde.
  - Les créneaux **libres vides à venir** sont supprimés. Les rédigés restent.
  - Un premier recalcul crée ensuite les créneaux manquants.

---

## 3. Remplissage (code)

Fonctions pures, dans `src/lib/services/calendarService.ts`, testées sans base :
- `datesForRhythm(rhythm, from, to)` : les dates du rythme dans l'intervalle, en tenant compte d'`anchor` quand `every = 2`.
- `planSeriesSlots({ series, activePlatforms, existing, from, to })` renvoie `{ toCreate, toDelete }` :
  - **à créer** : les couples (date, réseau) du rythme qui n'ont pas encore de créneau de cette série ;
  - **à supprimer** : les créneaux **vides** à venir de cette série qui ne tombent plus sur son rythme ou sur un réseau actif.

Service `src/lib/services/seriesSlotSync.ts` : `syncSeriesSlots(userId, seriesId?)` lit, planifie puis écrit en une transaction. Le rôle du créneau est celui de la série.

Appels :
- création et mise à jour d'une série (`saveSeriesForUser`, `upsertSeriesItem`, `updateSeriesFields`, propositions de l'assistant) ;
- retrait d'une série : `releaseSlotsOfArchivedSeries` devient « supprimer les vides, détacher les rédigés », sans réattribution ;
- activation ou coupure d'un réseau (`setPlatformActiveForUser`) ;
- sélection des séries en fin d'onboarding ;
- lecture du calendrier (`listCalendarRange`) : on complète l'horizon s'il a avancé depuis la dernière fois.

Retirés :
- `POST /api/calendar/generate` (et son 409 « déjà généré ce mois-ci ») ;
- `distributeSeriesOverrides`, `seriesWeightsFromSeries`, `distributeCategories`, `adjustCategoryWeightsForMaterialScarcity` (plus d'appelant) ;
- `pickReplacementSeries`.

Les boutons « Planifier mes posts » et « Planifier la suite » du calendrier disparaissent : il n'y a plus rien à déclencher.

---

## 4. Écrans

**Créer ou modifier une série** (`SeriesEditModal`) : le champ « Poids … % des créneaux » est remplacé par **« Rythme »** :
- 7 pastilles (L M M J V S D) à cocher. Sous chaque jour déjà pris par une autre série, on écrit son nom en petit (« Devlog »). C'est une information, pas une interdiction.
- Un choix « Chaque semaine / Une semaine sur deux ». Avec une semaine sur deux, on demande « à partir de cette semaine / de la semaine prochaine ».
- Pour une nouvelle série, on précoche les jours du profil qu'aucune autre série n'occupe. S'ils sont tous pris, on précoche le premier jour du profil.
- Après l'enregistrement, une ligne : « 8 posts ajoutés au calendrier d'ici le 14 novembre », avec un lien vers le calendrier.

**Direction** : la carte d'une série affiche son rythme (« Mer. et sam. », « Jeu., une semaine sur deux ») à la place du %. Une série sans rythme affiche « Pas de rythme : choisis ses jours » et ne publie rien.

**Calendrier** (`src/app/(app)/calendar/page.tsx`) :
- **Une seule série** (ou aucune) dans la période : rien ne change.
- **Plusieurs séries** : une **ligne par série**, l'une sous l'autre, dans l'ordre de la Direction.
  - Chaque ligne a un en-tête : nom de la série, rythme, et lien « Modifier le rythme ».
  - Dans une ligne, les posts restent de gauche à droite par date. Ils passent à la ligne en fin de largeur, comme aujourd'hui.
  - Les posts placés à la main hors série vont dans une dernière ligne « Hors série », affichée seulement si elle n'est pas vide.
- Dans chaque ligne, on voit les créneaux vides de la semaine et **au moins le prochain créneau vide de la série**, même au-delà de la semaine. C'est ce qui répond à « je ne sais pas où elle s'est remplie ».
- Mobile : la même chose en liste, avec un intertitre par série.

**Paramètres** : « Jours de publication » devient **« Jours où tu peux publier »**, avec la phrase « Proposés quand tu crées une série. Chaque série a ensuite son propre rythme, dans Direction. » Le texte du calendrier « sur tes jours de publication » est corrigé en conséquence.

---

## 5. Onboarding

L'écran « jours de publication » reste, et ses jours deviennent ceux que l'auteur peut tenir. À la validation des séries (`confirmSelection`), les jours cochés sont répartis entre les séries gardées (règle de la migration, §2). On les ajuste ensuite dans Direction. L'appel `generateCalendar` est remplacé par le recalcul.

---

## 6. Modèle et assistant

- `seriesLabels.ts` (suggestion de séries) ne demande plus de `weight`. Le rythme est posé par le code (§5), pas par le modèle.
- Assistant :
  - `series_create` et `series_update` portent un `rhythm` (jours + fréquence) à la place du poids ;
  - `propose_publishing_days` reste (les jours où l'auteur peut publier) mais ne promet plus de replacer les posts ;
  - le contexte affiche le rythme de chaque série au lieu de `(N%)`.
- `docs/PROMPTS.md` est mis à jour (prompts 14 et 16).

---

## 7. Hors périmètre, à rediscuter

- Le **rééquilibrage par la performance** : il proposait de changer le poids des rôles. Sans posts libres, ce poids ne place plus rien. On cesse de le proposer. La suite naturelle serait de proposer un changement de **rythme** de série (« Le devlog marche deux fois mieux : passer à deux jours ? ») : c'est un autre chantier.
- Une heure de publication par série.
- Glisser-déposer un post d'un jour à l'autre.

---

## 8. Écarts avec la version validée

- **Les jours retirés à la main.** Le recalcul recréait un créneau supprimé depuis le calendrier. Chaque série garde la liste de ses créneaux sautés (`content_series.skipped_slots`, `YYYY-MM-DD|plateforme`, migration `0042`), et le recalcul ne les recrée pas. Les dates passées sont élaguées au prochain saut.
- **Le créneau d'une série ne change plus de série.** Le passer dans une autre série, ou en post libre, aurait été défait au recalcul suivant. La fenêtre d'un créneau vide de série propose seulement « Sauter ce jour » et un lien « changer le rythme ». Un post placé à la main hors série garde le choix de son rôle.
- **Au-delà de l'horizon.** L'ancien calendrier mensuel avait posé des créneaux jusqu'à fin novembre. Le recalcul retire maintenant les créneaux vides hors rythme sur tout l'avenir, mais n'en crée que sur les 28 jours qui viennent. Constaté au premier recalcul réel.
- **Les pourcentages de la sélection d'onboarding** disparaissent (`src/lib/seriesWeights.ts` supprimé). Le texte dit que les jours seront répartis entre les séries gardées.
- **Le service.** `seriesSlotSync.ts` tient aussi le retrait des séries (l'ancien `seriesSlotRelease.ts` est supprimé) et prend un verrou par utilisateur (`pg_advisory_xact_lock`), parce qu'il tourne à chaque ouverture du calendrier. Les fonctions pures du rythme vivent dans `src/lib/seriesRhythm.ts`, partagé avec les écrans. `planSeriesSlots` est dans `calendarService.ts`.
- **Le rééquilibrage des rôles** n'est plus déclenché (`/api/performance/refresh`). Le code de calcul reste, pour le futur rééquilibrage des rythmes.

## 9. Lots

| Lot | Contenu |
| :--- | :--- |
| 0 | Migration `0042` (colonne `rhythm` et reprise des données §2), schéma Zod du rythme. |
| 1 | `datesForRhythm`, `planSeriesSlots` et leurs tests. |
| 2 | `syncSeriesSlots` et ses appels (§3). Retrait de la génération mensuelle et des fonctions de poids. Nouveau retrait de série. |
| 3 | Écrans : rythme dans `SeriesEditModal` et sur les cartes de Direction, calendrier par lignes de série, Paramètres et textes. |
| 4 | Onboarding (§5), suggestion de séries et assistant (§6). |
| 5 | Docs : `TECH.md`, `PRODUCT.md`, `PROMPTS.md`, `CLAUDE.md`, essai réel avec les deux séries actuelles. |
