# FONCTIONNALITÉS UI — POC CREAFLOW

Ce document liste, écran par écran, **ce que chaque vue doit permettre de faire** — pas comment l'agencer. Aucune indication de placement, de layout ou de composant visuel n'est donnée volontairement : c'est le rôle de la conception d'interface (Claude Design) à partir de ce document.

Périmètre : Modules A (Onboarding), B (Scripts), D (Calendrier). Le Module C (Matrice de recyclage) est hors scope POC.

---

## 1. Inscription / Connexion

**Objectif :** permettre à un créateur de créer un compte ou de se reconnecter.

**Fonctionnalités :**
- Créer un compte avec email + mot de passe (mot de passe : 8 caractères minimum).
- Se connecter avec un compte existant.
- Se déconnecter.
- Être automatiquement redirigé vers l'écran adapté selon l'état du compte : profil non configuré → onboarding ; profil déjà configuré → calendrier.

**États à prévoir :** erreur si email déjà utilisé (inscription), erreur si identifiants incorrects (connexion), état de chargement pendant la requête.

**Endpoints :** `POST /api/auth/signup`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`.

---

## 2. Onboarding — Identité de marque

**Objectif :** premier écran du parcours guidé, capture l'identité de la marque du créateur.

**Fonctionnalités :**
- Saisir le nom de la marque (obligatoire).
- Saisir le type d'activité (obligatoire — ex: bijoux, décoration, textile personnalisé).
- Décrire les valeurs de la marque (texte libre, optionnel).
- Choisir/décrire un ton (ex: humoristique, éducatif, esthétique/ASMR, institutionnel — champ texte libre, pas une liste fermée imposée).
- Enregistrer et passer à l'étape suivante (catalogue produits).
- Revenir modifier cette étape plus tard depuis les paramètres (le formulaire doit pouvoir se pré-remplir avec les données existantes).

**Endpoint :** `GET /api/profile` (pré-remplissage), `POST /api/profile` (création/mise à jour).

---

## 3. Onboarding — Contraintes de production

**Objectif :** capturer les moyens de tournage réels du créateur, pour que les scripts générés restent réalisables.

**Fonctionnalités :**
- Sélectionner le matériel disponible parmi : smartphone, trépied, éclairage, micro (sélection multiple, extensible en texte libre si besoin).
- Indiquer le temps disponible par semaine pour filmer (texte libre, ex: "2h le week-end").
- Enregistrer (fait partie du même profil que l'étape 2 — peut être la même soumission ou une étape séparée du même formulaire).

**Endpoint :** `POST /api/profile` (mêmes champs que l'étape 2, `equipment` et `weeklyTimeAvailable`).

---

## 4. Onboarding — Catalogue produits

**Objectif :** ajouter les produits phares qui serviront de matière première aux scripts générés.

**Fonctionnalités :**
- Ajouter entre 1 et 5 produits (nom obligatoire ; description, proposition de valeur et photo/lien optionnels).
- Ajouter plusieurs produits en une fois (saisie répétée avant validation).
- Voir la liste des produits déjà ajoutés.
- Modifier un produit existant.
- Supprimer un produit existant.
- Un message clair si la limite de 5 produits est atteinte (le formulaire d'ajout doit se désactiver ou prévenir avant l'envoi).
- Cet écran est réutilisé tel quel après l'onboarding, comme écran de gestion du catalogue dans les paramètres.

**États à prévoir :** liste vide (premier passage), erreur si limite dépassée.

**Endpoints :** `GET /api/products`, `POST /api/products` (création, accepte un ou plusieurs produits), `PUT /api/products/:id`, `DELETE /api/products/:id`.

---

## 5. Onboarding — Inspiration & connexions réseaux sociaux

**Objectif :** connecter les comptes sociaux du créateur pour que l'IA analyse le style de communication déjà en place.

**Fonctionnalités :**
- Voir l'état de connexion des 3 plateformes (TikTok, Instagram, LinkedIn) : connecté / non connecté.
- Lancer la connexion d'une plateforme (redirection vers l'autorisation OAuth de la plateforme, puis retour automatique dans l'app).
- Voir une confirmation après un retour de connexion réussie.
- Voir un message d'erreur si la connexion échoue ou si la récupération des publications échoue (cas notamment attendu sur LinkedIn selon les autorisations accordées par la plateforme — l'échec de récupération des publications ne doit pas être présenté comme un échec total de la connexion, le compte reste connecté).
- Étape "sautable" : le créateur doit pouvoir continuer l'onboarding sans connecter de compte social (l'analyse de style n'est alors simplement pas disponible tant qu'aucun compte n'est connecté).
- Déclencher manuellement un nouveau calcul du style de communication (utile si le créateur a publié du nouveau contenu depuis la dernière connexion).
- Afficher, si disponible, un résumé lisible du style de communication détecté (ton, longueur de phrase, usage d'emojis, etc.) une fois l'analyse effectuée.

**États à prévoir :** aucune plateforme connectée, connexion en cours, connexion réussie, connexion/récupération échouée, analyse de style en cours, analyse indisponible (aucune légende récupérée).

**Endpoints :** `GET /api/connections`, `GET /api/auth/:platform/connect` (redirection), `POST /api/profile/style-analysis`, `GET /api/profile` (pour lire `styleProfile`).

---

## 6. Calendrier mensuel

**Objectif :** écran principal de l'application une fois l'onboarding terminé — donne au créateur une vue d'ensemble de son mois de publication et lui indique quoi tourner et quand.

**Fonctionnalités :**
- Définir/modifier l'objectif hebdomadaire de publication par plateforme (ex: 3 posts TikTok, 2 Reels Instagram par semaine).
- Générer automatiquement le calendrier du mois à partir des objectifs définis (remplissage des créneaux avec le mix 30% vente / 50% coulisses / 20% éducatif). Action possible une seule fois par mois tant que le calendrier n'est pas déjà généré.
- Naviguer d'un mois à l'autre.
- Voir, pour chaque créneau du mois : la date, la plateforme visée, la catégorie de contenu prévue (vente / coulisses / éducatif), et si un script a déjà été généré pour ce créneau (avec son titre et son statut) ou non.
- Depuis un créneau sans script : lancer la génération du script correspondant.
- Depuis un créneau avec script : accéder à la fiche script complète (écran 7).
- Voir en un coup d'œil la progression par rapport à l'objectif hebdomadaire par plateforme (ex: "2/3 posts TikTok programmés cette semaine").
- Accéder à la génération libre d'un script hors calendrier (écran 8), pour un usage spontané sans passer par un créneau.

**États à prévoir :** aucun objectif défini (calendrier vide, message invitant à définir des objectifs), calendrier déjà généré pour le mois (le bouton de génération doit refléter cet état), mois sans aucun créneau (avant génération), génération en cours (peut prendre plusieurs secondes, un créneau à la fois).

**Endpoints :** `GET /api/calendar?month=YYYY-MM`, `POST /api/calendar/generate`, `GET /api/posting-goals`, `POST /api/posting-goals`, `POST /api/scripts/generate`.

---

## 7. Fiche Script (détail)

**Objectif :** présenter une fiche de tournage complète, prête à être utilisée pendant le tournage.

**Fonctionnalités :**
- Afficher le titre du concept.
- Afficher l'accroche (hook) sous ses trois composantes distinctes : visuel des 3 premières secondes, texte affiché à l'écran, audio/voix-off.
- Afficher le storyboard sous forme de plans numérotés, chacun avec sa description.
- Afficher la légende rédigée.
- Afficher la liste des hashtags recommandés.
- Afficher la recommandation de son/musique/tendance.
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
- Choisir la plateforme cible (TikTok / Instagram / LinkedIn).
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
