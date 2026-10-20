# SPEC — Les événements sont lus pour une cible

Statut : cadrage arrêté, 2026-10-20. Suite directe du premier lancement réel du fil narratif
(`docs/SPEC_FIL_NARRATIF.md`), qui a sorti trois posts qu'un kiné ne peut pas lire.

## 1. Ce qui s'est passé

Compte de démonstration monté sur le pack MyKiné (15 documents : 13 de documentation technique,
`B/devlog.md` daté, `B/decisions.md`), public du sujet réglé sur « des kinés libéraux du sport, pas
des développeurs ». Les trois premiers posts parlaient de `POST /api/v1/s/{code}/sessions`, d'angles
échantillonnés à 10 Hz, de JWT 24 h et de colonnes JSONB.

Les faits, relevés dans la base :

| Constat | Mesure |
| :--- | :--- |
| Les trois posts viennent du même fichier de documentation | `A/architecture.md` |
| Le devlog et les décisions n'étaient **pas encore lus** quand les posts ont été écrits | posts à 10:13–10:16, `B/*` lus à 10:20 |
| La lecture a été coupée par son plafond de tours | `maxTurns: 32`, 34 appels d'outils, `stoppedAtMaxTurns: true` |
| Le budget compte les **parties lues**, pas les événements enregistrés | `12 + 4 × parties` ; un devlog de 11 entrées tient dans une partie |
| Les publics des trois événements ont été posés **après** les posts | 10:21:04 contre 10:13–10:16 |
| Et le tri a dit oui quand même | « Sports physiotherapists » attribué aux angles à 10 Hz et au JWT 24 h |
| Un événement sans public est offert à **toutes** les séries | 19 événements dans ce cas |
| Les 13 fichiers techniques ont été lus avec un portrait **périmé** qui incluait un public technique | une étiquette `Tech-savvy Physiotherapists` subsiste sur un événement |

## 2. Les quatre défauts

1. **Le « pour qui » ne sert pas à l'extraction.** Le lecteur reçoit la liste des publics avec une
   ligne chacun (`label: who`), sans ce qu'ils viennent chercher ni ce qui les fait fuir, et une
   passe séparée (prompt 24) distribue les publics **après coup**, sans le document sous les yeux.
2. **L'ordre de lecture fait loi.** Le lecteur lit document par document et enregistre au fil de
   l'eau, avec pour consigne de ne pas réenregistrer un fait qu'un autre document a déjà donné. Le
   premier document lu s'approprie donc le cadrage ; la version datée et racontée du même fait,
   lue plus tard, est écartée comme doublon.
3. **Aucune synthèse entre documents.** Un fait et sa raison qui vivent dans deux fichiers ne se
   rencontrent jamais (la décision de traiter sur l'appareil est dans le devlog, ce que ça change
   pour un patient est dans `privacy.md`).
4. **La règle sur les documents techniques est fausse.** Le prompt dit qu'ils « ne contiennent aucun
   événement, sauf ce qu'ils rapportent comme s'étant produit ». C'est l'inverse : « rien de ce que
   filme le téléphone n'en sort, le serveur ne reçoit que des degrés » est un des meilleurs posts
   possibles pour un kiné, et c'est dans un fichier de documentation.

## 3. Ce qui est décidé

1. **Les faits une fois, la traduction par public.** L'événement garde ses faits bruts et porte,
   pour chaque public retenu, **une ligne : ce que ça change pour lui, dans ses mots**. Écrite à
   l'extraction, document sous les yeux. Une ligne de temps reste unique par sujet — c'est ce qui
   permet à deux séries de lecteurs différents de raconter le même fait sans parler la même langue.
2. **La bonne question n'est plus « est-ce que ce document raconte ? » mais « est-ce que ce fait
   change quelque chose pour quelqu'un ? »** Un document technique a le droit de rendre des
   événements. Un fait qui ne change rien pour aucun public n'en est pas un.
3. **Le lecteur reçoit le portrait complet** de chaque public : qui, ce qu'il vient chercher, ce qui
   l'arrête, ce qui le fait fuir, ses mots.
4. **« Personne » veut dire personne.** Un événement sans public ne part dans aucune série. La
   distinction entre « pas encore trié » et « trié, personne » est explicite.
5. **La date n'est pas un critère de recevabilité.** Beaucoup d'événements ne seront jamais datés.
   Elle ne reste exigée qu'au seul endroit où elle veut dire quelque chose : le déclencheur de
   l'origine (`SPEC_FIL_NARRATIF.md` §7).
6. **Un changement de public relit la matière**, il ne redistribue pas des étiquettes sur des
   événements écrits pour quelqu'un d'autre. Le prompt 24 disparaît.

