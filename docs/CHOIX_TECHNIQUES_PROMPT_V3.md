# CHOIX TECHNIQUES — PROMPT V3, MÉMOIRE, VEILLE ET CADRAGE

> Écrit le 2026-10-17, en fin de conversation, sur la branche `feature/prompt-generation-v3`. Les specs disent **quoi** (`docs/SPEC_PROMPT_GENERATION_V3.md`, `docs/SPEC_MEMOIRE_ET_VEILLE.md`, `docs/SPEC_CADRAGE_SERIE.md`). Ce document dit **pourquoi** chaque choix technique a été fait, ce qu'on a écarté, et ce que les essais réels ont fait changer. Les textes des prompts sont dans `docs/PROMPTS.md`.

---

## 1. Point de départ

L'inventaire des prompts (`docs/PROMPTS.md`) a montré que le prompt de génération :
- disait surtout ce qu'il ne fallait pas faire ;
- ne savait presque rien du lecteur, avec une seule audience pour tout le compte ;
- écrivait d'un seul jet, sans contrôle derrière.

Pour la structure, on s'est inspiré des prompts publiés de Lovable, v0, Cursor, Claude Code, Manus, Perplexity et Notion AI, ainsi que des guides d'écriture de prompts d'OpenAI et d'Anthropic. On en a retenu quatre pratiques :
- une identité courte et juste ;
- un ordre de priorités explicite ;
- des exemples bons et mauvais, plutôt que des adjectifs ;
- une méthode de travail écrite pas à pas, c'est-à-dire la liste de tâches que le modèle se fait avant de produire.

Les règles qui se mesurent (longueurs, tournures, citations) sont sorties du prompt pour devenir des contrôles du code.

---

## 2. La réflexion du modèle : dans l'outil, avant le post

**Choix.** Les étapes de réflexion sont des champs de l'outil de sortie, placés **avant** les champs du post : `reader`, `candidateMoments`, `chosenMoment`, `concept`, `hookOptions`, `chosenHook`, `inspirationsUsed`, `inspirationsToDrop`. Viennent ensuite le post, puis `selfCheck`.

**Pourquoi.**
- Le modèle remplit les propriétés JSON dans l'ordre du schéma. Mettre la réflexion en premier l'oblige à décider à qui il parle, quel moment il raconte et quelle accroche il garde, avant d'écrire une ligne. C'est le mécanisme déjà validé par le champ `concept` en v2, étendu à toute la méthode.
- **Un seul appel** : pas de boucle agentique, pas de coût multiplié, et la même latence qu'avant.
- La réflexion est **gardée** sur `scripts.generationTrace` et jamais publiée. Elle permet de comprendre un mauvais post sans le régénérer. Elle reste hors de `firstDraftSnapshot`, pour ne pas fausser l'apprentissage du style.

**Écarté.** Un appel de planification séparé (deux allers-retours, deux fois le contexte), et la réflexion cachée d'un modèle de raisonnement, qu'on ne peut ni lire ni stocker.

**Mode strict.** Les deux outils passent en `strict: true` : toutes les propriétés sont requises et `additionalProperties` vaut false. Le schéma Zod de la préparation reste tolérant (valeurs par défaut), pour qu'un champ de réflexion vide ne fasse jamais perdre un post. `maxTokens` passe à 4096, parce que la réflexion prend de la place.

---

## 3. Ce que le code vérifie, et la seconde tentative

**Choix.** `src/lib/llm/scriptChecks.ts` vérifie, après chaque génération :
- les tournures interdites (expressions régulières sur texte normalisé, sans accents ni casse) ;
- les limites par plateforme (`platformRules.ts` : accroche, corps, hashtags) ;
- les citations retrouvées dans la matière (`findBestMatchInText`) ;
- le nombre de `[à compléter]` ;
- le nombre de slides ;
- l'auto-contrôle du modèle ;
- la répétition d'accroche par rapport aux derniers posts.

En cas de faute, **une seule** relance part avec un bloc `<refus>` qui liste les fautes. On garde la tentative qui en a le moins ; à égalité, la seconde.

**Pourquoi.**
- Un modèle respecte mal une consigne chiffrée (« 200 caractères au plus »), alors que le code la vérifie sans erreur. Le prompt garde l'intention, le code garde la mesure.
- Une seule relance borne le coût à deux appels. Au-delà, les essais ne gagnaient plus rien.
- Garder la meilleure tentative plutôt que la dernière évite qu'une relance ratée remplace un post presque bon.
- Un échec de lecture de la première réponse (ZodError) déclenche aussi la relance : sans ça, un JSON mal formé faisait perdre la génération entière.

**Ajusté en revue.**
- La règle « ce n'est pas X, c'est Y » attrapait des phrases normales : elle est limitée à 60 caractères sans ponctuation entre les deux.
- `[a completer]` écrit sans accents n'était pas compté : il l'est désormais, la recherche se faisant sur le texte normalisé.

