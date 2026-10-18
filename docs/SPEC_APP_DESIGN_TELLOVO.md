# SPEC — L'APPLICATION AU DESIGN TELLOVO (semaine, deux réseaux, quota en semaines)

> **Statut : validée et implémentée le 2026-10-18 sur `feature/app-design-tellovo` (lots 0 à 7), migration `0048` en dev seulement, essayée en réel (un post → deux scripts, deux textes, même événement ; semaine suivante refusée par le quota → modale) ; écarts en §9.** Décisions prises à deux (Alix et Claude). Le journal de la section 1 garde chaque décision avec sa raison, parce que CreaFlow sert à parler de CreaFlow.
>
> **Objectif.** Reprendre le design de l'application du prototype de tellovo.ai (`/app`, `/app/plan`, `/app/context`, modale de paiement) et le brancher sur les fonctions réelles de CreaFlow. Trois changements de fond l'accompagnent : **deux réseaux seulement** (LinkedIn et X, un script par réseau pour un même créneau), **un quota compté en semaines** (et non plus en scripts), et **une page unique « Your content week »** qui remplace le calendrier et la page de détail d'un post.
>
> **Source** : le prototype de tellovo.ai à données fictives (RelayKit). Captures et comparaison fonction par fonction faites le 2026-10-18 ; le détail est dans la conversation, les écrans de référence sont dans le dossier temporaire de la session (`tv/04-app.png`, `20-plan.png`, `21-context.png`, `23-upgrade.png`).

---

## 1. Décisions (journal)