## 4. Données

- `material_events` : `audience_angles` (jsonb, défaut `[]`) — `[{ audience, whatItChanges }]`, une
  entrée par public retenu, `whatItChanges` dans les mots de ce public. `audiences` reste la liste
  des publics retenus (dérivable de `audience_angles`, gardée pour les filtres existants).
- `material_events.qualified_at` (timestamp, nullable) — `null` = pas encore trié. Distingue « pas
  encore passé par le lecteur » de « trié, personne », les deux non racontables, mais seul le
  premier mérite une relecture.
- Aucune table nouvelle (règle des verticales, `schemaInvariants.test.ts`).

## 5. Le lecteur d'événements (prompt 21 revu)

**Ordre de lecture.** La matière qui raconte avant celle qui décrit. Le code trie les documents à
lire : d'abord ceux qui contiennent des dates (journal, devlog, décisions — détecté par le code, pas
par le modèle : densité de dates ISO ou de titres datés), ensuite le reste. Le récit est lu quand le
budget est intact.

**Budget de tours.** `12 + 4 × parties` compte les lectures et ignore les enregistrements. Il devient
`12 + 4 × parties + 2 × événements_attendus`, où `événements_attendus` est majoré par le nombre de
dates distinctes trouvées dans les documents à lire. Un journal de 30 entrées ne doit plus être coupé.

**Compléter au lieu d'écarter.** La consigne « un événement déjà enregistré n'est pas réenregistré »
devient : un fait déjà enregistré peut être **complété** — une date, un `whatChanged`, un extrait
meilleur, un public de plus. Un outil `complete_event(id, …)` à côté de `save_event`. Le cadrage le
plus précis gagne, pas le premier lu.

**Par public, à l'extraction.** `save_event` reçoit `audienceAngles` au lieu de `audiences` : pour
chaque public à qui ce fait parle, une ligne de ce que ça change pour lui. Vide = personne, et le
dire est une réponse normale. Le code vérifie que les publics nommés existent dans le portrait.

**Passe de synthèse.** Une fois tous les documents lus, un appel sur la ligne de temps entière
(titres, dates, publics, sans les documents) : fusionner les doublons, compléter les `whatChanged`
qui se trouvent dans un autre événement, retirer ce qui ne change rien pour personne. Elle ne crée
aucun événement — elle ne fait que fusionner, compléter et retirer.

## 6. Ce que le rédacteur reçoit

Le brief d'événement (prompt 23) et le brief de récit (prompt 28) reçoivent, pour chaque événement
du périmètre, **la ligne du lecteur de la série** en plus des faits bruts. Le rédacteur part de cette
ligne et prouve avec les faits ; il n'a plus à deviner la traduction.

Et le contrôle qui manquait : un terme de `form.jargon` présent dans le post sans être expliqué par
son effet renvoie le post au modèle (`scriptChecks.ts`). Ce qui se mesure est vérifié par le code.

## 7. Relecture de l'existant

Les événements déjà en base n'ont pas d'angles et ont été écrits sans cible. La migration les marque
`qualified_at = null` : ils ne partent dans aucune série, et la prochaine relecture de la matière les
reconstruit. Sur un compte existant, cela veut dire une relecture complète — longue, à déclencher
explicitement (« Relire la matière »), jamais en silence.

## 8. Banc d'essai

Le pack MyKiné est le cas : 13 fichiers techniques, un devlog daté, un fichier de décisions, et un
public réglé sur les kinés seuls. Ce qui doit être vrai après lecture :

- le déclencheur du 2025-11-09 (Julien : 6 patients sur 10 ne font pas leurs exercices) **existe**
  dans la ligne de temps, daté ;
- les 11 entrées du devlog sont toutes là — la lecture n'est plus coupée ;
- `A/privacy.md` rend un événement avec une ligne kiné qui ne contient ni « angle », ni « serveur »,
  ni « JSONB » ;
- aucun événement ne porte d'angle pour un public absent du portrait ;
- les faits de plomberie (une colonne JSONB, un schéma d'authentification) ne retiennent **aucun**
  public et ne partent dans aucune série ;
- et sur les trois premiers posts : un kiné les comprend sans rien savoir de la technique.

## 9. Ordre de construction

1. Données (§4) et tri des documents + budget de tours (§5) — la partie code, testable sans modèle.
2. `save_event` par public et `complete_event` ; portrait complet dans le prompt 21.
3. Passe de synthèse ; retrait du prompt 24.
4. La ligne du lecteur dans les briefs 23 et 28 ; contrôle de jargon.
5. Relecture du pack MyKiné, jugement sur les six critères du §8, itérations sur le prompt 21.
