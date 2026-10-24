# SPEC — L'événement-pointeur, et le rédacteur qui choisit

> **Statut : arrêté le 2026-10-24** après quinze runs du banc hors application (`scripts/bench-pointeurs.ts`, relevés dans `docs/tests/pointeurs/`). Remplace `docs/SPEC_CHOIX_DES_EVENEMENTS.md`, qui est **retirée** : son choisisseur séparé n'existe plus, c'est le rédacteur qui choisit.
>
> **En une phrase.** Un événement n'a plus aucun champ — c'est un document, une ligne, et une date quand la ligne en porte une. Il n'y a plus de choisisseur, plus de fil narratif, plus de filtre par public : le rédacteur reçoit la ligne de temps en adresses nues, ouvre ce qu'il veut, choisit ce qu'il veut, et écrit.

---

## 1. Pourquoi

Le test du 2026-10-22 sur le chemin réel de l'app, sujet tellovo (43 documents, 966 688 caractères) :

| | chemin réel | banc pointeur |
| :--- | :--- | :--- |
| Documents lus | **4 sur 43** | 43 sur 43 |
| Événements / pointeurs | 68 | 581 |
| Datés | 68 | 350 |
| Durée par post | 61 à 198 s | 11 à 48 s |

Le lecteur d'événements (prompt 21) est **un seul appel agentique** : 240 tours au plafond, chaque `read_document` versant 12 000 caractères dans une conversation qui se recharge à chaque tour. Sur tellovo il s'est arrêté de lui-même au 107e tour en demandant la permission de continuer — dans un travail de fond où personne ne lira sa question. Les 39 documents restants n'ont jamais été lus. Vingt et un enregistrements sur 96 ont été rejetés, tous sur la contrainte d'`excerpt` (« too long », « not found in the document »).

Sur MyTwin Leaderboard, le même lecteur a produit 112 événements dont **4 datés** et **107 sans `whatChanged`**, tirés de documentation de référence (`api.md`, `database.md`, `challenge-groups.md`) qui décrit comment le système marche et ne raconte rien. Le `find` chronologique de `planForSeries` n'avait donc le choix qu'entre quatre décisions de politique éditoriale des news du projet. Aucun choisisseur, même parfait, n'aurait sauvé ces posts.

L'extracteur de pointeurs n'a pas ce problème parce qu'il ne tient rien : une passe par part de document, un appel structuré, une liste d'entiers. Il voit tout le corpus, et il ignore la doc de référence de lui-même (0 pointeur sur 11 des 15 documents MyKiné, 0 sur `api.md` et `database.md`).

Les posts ont été jugés meilleurs par le fondateur sur les trois sujets, à modèle de rédaction identique (`gpt-6-luna`).

---

## 2. Ce qu'est un événement

**Un document, une ligne, une date.** Rien d'autre, et il n'y a rien d'autre à ajouter plus tard.

```
material_events : source_material_id → le document
                  line               → le numéro de ligne, à partir de 1
                  date               → ISO, ou null
```

Disparaissent : `title`, `what_happened`, `what_changed`, `kind`, `audiences`, `audience_angles`, `at_stake`, `excerpt`, `qualified_at`, `date_precision`, `origin`. **Colonnes supprimées, pas conservées** — la convention « colonne gardée » du repo (`at_stake`, `beat_id`, `content_series.mode`) est écartée ici exprès : le point de ce chantier est qu'aucun champ ne revienne par la petite porte.

Qui veut savoir ce qu'il y a dans un événement ouvre le document à cette ligne. C'est ce que fait le rédacteur.

Pas de table nouvelle, pas de partitionnement : l'invariant de `docs/ARCHITECTURE_VERTICALES.md` chantier 4 (`src/db/schemaInvariants.test.ts`) tient.

---

## 3. L'extracteur (remplace le prompt 21)

`src/lib/llm/pointerExtractor.ts`. **Non agentique** : le document est numéroté ligne par ligne, coupé en parts de 40 000 caractères sur des lignes entières, et chaque part fait un `callStructured` qui rend `{ line, date }[]`.

Les numéros sont ceux du document complet, jamais ceux de la part — sinon le pointeur ne pointe sur rien.

Le prompt ne contient **qu'une phrase de définition**, isolée dans la constante `EVENT_DEFINITION` pour être le seul levier si un relevé est mauvais :