| # | Décision | Pourquoi | Écarté |
| :--- | :--- | :--- | :--- |
| E1 | **Seuls LinkedIn et X existent dans l'application.** Instagram, newsletter, blog, Slack et « autre » disparaissent des réglages, des sélecteurs, des connexions et du calendrier. | Le produit parle à des fondateurs qui publient sur ces deux réseaux ; chaque réseau en plus est un coût de génération et d'écrans. | Les garder « au cas où ». |
| E2 | **Chaque post est écrit pour les deux réseaux, avec deux textes différents** : un script LinkedIn, un script X, **rattachés au même créneau** (même série, même jour). | Le même texte collé sur deux réseaux est une mauvaise publication sur les deux ; chacun a ses règles (`platformRules.ts`). Un script par réseau garde le modèle actuel (un script = un réseau) et toutes les routes qui vont avec. | Un seul script avec une variante X ; un seul texte pour deux réseaux. |
| E3 | **Les maquettes visuelles sont communes aux deux réseaux** : la même image (ou carrousel, ou animation) illustre les deux textes. On ne refait pas d'image par réseau. | Seul le texte diffère entre réseaux ; une seconde composition coûte un appel de plus pour rien. | Une maquette par réseau. |
| E4 | **Le menu est celui de Tellovo** : *This week*, *Content plan*, *Business context*, puis **Performance** juste en dessous de *Business context*. **Direction** et **Settings** passent dans le menu qui s'ouvre au clic sur le compte (« You »). | Trois entrées claires pour le geste de chaque semaine ; Direction et Settings se règlent rarement. | Garder les cinq entrées. |
| E5 | **L'assistant est caché, pas supprimé.** Plus d'entrée de menu ; le code, les routes et l'écran restent. | Il reviendra probablement ; le retirer puis le réécrire coûterait plus cher que de le masquer. | Le supprimer. |
| E6 | **« Website » est écarté** (pas de source « site web »). | N'existe pas côté code ; pas demandé. | Le construire. |
| E7 | **« Your voice » (quatre puces) est retiré.** L'apprentissage du style (règles tirées de tes retouches, proposées à validation) reste dans Settings. | Les quatre puces n'existent plus depuis le retrait du cadrage de série ; l'apprentissage du style est l'équivalent réel de ce que Tellovo promet. | Recréer des puces de ton. |
| E8 | **Un seul écran pour lire et retoucher un post** : « Your content week », cartes de la semaine à gauche, post agrandi à droite. La page `/scripts/[id]` disparaît pour l'utilisateur. | C'est la mise en page de Tellovo ; deux pages (liste puis détail) ralentissent le geste. | Garder `/scripts/[id]` pour les visuels. |
| E9 | **Une image s'affiche dans le post, entre « You · Founder » et le texte.** À droite de l'image, une **bande d'outils** ; un bouton l'ouvre en bulle avec tous les outils de retouche. | L'image fait partie du post tel qu'il sera publié ; les outils ne doivent pas encombrer le texte. | Les outils dans une page à part. |
| E10 | **Le quota compte des semaines, pas des scripts.** L'essai gratuit offre **une semaine** (à vie). Une semaine « consommée » est une semaine du calendrier pour laquelle des posts ont été écrits. | Ce qu'on offre au fondateur est une semaine de contenu, pas un nombre de scripts ; avec deux réseaux par post, compter les scripts doublerait la facture sans rien dire à l'utilisateur. | Compter des posts ; compter des scripts × 2. |
| E11 | **« Prepare next week » est un vrai bouton** : il écrit les posts de la semaine suivante (les créneaux de la semaine, deux réseaux chacun). Il consomme une semaine de quota. | C'est l'action qui fait revenir chaque semaine ; elle est déjà décrite par la landing. | Une semaine préparée automatiquement. |
| E12 | **La modale de paiement existe mais n'est branchée sur rien** : le bouton « Unlock weekly plans » ne fait rien pour l'instant. | Stripe n'est pas branché sur ce plan ; on veut voir le design et le moment où elle s'ouvre. | La brancher sur Stripe maintenant. |
| E13 | **Les deux versions d'un post se voient par onglets LinkedIn / X** dans le post agrandi. | Même geste que Tellovo ; l'un et l'autre sont éditables et prêts à copier. | Deux cartes par jour. |
| E14 | **Trois statuts seulement : Draft, Ready, Posted.** Draft et Ready sont affichés et se basculent à la main (« Mark as ready »). **Posted n'est jamais posé à la main** : il sera posé par le back-end quand la détection des publications (Performance) sera remise à jour. | Le fondateur n'a pas à dire « tourné » ni « planifié » ; Posted est un fait observé, pas une déclaration. | Quatre statuts ; Posted à la main. |
| E15 | **Sur téléphone, l'écran est ultra simple** : en haut les jours de la semaine (les trois jours, en pastilles), dessous le script seul, plein écran ; les phrases d'action deviennent des boutons-icônes pour gagner de la place. | Le script doit se voir tout de suite, sans défiler. | Une liste de cartes puis un détail. |
| E16 | **Le visuel se choisit post par post, depuis la bulle d'outils** : Image, Carrousel (5 slides par défaut, 2 à 10) ou Animation (8 s par défaut, 5 à 15 s), ou « Retirer le visuel ». Le **texte ne change pas** ; le visuel est **commun aux deux réseaux** (la maquette s'accroche au script LinkedIn, la version X la lit). Il est fabriqué à partir du texte du post (storyboard tiré du texte, un appel au modèle) puis composé avec les photos de la bibliothèque, comme un post visuel ordinaire. **Il compte comme une micro-retouche** (`design_instruction`), jamais comme une semaine. Pas de réglage « cette série a toujours une image » pour l'instant. | Le fondateur décide au cas par cas ; garder le texte évite de réécrire un post déjà relu ; une maquette par réseau coûterait un appel de plus pour rien (E3). | Choisir à la série ; réécrire le post en visuel ; une maquette par réseau. |

---

## 2. Ce que le prototype montre, et ce que CreaFlow en fait

| Écran du prototype | Ce qui est repris | Source des données |
| :--- | :--- | :--- |
| **This week** (`/app`) | Bandeau « You're in » (fermable, affiché après le lien de connexion), titre « Your content week », bouton « Prepare next week », colonne de cartes-jours, carte pointillée « Next week » verrouillée, post agrandi. | `listCalendarRange` (déjà : titre, accroche, extrait, statut `generating`). |
| **Content plan** (`/app/plan`) | Quatre semaines en lignes, jours remplis ou hachurés, « Prepare next week » sur la semaine suivante. | Mêmes créneaux, sur 28 jours (`syncSeriesSlots`). |
| **Business context** (`/app/context`) | Fiche à trois champs (« Edit details »), barre « Getting started » (sources connectées), liste des sources. | `products` (dont `problem`), `material_sources`, connecteurs GitHub / Notion / Linear / notes collées. Sans « Website » (E6). |
| **Modale de paiement** | Modale « Your next week is waiting », plan « Tellovo Founder », 19 € / mois, cinq avantages, bouton et « Maybe later ». | Texte et prix du prototype, **sans action** (E12). |
| **Post agrandi** | Onglets réseau, texte, bloc « Edit with Tellovo AI » (trois puces et champ libre), Edit / Copy / Source / « Mark as ready ». | `scripts`, route d'instruction, sources du script. |

---

## 3. Les deux réseaux (E1, E2, E3)

