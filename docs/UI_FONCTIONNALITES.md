# FONCTIONNALITÉS UI — POC CREAFLOW

Ce document liste, écran par écran, **ce que chaque vue doit permettre de faire** — pas comment l'agencer. Aucune indication de placement, de layout ou de composant visuel n'est donnée volontairement : c'est le rôle de la conception d'interface (Claude Design) à partir de ce document.

Périmètre : Modules A (Onboarding), B (Scripts), D (Calendrier). Le Module C (Matrice de recyclage) est hors scope POC, puis abandonné avec la vidéo.

> Mise à jour du 2026-10-16 (`docs/SPEC_ONBOARDING_MVP.md` §6) : la vidéo est sortie du produit. Plus de script vidéo, plus de TikTok ni de YouTube ; un script est un post visuel (image, carrousel, animation exportée en MP4) ou un post texte.

> Mise à jour du 2026-10-16 (`docs/SPEC_ONBOARDING_MVP.md`) : l'onboarding est refait. Un seul parcours en six écrans, plus de chat ; ni ton, ni valeurs, ni matériel, ni temps disponible ne sont plus demandés. Les écrans 1 à 3 ci-dessous décrivent la connexion et le nouveau parcours ; les sujets (écran 4) et les connexions sociales (écran 5) ne sont plus des étapes de l'onboarding.

---

## 1. Connexion

**Objectif :** permettre à un créateur de revenir dans son compte. L'inscription n'est plus ici : elle est le premier écran de l'onboarding (écran 2).

**Fonctionnalités :**
- Se connecter avec email + mot de passe, ou avec GitHub, Notion ou Linear (seuls les fournisseurs configurés apparaissent).
- Demander un lien de réinitialisation du mot de passe.
- Se déconnecter.
- Un lien « Démarrer gratuitement » vers l'onboarding ; `/login?mode=signup` y redirige.
- Être automatiquement redirigé vers l'écran adapté selon l'état du compte : profil non configuré → onboarding ; profil déjà configuré → calendrier.

**États à prévoir :** erreur si identifiants incorrects, erreur OAuth renvoyée par le retour de connexion (`?oauthError=`), état de chargement pendant la requête.

**Endpoints :** `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/password/forgot`, `GET /api/auth/oauth/providers`.

---

## 2. Onboarding — Démarrer, brancher sa matière, lecture (écrans 1 à 3)

**Objectif :** créer le compte en branchant de la matière, puis laisser la machine la lire. Tout ce qui est demandé est une chose à faire, pas une question à laquelle la machine pourrait répondre seule.