---

## 4. Le lecteur par sujet

**Choix.** L'audience appartient au sujet (`products.targetAudience`), plus au compte. Un portrait de 1 à 3 publics en est tiré (`products.readerPortrait`). Le rédacteur en chef choisit chaque jour un public (`readerLabel`, une enum des labels plus une chaîne vide) en évitant celui des derniers posts.

**Pourquoi.**
- Un outil de code et un jeu vidéo en build in public n'ont pas les mêmes lecteurs, même chez un seul auteur. Une audience globale moyennait les deux.
- Plusieurs publics par sujet sont assumés, mais un post n'en vise qu'**un** : un post qui parle à tout le monde ne parle à personne.
- L'enum du `readerLabel` empêche le modèle d'inventer un public qui n'existe pas dans le portrait.

**Garde-fous.**
- Le portrait se régénère **en tâche de fond** (`after()` de Next.js) quand l'audience change. Ainsi, l'enregistrement d'un sujet ne dépend jamais d'un appel au modèle.
- L'écriture est **conditionnelle** : rien n'est écrit si le portrait a été édité à la main (`editedByUser`) ou si l'audience a changé pendant l'appel (`basedOnAudience`). La revue a trouvé une course entre deux régénérations, et la version user-wide recalculait tous les sujets. Seuls les sujets touchés sont recalculés désormais.
- L'onboarding n'écrase plus une audience existante par une valeur vide (bug trouvé en revue).

---

## 5. La mémoire des derniers posts

**Choix.** Le rédacteur reçoit des **fiches** de ses 5 derniers posts du sujet : accroche, type d'accroche, lecteur visé et dernière phrase. Il ne reçoit pas les textes entiers. Le code refuse une accroche qui reprend les 6 premiers mots d'une récente, ou un 3e post d'affilée avec le même type d'accroche.

**Pourquoi.**
- Des fiches courtes coûtent peu de contexte, et on n'y trouve que ce qui se répète vraiment : les ouvertures et les fins.
- Le contrôle de répétition est dans le code, parce que dire au modèle « ne te répète pas » sans mesure ne marche pas.
- 5 posts : assez pour voir une habitude, pas assez pour noyer le brief.

---

## 6. La veille d'inspiration