**Données.** `KNOWN_PLATFORMS` ne garde que `linkedin` et `x`. Les créneaux restent une ligne par réseau (`calendar_entries.platform`) : un jour de série a donc **deux créneaux, un par réseau**, que l'écran groupe par `(série, date)`. Aucune colonne nouvelle n'est nécessaire pour le rattachement ; la clé est celle que `syncSeriesSlots` utilise déjà (`YYYY-MM-DD|réseau`).

**Génération.** Écrire un post écrit **les deux scripts** : LinkedIn d'abord (celui du mail), puis X avec ses règles. Le second réutilise le même événement, la même forme de série et, pour un visuel, **la même maquette** (E3). Si l'un des deux échoue, l'autre reste et le créneau en échec se relance seul.

**Impact sur ce qui existe.**
- `POSTING_GOALS`, `PlatformGoalsModal`, `SeriesEditModal`, `ImportScriptForm`, `StyleAnalysisPanel`, `inspirationService`, `assistantChat` : retirer les autres réseaux des listes.
- Connexions sociales (`/settings`, `ConnectionRow`) : Instagram retiré ; LinkedIn et X restent.
- Données existantes sur d'autres réseaux : laissées en base, plus affichées (aucune suppression de données en dev ni en prod).
- Le flux `/start` : le premier post du mail est la **version LinkedIn** ; au clic sur le lien, les deux autres posts de la semaine se génèrent **pour les deux réseaux**. (Cela annule D15 de `docs/SPEC_ENTREE_PAR_LE_REPO.md`, qui ne générait que LinkedIn.)

---

## 4. Le quota en semaines (E10, E11, E12)