**Fonctionnalités :**
- **Écran 1, Démarrer** (sans compte, cible de « Démarrer gratuitement ») : saisir son nom, puis choisir une des quatre portes, **GitHub · Notion · Linear · Coller mes notes**. Les trois premières créent (ou retrouvent) le compte par OAuth ; le nom saisi traverse la redirection (champ vide : pré-rempli avec le nom du compte tiers). « Coller mes notes » demande email + mot de passe sur le même écran et crée le compte. Lien discret « Déjà un compte ? Se connecter ».
- **Écran 2, Ce qu'on lit** : pour chaque porte branchée, choisir les dépôts, pages ou projets à lire (les plus récents déjà cochés) ; pour les notes, une grande zone de texte. Les portes non branchées restent proposées : brancher GitHub, Notion et Linear sur le même compte, **quel que soit l'email de chaque compte tiers** (c'est la session ouverte qui décide du compte). Jusqu'à 15 sources pendant l'onboarding.
- **Écran 3, Lecture** : une animation pendant la lecture de la matière et l'extraction du profil (un seul appel IA).

**États à prévoir :** fournisseur OAuth non configuré (la porte n'apparaît pas — « Coller mes notes » reste toujours disponible), compte tiers déjà utilisé par un autre compte CreaFlow (message clair au retour), limite de sources atteinte, aucune source ni note (impossible de continuer), échec de l'extraction (on continue avec des champs vides, jamais bloquant).

**Endpoints :** `GET /api/onboarding/state` (ouverte sans session), `GET /api/auth/oauth/:provider/start?returnTo=` (et `/api/auth/github/start`), `POST /api/auth/signup` (porte notes uniquement), `POST /api/onboarding/notes`, `GET /api/github/repos`, `GET|POST /api/connectors/:provider/candidates`, `POST /api/onboarding/draft`.

---

## 3. Onboarding — Ce que tu fais, attentes, jours (écrans 4 à 6)

**Objectif :** corriger ce que la machine a compris, dire ce qu'on attend du service, choisir son rythme.

**Fonctionnalités :**
- **Écran 4, Ce que tu fais** : corriger « Ce que tu fais » et « Pour qui » (audience visée) ; voir **tes sujets** avec leurs sources regroupées (ex. « CreaFlow — GitHub akralan/creaflow · Notion Journal de bord · Linear Lancement v2 »), les renommer, détacher une source vers un autre sujet ou en faire un sujet à part (5 sujets au plus).
- **Écran 5, Qu'est-ce que tu attends de nous ?** : une zone de texte libre avec un exemple en placeholder. Facultative mais mise en avant.
- **Écran 6, Tes jours de publication** : cocher les jours (mercredi et samedi par défaut, impossible de décocher le dernier) et les réseaux où publier (LinkedIn coché par défaut, X, Instagram — au moins un). « C'est parti » génère rôles, angles et séries puis mène au calendrier. Plus d'écran de sélection des séries.

**États à prévoir :** génération finale en cours (plusieurs secondes), échec de la génération (on peut relancer sans rien perdre), plus de 5 sujets (inviter à regrouper).

**Endpoint :** `POST /api/onboarding/complete`.

---

## 4. Sujets (ex-catalogue produits) — Paramètres

**Objectif :** gérer les sujets qui servent de matière première aux scripts générés. Ce n'est plus une étape de l'onboarding : les sujets y naissent du regroupement des sources (§3, écran 4 du parcours) ; cet écran vit dans les paramètres.

**Fonctionnalités :**
- Ajouter entre 1 et 5 sujets (nom obligatoire ; description, proposition de valeur et photo/lien optionnels), y compris depuis une source connectée (« Ajouter depuis … » par fournisseur connecté).
- Voir la liste des sujets déjà ajoutés.
- Modifier un sujet existant.
- Supprimer un sujet existant.
- Un message clair si la limite de 5 sujets est atteinte (le formulaire d'ajout doit se désactiver ou prévenir avant l'envoi).

**États à prévoir :** liste vide, erreur si limite dépassée.

**Endpoints :** `GET /api/products`, `POST /api/products` (création, accepte un ou plusieurs produits), `PUT /api/products/:id`, `DELETE /api/products/:id`.

---

## 5. Onboarding — Inspiration & connexions réseaux sociaux

**Objectif :** connecter les comptes sociaux du créateur pour que l'IA analyse le style de communication déjà en place. Depuis `docs/SPEC_ONBOARDING_MVP.md`, ce n'est plus une étape de l'onboarding : ces fonctionnalités vivent dans les paramètres (écran 9).

**Fonctionnalités :**
- Voir l'état de connexion des plateformes à OAuth (Instagram, LinkedIn, X) : connecté / non connecté.
- Lancer la connexion d'une plateforme (redirection vers l'autorisation OAuth de la plateforme, puis retour automatique dans l'app).
- Voir une confirmation après un retour de connexion réussie.
- Voir un message d'erreur si la connexion échoue ou si la récupération des publications échoue (cas notamment attendu sur LinkedIn selon les autorisations accordées par la plateforme — l'échec de récupération des publications ne doit pas être présenté comme un échec total de la connexion, le compte reste connecté).
- Facultatif : sans compte social connecté, l'analyse de style n'est simplement pas disponible (le style s'apprend aussi aux retouches des scripts).
- Déclencher manuellement un nouveau calcul du style de communication (utile si le créateur a publié du nouveau contenu depuis la dernière connexion).
- Afficher, si disponible, un résumé lisible du style de communication détecté (ton, longueur de phrase, usage d'emojis, etc.) une fois l'analyse effectuée.

**États à prévoir :** aucune plateforme connectée, connexion en cours, connexion réussie, connexion/récupération échouée, analyse de style en cours, analyse indisponible (aucune légende récupérée).

**Endpoints :** `GET /api/connections`, `GET /api/auth/:platform/connect` (redirection), `POST /api/profile/style-analysis`, `GET /api/profile` (pour lire `styleProfile`).

---

## 6. Calendrier mensuel

**Objectif :** écran principal de l'application une fois l'onboarding terminé — donne au créateur une vue d'ensemble de son mois de publication et lui indique quoi publier et quand.

**Fonctionnalités :**
- Activer ou couper une plateforme (« Un post par jour de publication, sur chaque plateforme active ») ; le nombre de posts par semaine ne se règle plus, il découle des jours cochés (écran 10).
- Générer automatiquement le calendrier du mois : un créneau par jour coché et par plateforme active, aux dates exactes de ces jours (remplissage des créneaux avec le mix 30% vente / 50% coulisses / 20% éducatif). Action possible une seule fois par mois tant que le calendrier n'est pas déjà généré.
- Naviguer d'un mois à l'autre.
- Voir, pour chaque créneau du mois : la date, la plateforme visée, la catégorie de contenu prévue (vente / coulisses / éducatif), et si un script a déjà été généré pour ce créneau (avec son titre et son statut) ou non.
- Depuis un créneau sans script : lancer la génération du script correspondant.
- Depuis un créneau avec script : accéder à la fiche script complète (écran 7).
- Accéder à la génération libre d'un script hors calendrier (écran 8), pour un usage spontané sans passer par un créneau.

**États à prévoir :** aucune plateforme active (calendrier vide, invitation à en activer une), calendrier déjà généré pour le mois (le bouton de génération doit refléter cet état), mois sans aucun créneau (avant génération), génération en cours (peut prendre plusieurs secondes, un créneau à la fois).

**Endpoints :** `GET /api/calendar?month=YYYY-MM`, `POST /api/calendar/generate`, `GET /api/posting-goals`, `POST /api/posting-goals`, `POST /api/scripts/generate`.

---

## 7. Fiche Script (détail)

**Objectif :** présenter une fiche de post complète, prête à être publiée.

**Fonctionnalités :**
- Afficher le titre du concept.
- Afficher l'accroche (hook) : accroche visuelle et texte affiché pour un post visuel, première phrase pour un post texte.
- Pour un post visuel, afficher le découpage en slides numérotées, chacune avec sa description.
- Afficher la légende rédigée.
- Afficher la liste des hashtags recommandés.
- Afficher le produit associé au script, si applicable (ou indiquer explicitement qu'aucun produit n'est associé).
- Afficher la plateforme et la catégorie de contenu (vente/coulisses/éducatif) du script.
- Régénérer le script (remplace le contenu généré en conservant la plateforme, la catégorie et le produit associé).
- Changer le statut du script (brouillon / planifié / tourné / publié), pour que le créateur puisse suivre où il en est dans sa production.
- Revenir au créneau du calendrier d'origine si le script y est rattaché.

**États à prévoir :** génération en cours (le premier appel à la génération peut prendre plusieurs secondes), régénération en cours, échec de génération (ex: clé API manquante ou service indisponible — message clair, pas un blocage silencieux).

**Endpoints :** `GET /api/scripts/:id`, `POST /api/scripts/:id/regenerate`.

---

## 8. Génération libre de script

**Objectif :** permettre de générer un script à la demande, sans passer par un créneau de calendrier existant (flux secondaire, cf. `SPEC_POC.md` section 3).

**Fonctionnalités :**
- Choisir la plateforme cible (Instagram / LinkedIn / X / newsletter, blog…).
- Choisir la catégorie de contenu visée (vente / coulisses / éducatif).
- Choisir un produit du catalogue à associer (optionnel — un script peut être générique).
- Lancer la génération, qui aboutit sur la fiche script complète (écran 7).
- Depuis la fiche obtenue, pouvoir l'associer a posteriori à un créneau du calendrier existant qui n'a pas encore de script.

**Endpoint :** `POST /api/scripts`.

---

## 9. Paramètres — Connexions sociales

**Objectif :** gérer les connexions aux comptes sociaux en dehors du parcours d'onboarding initial.

**Fonctionnalités :** identiques à celles décrites dans l'écran 5 (état des connexions, connecter/reconnecter, déclencher une analyse de style), accessibles à tout moment après l'onboarding plutôt qu'une seule fois au début.

**Endpoints :** identiques à l'écran 5.

---

## 10. Paramètres — Profil, attentes et jours de publication

**Objectif :** revenir sur ce qui a été dit à l'onboarding.

**Fonctionnalités :**
- Modifier ton nom, ce que tu fais, l'audience visée.
- Modifier « Ce que tu attends de CreaFlow » (texte libre).
- Cocher ou décocher les jours de publication (les 7 jours, au moins un) ; les plateformes actives suivent le nouveau rythme dès la prochaine génération du calendrier.
- L'assistant peut aussi proposer de changer les jours ou d'activer/couper une plateforme (proposition à valider).

**Endpoints :** `GET /api/profile`, `POST /api/profile` (`expectations`, `publishingDays`).