**Choix.** La veille fonctionne en deux appels :
1. une recherche web (`callWebResearch` : l'outil intégré `web_search` de l'API Responses d'OpenAI, `search_context_size: "medium"`) ;
2. une mise en fiches (`save_inspirations`).

On ne garde que les URL que la recherche a **réellement consultées** (annotations `url_citation`). Il y a 10 fiches actives au plus par sujet, réinjectées dans le prompt sous forme de références `i1`…`i10`. Le rédacteur déclare celles qui l'ont servi et celles qui ne serviront jamais.

**Pourquoi.**
- **Deux appels plutôt qu'un** : la recherche web et la sortie structurée stricte se combinent mal dans un même appel. Séparer les deux garde des fiches propres.
- **Les URL consultées seulement** : sans ce filtre, le modèle peut inventer des liens plausibles. L'annotation est la preuve que la page a été lue.
- **Les références courtes `i1`…`i10`** : le modèle les recopie sans erreur, ce qui n'est pas le cas d'une URL ou d'un id technique.
- **Hors de la rédaction** : la veille tourne en arrière-plan, après une génération et seulement si la précédente a plus de 7 jours, ou sur le bouton. Une génération n'attend jamais le web. `INSPIRATION_AUTO_REFRESH=false` la coupe.

**Changé après les essais réels.**
- **Première veille vide.** Le modèle répondait de mémoire sans chercher, donc sans annotation, et toutes les fiches étaient filtrées. Correctif : `tool_choice: "required"`.
- **Des fiches jetées trop vite.** Sur un seul post, le modèle en écartait 4 ou 5 sur 8 : il confondait « pas pour ce post » et « jamais pour ce sujet ». Trois correctifs :
  - un compteur `dropVotes` (migration `0040`), avec la fiche écartée au **2e** vote seulement, et un usage qui remet le compteur à zéro ;
  - une consigne réécrite : n'écarter que ce qui ne servira **JAMAIS** ;
  - une fiche montrée 8 fois sans servir qui sort d'elle-même.

  La mise à jour des compteurs se fait en une requête SQL (`CASE`), pour qu'il n'y ait pas de lecture puis écriture concurrente.

---

## 7. Le cadrage de série

**Choix.**
- Trois dimensions : la **posture**, la **voix** et le **récit**, plus une **signature**.
- Un **catalogue fixe** de 6 options par dimension, chacune avec sa règle, dans le code.
- Le modèle choisit 3 options et écrit leurs extraits sur **un même vrai moment** de la matière.
- La voix est choisie une fois pour le compte (`creatorProfiles.chosenVoice`). La posture, le récit et une éventuelle voix propre à la série vont dans `contentSeries.framing`.
- Côté serveur, aucun état pendant le parcours : le navigateur renvoie les choix et le moment à chaque étape, et seul l'enregistrement final écrit en base.

**Pourquoi.**
- Personne ne sait répondre à « quel ton veux-tu ? », mais tout le monde sait choisir entre trois textes. Écrire les trois sur le **même** moment fait comparer la manière et non le sujet.
- **Le catalogue fixe** : les règles injectées ensuite dans la génération restent stables et testables, et seuls les extraits sont personnels. Un modèle qui inventerait les options produirait des règles floues et impossibles à relire. L'`id` est une enum du catalogue, moins les options déjà vues, pour que « Aucune ne me va » propose vraiment autre chose.
- **Côté serveur, sans état** : pas de table de brouillon, et un parcours abandonné ne laisse rien en base.
- **La voix du compte** : la voix appartient à l'auteur, pas à une série. La redemander à chaque série la ferait dériver.
- **L'angle, réduit à la forme de l'accroche** pour une série cadrée : le récit choisi fixe la structure, et l'angle tiré au hasard ne doit plus la contredire.

**Changé après les essais réels.** Voir `docs/SPEC_CADRAGE_SERIE.md` §6 :
- le moment était un README : `pickFramingMoment` le choisit maintenant sur les résumés ;
- les extraits dépassaient 120 mots : plafond à 80 ;
- « Recadrer » réutilisait l'ancien moment : ajout de `freshMoment`.

---

## 8. Les séries : rattachement au sujet et retrait

**Rattachement.** Les essais ont montré que la série de dev n'était liée à aucun sujet. Ses posts s'écrivaient alors sans matière ni portrait, ce qui faussait les premiers essais. `suggestContentSeries` reçoit maintenant `subjectName`, une enum des sujets du compte, et `generateSeriesForUser` rattache d'office l'unique sujet quand il n'y en a qu'un.

**Retrait.** Un retrait réel du 2026-10-17 a montré trois défauts :
1. la page Direction vide régénérait des séries d'elle-même ;
2. les posts rédigés restaient au calendrier sous une série archivée ;
3. les créneaux vides devenaient des posts libres que plus personne ne reprenait.

Correctifs :
- l'auto-génération est réservée à la sortie d'onboarding (`?selection=1`) ;
- `releaseSlotsOfArchivedSeries` traite tous les créneaux à venir non publiés : un post rédigé sort du calendrier (`scriptId` remis à null, le script reste dans les scripts), le jour passe vide à une série restante, ou est supprimé s'il n'en reste aucune.

Le message de confirmation de la fenêtre de série promettait déjà ce comportement.

---

## 9. Autres choix plus petits

- **Une note de relance générique** (`TOOL_CALL_RETRY_NOTE`). L'ancienne parlait d'un champ `assistantReply`, qui n'existe que dans l'interview.
- **La maquette.**
  - `rationale` a désormais une valeur par défaut.
  - Une slide mal formée (ZodError) déclenche une relance, comme une erreur de validation.
  - Le dépassement des 12 calques reste ouvert : il relève du chantier maquette (`docs/RECHERCHE_DESIGN_MAQUETTE.md`).
- **La régénération d'un bloc** utilise `SCRIPT_CORE_PROMPT`, pour garder la même voix que la génération complète.

---

## 10. Comment on a testé

- **`scripts/compare-generation.ts`.** Il compare la V2, figée dans `scripts/compare-v2/`, à la V3 sur les mêmes briefs (`docs/baseline/v2-vs-v3/`). La copie figée sera supprimée une fois la V3 validée.
- **`scripts/run-generation-test.ts`.** Il rejoue des scripts existants avec la même matière, selon trois modes :
  - `--baseline` : relit les scripts actuels ;
  - `--v2` : ancien prompt ;
  - `--product` : sujet forcé.

  Il sauvegarde et restaure l'état narratif, pour ne pas faire avancer le plan du rédacteur en chef. Il compose aussi la maquette sans l'enregistrer.
- **`scripts/build-test-report.ts`.** Il produit `docs/tests/2026-10-17/essais.html`, avec des colonnes côte à côte et un lecteur d'animation qui reprend le moteur `keyframesFor`.

Ce que les essais ont montré :
- **Le rattachement de la matière** apporte l'essentiel du gain.
- **La V3** apporte la discipline : 2 ou 3 hashtags au lieu de 4 ou 5, des textes plus courts, des contrôles. Les accroches sont un peu meilleures.
- **La maquette d'animation** échoue dans les deux versions, à cause d'un trop grand nombre de calques. C'est le prochain chantier.

**Reste à faire :** le test 3, où l'auteur cadre lui-même la série avant la génération.
