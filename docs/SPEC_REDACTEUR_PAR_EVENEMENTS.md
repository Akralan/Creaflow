# SPEC — LE RÉDACTEUR PAR ÉVÉNEMENTS

> ⚪ **ARCHIVE — retirée le 2026-10-24** par `docs/SPEC_EVENEMENT_POINTEUR.md`. Le lecteur d'événements (prompt 21) et le rédacteur par événement (prompt 23) sont supprimés. Un événement n'a plus de champ, et c'est le rédacteur qui choisit ses pointeurs. Ce document reste pour le `pourquoi` des décisions de l'époque ; il ne décrit plus le code.


> **Statut : Lots 0, 1 et 2 implémentés le 2026-10-17** sur `feature/redacteur-par-evenements`, migrations `0044`-`0045` appliquées en dev seulement. Lot 0 : table `material_events`, lecteur d'événements, routes `/api/events`, ligne de temps dans le panneau de matière (vérifié sur le pack MyKiné : 40 événements datés et dans l'ordre, `docs/tests/mykine-pack/LIGNE_DE_TEMPS_lot0.txt`). Lot 1 : lecteur et forme par série (`content_series.reader_label`, `form`), plan tiré de la ligne de temps, panneau « Pour qui on écrit », portrait en synchrone en fin d'onboarding. Lot 2 : rédacteur agentique (`src/lib/llm/eventWriter.ts`), branché dès qu'une série a un lecteur et une forme (`EVENT_WRITER_ENABLED=false` le coupe), chef ignoré dans ce cas ; quatre posts cible kiné générés (`docs/tests/mykine-pack/RESULTATS_C_kine.txt`). Lot 3 fait : cinq posts cible dev sur les mêmes événements (`RESULTATS_D_dev.txt`, puis `RESULTATS_E_dev.txt` après correction de la forme et qualification des événements par public, §9). **Lot 4 fait** : le rédacteur en chef est retiré du code (`narrativeDirector.ts`, `narrativePrompts.ts` sauf le résumeur déplacé dans `materialSummary.ts`, routes `/api/narrative/*`, `/api/materials/usage`, `/api/series/from-material`, plan en épisodes de Direction, modes de série, outil `read_narrative_state` de l'assistant, scripts de test de l'ancien pipeline) ; tables conservées sans migration destructive ; toute série passe par le rédacteur par événements, une série sans lecteur reçoit le public principal de son sujet, sans événement la génération répond 409 ; le prompt V3 ne sert plus qu'aux posts libres. Cadrage écrit le 2026-10-17 après le test du pack MyKiné (`docs/tests/mykine-pack/`, résultats dans `RESULTATS.txt`).
>
> **En une phrase.** Aujourd'hui la chaîne transmet des documents et des titres ; personne n'en sort ce qui s'est passé. On remplace le rédacteur en chef par un lecteur d'événements, on choisit un seul lecteur par série, et le rédacteur reçoit un événement, un lecteur, une forme, avec le droit de relire la matière et de recommencer.

---

## 1. Ce que le test a montré

Huit posts générés sur un vrai compte, à partir d'un pack de matière réaliste (14 docs techniques, puis un devlog daté et des décisions).

1. **La matière compte, mais n'arrive pas.** Avec le devlog ajouté, un seul post sur quatre a utilisé un événement. Les moments humains (le patient de 52 ans, Marion qui arrête la démo) n'ont été pris par personne.
2. **Le chef ne lit pas.** Il reçoit une phrase par document, pointe 1 à 3 documents par épisode, garde son plan quand la matière change, et n'a aucune notion du temps. Le rédacteur ne reçoit que ce qu'il a pointé.
3. **Le rédacteur explique, il ne raconte pas.** Huit posts, une seule forme : problème, « MyKiné fait ceci », liste à puces, compromis, appel à l'action. Sa « réflexion » (champs remplis avant le post, dans le même appel) est un formulaire, pas une réflexion.
4. **Personne ne choisit à qui on parle.** Le portrait des lecteurs n'a pas été généré (tâche de fond silencieuse), et le « Pour qui » extrait à l'onboarding décrivait les clients du produit, pas les lecteurs des posts.
5. **La forme dépend du lecteur.** Pour un kiné : un patient, un avant, un après, et pourquoi tel choix a été fait pour lui. Pour un dev : une erreur, et ce qu'elle a changé. Rien dans la chaîne ne fait cette distinction.