```
An event is a line of this document where something happened.
```

Et l'interdit qui va avec : il n'enregistre ni titre, ni résumé, ni conséquence, ni public. Seulement la ligne et la date.

Contrôles du code : ligne hors du document ignorée, date non ISO ramenée à `null`, doublon de numéro écarté.

Mesures : tellovo 581 pointeurs en 50 appels, MyTwin 211 en 48, MyKiné 79 en 15.

---

## 4. Le rédacteur (remplace les prompts 23 et 28)

`src/lib/llm/pointerPostWriter.ts`, `callAgentic`, effort `medium`, `maxTokens` 4096, **40 tours** au plus. Trois outils : `read_file(file, from_line, to_line)` plafonné à 120 lignes par appel, `read_post(id)`, `publish_post(post, event_ids)`.

Il reçoit : la marque, le sujet, le contexte du projet, le lecteur, la ligne de temps en adresses nues avec les marques `(already used)`, et la liste des posts publiés — **identifiants et dates seulement**, pas de titre ni d'extrait, pour qu'il doive appeler `read_post` s'il veut savoir ce qui a été dit.

### Les quatre phrases du prompt, arrêtées au run C

Elles sont la totalité des règles. Toute règle ajoutée après devra passer le même banc.

1. **La règle unique.** `That is your only rule: build in public, for that reader.`
2. **L'origine**, seule exception : s'il n'y a aucun post publié, le premier est l'origine ; sur un projet jeune elle présente le projet et pourquoi il existe, sur un projet avec de la matière derrière lui elle peut être la raison de passer en public, quand la matière ou les mots de l'auteur la donnent. **Cette raison est celle qu'ils donnent, jamais une choisie pour coller au lecteur** — c'est cette dernière moitié qui a supprimé le faux « pourquoi » (un post MyKiné ouvrait sur le piège du laptop, qui n'est pas la raison d'exister de MyKiné).
3. **L'accroche.** La première phrase est une accroche et rien d'autre : un chiffre, une heure, un aveu, une ligne qui a du nerf, voire un brin de folie. Jamais un résumé du post, jamais une question qu'on se pose à soi-même.
4. **Aucun post mort**, et la variation de forme : il relit les posts précédents pour ne pas réécrire ce qui a été dit, **jamais pour copier leur forme** ; et tout élément de machinerie nommé (table, fonction, bibliothèque, outil) est expliqué dans la même phrase.

### Ce qui a été essayé et rejeté

| Essai | Résultat | Décision |
| :--- | :--- | :--- |
| Aucune règle de forme (run A) | les 12 posts à 4 paragraphes exactement, tous finissant par une leçon | rejeté |
| « *because they have the same problem* » dans l'origine | faux « pourquoi » fabriqué : le post suppose que le lecteur du post et l'utilisateur du produit ont la même douleur, vrai pour tellovo, faux pour MyKiné | **retiré** |
| Phrase de porte d'entrée pour un inconnu (run D) | **6 posts sur 12** finissent par une description quasi copiée du produit, alors que la phrase l'interdisait explicitement | **rejeté** |

Le run D est la démonstration la plus nette de la loi du `docs/DEVLOG.md` 2026-10-21 : nommer une exigence suffit à la faire ressortir comme un bloc, et l'interdire dans la même phrase n'y change rien.

### Mesures du run C, 12 posts enchaînés sur tellovo

4 ou 5 paragraphes, 816 caractères de moyenne (664–1104), 25 pointeurs utilisés sur 581, **aucun pointeur repris par deux posts**, accroches toutes différentes. Pas d'épuisement au douzième post.

---

## 5. Ce qui est retiré

| Retiré | Pourquoi il ne peut plus tourner |
| :--- | :--- |
| `src/lib/llm/eventReader.ts` (prompt 21) et son appel dans `materialEventService` | remplacé par l'extracteur ; c'est lui qui lisait 4 documents sur 43 |
| `src/lib/narrative/` en entier — `placement.ts`, `audience.ts` (`tellableTo`) | lit `whatChanged` et `audiences`, qui n'existent plus ; et l'origine est désormais une phrase du prompt |
| `src/lib/llm/narrativeWriter.ts` (prompt 28), `narrativeBriefService.ts` | les trois types de post de récit disparaissent avec le placement |
| `src/lib/llm/eventWriter.ts` (prompt 23) et `buildEventBriefForSeries` | remplacés par le rédacteur à pointeurs |
| le rôle de choix de `planForSeries` | le rédacteur choisit. La fonction ne sert plus qu'à donner la ligne de temps filtrée d'une série |
| `docs/SPEC_CHOIX_DES_EVENEMENTS.md` | caduque |
| `narrative_state`, `scripts.beat_id`, `content_series.mode`, `content_series.form` | déjà orphelines ; elles partent avec la migration |