- **Essai gratuit : une semaine, à vie**, pour tout compte sans abonnement.
- Une semaine est **consommée à la première génération** d'un post de cette semaine ; les posts suivants de la même semaine, et leurs retouches par lien, ne comptent plus.
- « Prepare next week » vérifie le quota **avant** de lancer : s'il est atteint, il ouvre la modale de paiement (E12) au lieu d'écrire.
- Les plans payants (Stripe) gardent leur logique actuelle tant qu'ils ne sont pas branchés sur le plan « Founder » ; leur conversion en semaines se décidera avec le branchement (**hors périmètre**).
- Les retouches (instruction sur une sélection, régénération d'un bloc) restent comptées à part, comme aujourd'hui (`microEditsPerMonth`).
- L'écran `/admin/quotas` suit : « semaines » à la place de « scripts ».
- La carte « Free plan » de la barre latérale affiche « Your first week is on us. 1 of 1 free week used. » et « Upgrade » (ouvre la modale).

---

## 5. L'écran « Your content week » (E8, E9, E13)

**Mise en page.** Reprise du prototype : à gauche, les cartes des posts de la semaine (date, statut, titre, début du texte) et la carte pointillée de la semaine suivante ; à droite, le post agrandi.

**Le post agrandi**, de haut en bas :
1. En-tête : jour, rôle, onglets **LinkedIn / X**.
2. Titre, auteur (« You · Founder · nom du produit »).
3. **L'image, si le post en a une**, entre l'auteur et le texte ; une bande d'outils à sa droite.
4. Le texte (éditable en place), avec le compteur de caractères pour X.
5. Bloc **Edit with Tellovo AI** : trois puces (« Make it shorter », « Stronger hook », « More technical ») et un champ libre « Ask for a change… », avec « Undo ». Ces instructions s'appliquent au texte entier, par la même route que l'instruction sur une sélection.
6. Barre basse : **Edit**, **Copy**, **Source** (passages de la matière et « Why this angle »), **Mark as ready**.

**La bulle d'outils.** Un bouton ouvre une bulle qui rassemble les outils que la page de détail porte aujourd'hui : régénérer un bloc, nouvelle idée, supprimer, statut, importer, métriques d'un post publié, et pour un visuel l'éditeur de maquette (formats, slides, animation). Le détail du contenu de la bulle se fixe en lot 3.

**Statuts (E14).** Le modèle garde son énumération (aucune migration) : `draft` = **Draft**, `planned` = **Ready**, `published` = **Posted** ; `shot` (hérité de la vidéo, retirée) est lu comme Ready. Seuls Draft et Ready se basculent à l'écran ; Posted n'est écrit que par le back-end. L'apprentissage du style compte désormais les scripts **Ready** et Posted comme versions finales (avant : tournés ou publiés).

**Téléphone (E15).** Jours en pastilles tout en haut, script seul dessous, outils et actions en boutons-icônes (Edit, Copy, Source, instruction IA, bulle d'outils), onglets LinkedIn / X compacts.

---

## 6. Le menu (E4, E5)

- Barre latérale : logo, carte du produit (nom + repo), **This week** (compteur « n/3 »), **Content plan**, **Business context**, **Performance**, carte « Free plan » + « Upgrade », compte.
- Clic sur le compte : **Direction**, **Settings**, déconnexion.
- `/assistant` reste servi mais n'apparaît plus ; la route n'est pas supprimée.
- `/calendar`, `/direction`, `/settings`, `/performance` gardent leurs adresses ; `/calendar` devient l'écran « This week » (les liens existants, y compris celui du mail, continuent de marcher).

---

## 7. Découpage

| Lot | Contenu | Se vérifie par |
| :--- | :--- | :--- |
| 0 | Réseaux : retrait de tout sauf LinkedIn et X (E1), tests de validation mis à jour. | Tests, lint, écrans des réglages. |
| 1 | Génération pour les deux réseaux, même créneau (E2, E3) ; `/start` en deux réseaux ; relance d'un des deux en échec. | Essai réel : un post → deux scripts, deux textes. |
| 2 | Quota en semaines (E10) ; modale de paiement visuelle (E12). | Tests du quota ; essai : seconde semaine bloquée. |
| 3 | Écran « Your content week » : cartes, post agrandi, onglets, image dans le post, bulle d'outils (E8, E9, E13). | Captures desktop et mobile comparées au prototype. |
| 4 | Menu, compte, Direction et Settings dans le compte, assistant caché (E4, E5). | Captures. |
| 5 | « Content plan » et « Business context » (4 semaines, fiche à trois champs, sources) ; « Prepare next week » (E11). | Essai réel de la semaine suivante. |
| 6 | Docs (`CLAUDE.md`, `TECH.md`), `URGENT.md` inchangé. | Relecture. |
| 7 | Le visuel d'un post depuis la bulle d'outils (E16) : storyboard tiré du texte, composition, affichage sur les deux réseaux, retrait. | Essai réel : image, carrousel, animation ; retrait ; quota de micro-retouches. |

---

## 9. Écarts à l'implémentation et limites connues

- **Maquettes visuelles dans la paire** : la génération d'un post écrit deux scripts de **texte** ; le visuel s'ajoute ensuite, post par post, depuis la bulle d'outils (E16, lot 7). Un post visuel créé à la main depuis `/scripts/new` s'affiche aussi dans le volet.
- **Les objectifs de publication n'éteignent plus un réseau** : les créneaux sont créés pour LinkedIn et X quels que soient `posting_goals` ; la fenêtre « objectif hebdomadaire » du calendrier est supprimée avec l'ancien calendrier.
- **Quota** : l'essai compte des semaines (`consumed_weeks`, `users.week_limit` pour un quota personnalisé) ; les comptes abonnés gardent le compte en scripts. La semaine est gravée à la demande d'écriture, avant l'appel au modèle : un échec du modèle ne la rend pas.
- **Pages anciennes** : Direction, Settings, Performance et Assistant gardent leur contenu d'avant, dans la nouvelle coque ; leur restyle n'est pas dans ce chantier. L'assistant n'a plus d'entrée de menu (la route reste).
- **`/scripts/[id]`** redirige vers `/calendar?week=…&post=…` quand le script a un créneau ; il ne sert plus qu'aux scripts sans créneau (importés, libres).
- **Statuts** : `Posted` n'est posé par aucun écran ; l'écriture viendra avec la détection des publications.
- **Semaine affichée** : du lundi au dimanche (un rythme peut tomber le week-end), là où le prototype montre cinq jours.
- **Visuel d'un post (E16)** : essayé en réel (carrousel de 5 slides composé depuis le texte, affiché sur les deux onglets, retiré) ; la composition se fait avant la réponse (une trentaine de secondes, la bulle l'indique). Changer de format supprime la maquette d'avant. Sans photo dans la bibliothèque, la maquette est composée sans photo. « Another idea » sur le script qui porte le visuel réécrit le texte sans refaire la maquette.
- **Le premier post du mail est la version LinkedIn** ; la version X s'écrit juste après le départ du mail.

## 8. Hors périmètre / à décider plus tard

- Branchement de la modale de paiement sur Stripe et conversion des plans payants en semaines.
- « Website » comme source ; « Your voice » à puces.
- Retour de l'assistant dans le menu.
- Suppression physique des données des anciens réseaux.