---

## 2. Décisions

| Sujet | Décision |
| :--- | :--- |
| Le rédacteur en chef (`narrativeDirector`, beats, `focusDocIds`, résumés d'une phrase) | **Remplacé** par le lecteur d'événements (§3). Le code reste en place le temps de la bascule, puis est retiré (Lot 4). La table `narrative_state` n'est plus lue. |
| Modes de série `feuilleton` / `rendez_vous` | **Plus de distinction.** Toute série est une suite d'événements racontés dans l'ordre. La colonne reste, ignorée. |
| L'unité de matière | **L'événement**, pas le document : daté, ce qui s'est passé, ce que ça a changé, pour qui c'est intéressant, et le passage du document qui le prouve. |
| Le lecteur d'une série | **Un seul**, choisi par l'auteur à la création de la série parmi les publics du sujet (ou écrit à la main). Un post ne vise jamais deux publics. |
| La forme d'une série | **Dérivée du lecteur**, réfléchie une fois et écrite noir sur blanc (§4) : ce que ce lecteur veut lire, ce qu'il fuit, de quoi est fait un bon épisode pour lui. Éditable. |
| Le brief du rédacteur | **Trois choses** : l'événement (avec ses voisins avant et après), le lecteur, la forme. Plus les règles de style apprises et les derniers posts (anti-répétition). **Retirés du message** : angle, rôle, fiches d'inspiration, bloc variété, cadrage de série. Ils restent en base, inutilisés par le rédacteur. |
| Le rédacteur | **Agentique** (`callAgentic`, déjà dans le code pour l'assistant) : il peut relire le document source en entier, consulter les événements voisins, écrire un brouillon, le juger contre le lecteur, recommencer. Trois tours au plus. Il rend le post par un outil final, structuré comme aujourd'hui. |
| Les contrôles du code (`scriptChecks.ts`) | **Conservés** tels quels, appliqués au post final. |
| Le portrait des lecteurs | **Devient une étape visible**, pas une tâche de fond : généré à la fin de l'onboarding en même temps que les séries, affiché, corrigeable. Un échec s'affiche et se relance. |
| Coût | Accepté : un post coûte 3 à 6 appels au lieu de 2. La lecture des événements coûte un appel par document, une seule fois. |

---

## 3. Le lecteur d'événements

**Quand.** À chaque ingestion de matière (collage, fichier, synchronisation GitHub/Notion/Linear), sur les documents pas encore lus. Et sur un bouton « Relire la matière » par sujet.

**Comment.** Un agent avec trois outils :
- `list_documents` : les documents du sujet, avec titre, taille, date d'ingestion, et s'ils ont déjà été lus ;
- `read_document` : le texte intégral d'un document (par tranches si trop long) ;
- `save_event` : enregistre un événement.

Il lit **tout**, en entier. Pour un journal daté, il suit les dates. Pour une doc technique sans dates, il en sort ce qui s'y trouve quand même (une décision, un chiffre mesuré, un abandon), avec une date approximative s'il peut la déduire, sinon sans date.

**Un événement, c'est :**

| Champ | Contenu |
| :--- | :--- |
| `date`, `datePrecision` | Le jour ; précision `jour`, `mois`, `inconnue`. |
| `title` | Le moment, pas un thème. « Marion arrête la démo au bout de 40 secondes », jamais « La démo ». |
| `whatHappened` | 2 à 5 phrases, les faits, avec les chiffres et les noms de la matière. Rien d'inventé. |
| `whatChanged` | Ce que ça a changé ensuite (une décision, un abandon, un chiffre qui bouge). Vide si rien. |
| `kind` | `échec`, `décision`, `résultat`, `retour d'utilisateur`, `étape`. |
| `audiences` | Pour qui c'est intéressant, parmi les publics du sujet (labels du portrait). |
| `sourceMaterialId`, `excerpt` | Le document et le passage exact qui prouve l'événement. |
| `toldByScriptIds` | Les posts qui l'ont déjà raconté. Vide = jamais raconté. |

Un événement raconté n'est pas verrouillé : il peut resservir sous un autre angle ou pour un autre lecteur, mais le rédacteur le sait.

**La ligne de temps du sujet** = ses événements triés par date. C'est elle que le plan d'une série et le rédacteur consultent. Elle est visible dans l'app (Lot 0 : une liste, rien de plus), corrigeable, et l'auteur peut y ajouter un événement à la main (« il s'est passé ça aujourd'hui »). L'interview de matière existante peut y écrire directement plus tard (point ouvert).

---

## 4. Le lecteur et la forme d'une série

> **La forme de la série est RETIRÉE le 2026-10-20, et rien ne la remplace.** Le § ci-dessous reste comme archive de ce qui a existé. Ce qu'on a constaté sur des générations réelles : une forme écrite par la machine finit toujours par prescrire la fabrication d'un épisode (« un bout de code », « finir sur la prochaine étape », « une liste de ce que je changerais »), et le rédacteur obéit à cette consigne-là avant d'obéir à ses propres règles — elle est plus précise et plus proche de lui. Resserrer la forme n'y change rien : ce qu'elle interdit à un endroit, le modèle le remet dans un autre champ. Seul subsiste de ce § le **choix du lecteur** : c'est tout ce qu'une série dit au rédacteur. Prompt 22 et `src/lib/llm/seriesForm.ts` supprimés, route `PUT /api/series/[id]/form` supprimée, colonne `content_series.form` conservée en base sans être lue.

**Le portrait des lecteurs** du sujet (existant, `products.readerPortrait`, 1 à 3 publics avec « s'arrête pour » et « fuit ») devient une étape visible de l'onboarding et de l'écran du sujet. Il est réfléchi **avec la matière sous les yeux** (les événements s'ils existent, sinon les documents), pas seulement avec la phrase « Pour qui ».

**À la création d'une série**, l'auteur choisit **un** public parmi le portrait. Le système écrit alors la **forme** de la série, en un appel, et l'auteur la lit et la corrige :

- ce que ce lecteur vient chercher dans cette série, en deux phrases ;
- de quoi est fait un bon épisode pour lui (ex. kiné : « un patient précis, ce qui n'allait pas, ce que l'app a montré, ce que le kiné a fait ensuite » ; dev : « ce qu'on croyait, ce qui a cassé, ce qu'on a changé, le chiffre avant et après ») ;
- ce qui le fait partir ;
- les mots qu'il emploie, ceux qu'il ne comprend pas ;
- la longueur et le registre qui lui conviennent sur la plateforme de la série.

Stocké sur `contentSeries` (`readerLabel` ; `form` jsonb, plus écrite ni lue depuis le 2026-10-20). Remplaçait le cadrage posture/voix/récit, **retiré du code le 2026-10-17** (ses colonnes restent en base sans être lues).

**Le plan d'une série** n'est plus un objet à part : c'est la ligne de temps filtrée sur le lecteur de la série (événements marqués pour ce public, ou sans public), dans l'ordre des dates, en sautant ce qui a déjà été raconté. Un post = le prochain événement de cette liste. L'auteur peut en sauter un ou en imposer un (« raconte celui-là »).

---

## 5. Le rédacteur

**Entrée (le brief) :**
- l'événement du jour, et ses voisins : les 2 précédents et le suivant dans la ligne de temps, pour situer (« une semaine après la démo… ») ;
- le lecteur de la série (§4) — et rien d'autre de la série : pas de brief d'écriture ;
- les règles de style apprises (existant) ;
- les 5 derniers posts de la série (existant : accroche, fin) ;
- la plateforme et ses limites chiffrées (existant, `platformRules.ts`).

**Outils :**
- `read_source` : le document source de l'événement, en entier ;
- `read_timeline` : la ligne de temps autour de l'événement (pour un rappel juste, jamais pour raconter deux événements) ;
- `submit_post` : le post final, même structure qu'aujourd'hui (titre, accroche, corps, hashtags, storyboard pour un visuel).

**Méthode, écrite dans le prompt :** relire la source ; écrire un brouillon pour cette seule personne, à partir de ce seul événement ; le relire comme elle (« est-ce que je lis la deuxième phrase ? ») ; si non, dire pourquoi en une ligne et recommencer, trois fois au plus ; soumettre. Les brouillons et les raisons de rejet sont gardés sur `scripts.generationTrace` pour qu'on puisse comprendre un mauvais post.

**Après :** les contrôles existants, puis l'événement est marqué raconté par ce script.

**Ce qu'on retire du message** par rapport à la V3 : les treize blocs deviennent cinq. L'identité « ghostwriter » et les règles d'écriture de `SCRIPT_CORE_PROMPT` restent, raccourcies ; la méthode en champs (`reader`, `candidateMoments`, `hookOptions`…) disparaît, remplacée par les tours de l'agent.

---

## 6. Données

Aucune table par verticale (règle de `docs/ARCHITECTURE_VERTICALES.md`). Une table nouvelle du cœur :

- `material_events` : `id`, `userId`, `productId`, `date`, `datePrecision`, `title`, `whatHappened`, `whatChanged`, `kind`, `audiences text[]`, `sourceMaterialId`, `excerpt`, `createdBy` (`reader` | `user`), `createdAt`.
- `source_materials.eventsReadAt` : date de la dernière lecture (null = à lire).
- `content_series.readerLabel`. (`content_series.form jsonb` conservée mais plus lue depuis le 2026-10-20.)
- `scripts.eventId`.

Rien n'est supprimé en base dans ce chantier. `narrative_state`, `content_series.framing`, `content_series.mode`, `inspirations` restent, non lus par la génération.

---

## 7. Le test

Sur le compte de test existant (`mykine.test@example.com`, matière déjà en place), comparé aux huit posts de `docs/tests/mykine-pack/RESULTATS.txt` :

1. **Cible kiné.** Série « MyKiné en construction », lecteur « kinés du sport », quatre posts. Critères, dans cet ordre : lus jusqu'au bout par Alix ; chaque post raconte un événement daté et un seul ; les événements sont dans l'ordre ; aucune tournure interdite, aucune invention (contrôles existants).
2. **Cible dev.** Même série, lecteur « développeurs de produits santé », quatre posts, mêmes critères. On regarde si la forme change vraiment avec le lecteur.
3. **Ligne de temps.** Les événements extraits du pack sont relus à la main contre `BIBLE.md` : rien d'inventé, dates justes, les dix décisions retrouvées.

Même rapport côte à côte que les essais précédents (`scripts/build-test-report.ts`), une colonne par cible.

---

## 8. Découpage

| Lot | Contenu | Sortie vérifiable |
| :--- | :--- | :--- |
| 0 | Le lecteur d'événements : table, agent et ses trois outils, lecture à l'ingestion et sur bouton, liste des événements dans l'écran du sujet. | La ligne de temps du pack MyKiné, relue contre la bible (test 3). |
| 1 | Lecteur et forme de série : portrait en étape visible, choix du public à la création d'une série, génération de la forme, édition. | Une série MyKiné avec « kinés du sport » et sa forme lisible. |
| 2 | Le rédacteur agentique : brief à cinq blocs, outils, tours, trace ; branché sur la génération depuis le calendrier ; chef débranché (flag). | Quatre posts cible kiné (test 1). |
| 3 | Test comparatif : cible dev, rapport côte à côte, analyse ensemble. | Rapport dans `docs/tests/`. |
| 4 | Retrait du chef et des blocs inutilisés, docs (`PRODUCT.md`, `TECH.md`, `PROMPTS.md`). | Code sans `narrativeDirector`. |

On s'arrête après le Lot 2 pour regarder les posts avant d'aller plus loin.

---

## 9. Ce que les essais du 2026-10-17 ont fait changer

- **Lecteur d'événements.** Première lecture : le premier moment du projet (la conversation qui l'a déclenché) et plusieurs entrées du journal manquaient ; une doc « dernière mise à jour : octobre 2026 » datait ses faits d'octobre. Prompt complété : chaque entrée datée d'un journal est un événement, le premier moment compte, la date de mise à jour d'un document ne date pas ce qu'il rapporte. Relecture du journal : 31 événements sur 32 entrées, tous datés, dans l'ordre.
- **Déduplication trop large.** Un fait déjà connu sous une date vague (doc technique) a fait sauter sa version datée au jour (journal). Point ouvert ci-dessous.
- **Rédacteur.** Les quatre premiers posts étaient des événements datés, dans l'ordre, avec les détails de la source, et aucun n'a été refusé par les contrôles. Deux défauts : le premier post racontait aussi l'événement suivant (pris dans ses voisins), et deux posts disaient « nous » pour un auteur seul. Prompt complété (le post s'arrête avant l'événement suivant ; première personne du singulier sauf équipe déclarée) ; le premier post régénéré s'arrête bien à son événement.
- **Cible dev (Lot 3).** Mêmes événements, lecteur « Développeurs santé et vision » : l'écriture change bien avec le lecteur (outils, seuils, compromis d'un côté ; « vous », « votre patient », effet au cabinet de l'autre). Deux défauts : la forme écrite pour le dev était une recette numérotée en six étapes, appliquée telle quelle à chaque post (même squelette, même fin « la prochaine mesure ») ; et le premier événement (la conversation qui a lancé le projet) n'a rien à dire à un dev, mais la série le voyait parce que les événements lus avant le portrait n'avaient pas de public. Corrigé : la forme décrit des ingrédients, jamais un ordre (`seriesForm.ts`) ; le rédacteur varie ouverture et fin d'un post à l'autre et ne reprend pas les chiffres des épisodes voisins (`eventWriter.ts`) ; **qualification des événements par public** (`qualifyEventsForSubject`, un appel structuré par lot de 60, déclenchée à chaque création ou correction du portrait, et `POST /api/events/qualify`). Seconde série de cinq posts (`RESULTATS_E_dev.txt`) : le premier événement est passé au kiné seul, les ouvertures et les fins varient, les hashtags aussi ; restent quelques rappels des épisodes voisins et un « nous » (la forme présumait une équipe : corrigé dans le prompt de la forme).
- **Exemples des prompts.** Les exemples écrits pendant le test portaient sur le pack (kiné, Marion). Remplacés par des exemples fictifs sans rapport (un testeur, un joueur, un pair), marqués comme tels, pour ne pas orienter les générations vers ce domaine.

## 10. Points ouverts

- L'interview de matière devrait pouvoir écrire des événements directement (une question = un événement), c'est le geste de ghostwriter le plus naturel. Pas dans ce chantier.
- Les posts visuels : le brief vaut aussi pour eux (storyboard dans `submit_post`), la maquette reste inchangée. À vérifier au Lot 2.
- Le rythme des séries, le calendrier, le style appris : inchangés.
- Un document de 100 Ko (journal de commits) : lu par parties de 12 000 caractères, plafond de tours `12 + 4 × parties`.
- Quand un événement existe déjà avec une date vague et qu'un document mieux daté le raconte, le lecteur le saute : il faudrait accepter la version mieux datée et retirer l'autre.
- Un rappel d'épisode voisin revient encore parfois avec ses chiffres malgré la consigne ; à surveiller sur plus de posts avant d'en faire un contrôle du code.