Le filtre par public disparaît : **une série raconte la ligne de temps de son sujet, sans tri par lecteur.** Le lecteur de la série reste, il dit au rédacteur pour qui il écrit — c'est le seul usage qu'il en avait de toute façon dans le banc, et c'est lui qui décide du registre (les trois sujets dont le lecteur est un pair qui construit donnent du récit ; MyTwin, dont les trois publics sont des opérateurs du produit, donne de la documentation).

---

## 6. Ce que le banc ne couvre pas et que la prod exige

Sept points. Ce ne sont pas des angles morts : ils sont du travail à faire, listés ici pour qu'aucun ne se découvre en route.

1. **La langue.** Le banc n'a aucune règle de langue et le modèle a tiré au hasard sur quatre runs du même sujet : FR, EN, FR, FR. L'app a `creator_profiles.language` et le revérifie dans `scriptChecks` — à passer au rédacteur et à contrôler, règle absolue de `docs/SPEC_LANGUE_DES_POSTS.md`.
2. **Le hook et la caption sont deux colonnes** (`scripts.hook_text`, `scripts.caption`) que l'éditeur et les maquettes lisent séparément. `publish_post` rend un bloc : le découpage se fait sur la première phrase, qui est l'accroche par construction (règle 3).
3. **Les deux réseaux.** `postPairService` écrit LinkedIn puis X sur le même événement, avec `platformRules.ts` (longueurs, hashtags). Le rédacteur n'a aucune notion de réseau : les règles de plateforme entrent dans son prompt, et la version X reprend les `event_ids` de la version LinkedIn.
4. **`event_ids` ne dit pas la vérité.** Au post 2 de MyTwin : 14 `read_file` pour 2 pointeurs déclarés. La marque « utilisé » est donc plus étroite que ce que le post a réellement consommé. Accepté tel quel : le run C n'a produit aucun doublon malgré ça.
5. **La répétition de substance n'est pas attrapable par la marque.** Au run A, deux posts à sept d'écart racontaient la même histoire depuis des adresses différentes (`DEVLOG.md:165` et `DEVLOG.md:169-173`). Seule la relecture des posts l'attrape, et elle est au bon vouloir du modèle. Le run C ne l'a pas reproduite, mais rien ne la prévient.
6. **La récence domine.** Sur 12 posts, 9 puisent dans le dernier mois ; septembre 2026 et ses 49 pointeurs n'ont jamais été touchés, et 3 pointeurs de `commit-log.txt` ont servi sur 246. À surveiller en réel avant d'ajouter une règle d'alternance, qui deviendrait un réflexe mécanique.
7. **Le coût par post.** `read_post` croît avec la série : 11 relectures au douzième post. À mesurer sur une série longue.

---

## 7. Ordre de construction

1. **Lot 0 — l'extracteur et la migration.** `pointerExtractor.ts` branché dans `materialEventService`, migration qui vide `material_events` de ses champs et ajoute `line`, retrait de `eventReader.ts`. Tout le reste en dépend.
2. **Lot 1 — le rédacteur.** `pointerPostWriter.ts` branché dans le chemin de génération, avec la langue (point 6.1), le découpage hook / caption (6.2) et les règles de plateforme (6.3). Retrait d'`eventWriter.ts`.
3. **Lot 2 — les retraits.** `src/lib/narrative/`, `narrativeWriter.ts`, `narrativeBriefService.ts`, le rôle de choix de `planForSeries`, les colonnes orphelines, `SPEC_CHOIX_DES_EVENEMENTS.md`.
4. **Lot 3 — les écrans.** Partout où un événement s'affichait par son titre : ligne de temps, « Why this angle », panneau de série.
5. **Lot 4 — essai en réel** sur tellovo et MyKiné, puis mise à jour de `docs/PROMPTS.md`, `docs/TECH.md` et `docs/guide/04-ia-et-generation.md`.
