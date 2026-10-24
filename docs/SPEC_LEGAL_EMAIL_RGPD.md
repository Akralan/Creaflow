# Pages légales, emails transactionnels, suppression de compte — ce qu'il manque pour encaisser

> **2026-10-25 — le mot de passe est retiré** (`docs/SPEC_CONNEXION_PAR_LIEN.md`) : connexion par lien email seulement. Tout ce que cette spec dit du mot de passe oublié, de sa réinitialisation, de son changement et de la confirmation de suppression par mot de passe est historique ; la suppression se confirme en recopiant l'adresse.

Statut : **cadrage validé et implémenté le 2026-10-16** (Lots 0-5). Branche
`feature/legal-email-rgpd`, partie de `main` après le merge de la landing, dans un worktree séparé.
Migration `0035` (renumérotée après le merge de `main`, où la composition visuelle occupe 0033-0034) appliquée en base de dev ; parcours complet (reset avec rejeu refusé, fermeture des
anciennes sessions, changement de mot de passe, export, suppression) vérifié en local en mode
console. Reste la validation dans le navigateur et, pour l'envoi réel, `docs/SETUP_EMAILS_BREVO.md`.

Trois trous constatés sur `main` empêchent d'ouvrir les inscriptions payantes : les pages légales
sont des brouillons à crochets, l'app n'envoie aucun email (donc pas de « mot de passe oublié »),
et un utilisateur ne peut ni supprimer son compte ni récupérer ses données. Ce document dit ce
que chacun veut dire dans le produit, ce qu'on tranche, et ce qu'on laisse de côté.

| Chantier | Ce qui existe | Ce qu'on livre |
|---|---|---|
| Pages légales | 3 pages (`/legal/*`) avec des `[crochets]` et une bannière « Brouillon » | identité de l'éditeur en un seul endroit, CGU complétées d'un volet vente, confidentialité alignée sur les vrais sous-traitants |
| Emails | rien, aucun provider | une brique `src/lib/email/` (Brevo ou console), 3 emails : lien de réinitialisation, mot de passe modifié, compte supprimé |
| Compte & RGPD | rien ; la confidentialité promet un traitement « manuel » | onglet **Compte** dans `/settings` : changer de mot de passe, exporter ses données, supprimer son compte |

## 1. Ce que ça veut dire dans le produit

Le produit n'a aujourd'hui **aucune notion de « compte »** visible : `/settings` parle d'identité
de marque, de connexions, de catalogue et de facturation. L'utilisateur, lui, n'a nulle part où
voir son email, changer son mot de passe ou partir. C'est la question de fond : il faut un endroit
qui parle de **la personne**, pas de sa marque. D'où l'onglet **Compte**, et non trois boutons
dispersés.

Deuxième point de modèle : l'app a deux sortes de comptes. Ceux créés par email + mot de passe, et
ceux créés par GitHub, Notion ou Linear, **sans mot de passe** (`users.passwordHash` nullable).
Tout ce qui demande « votre mot de passe pour confirmer » doit avoir un chemin pour les seconds.

## 2. Pages légales

### 2.1 L'identité de l'éditeur en un seul endroit

Nouveau module `src/lib/legal/publisher.ts` : un objet avec le nom de l'éditeur, le statut
juridique, l'adresse, le SIRET, l'email de contact, le directeur de la publication, l'hébergeur de
l'application et celui de la base. Les trois pages et le footer de la landing le lisent. Ce ne sont
pas des secrets : ils vivent dans le code, pas dans `.env`.

**Décision (2026-10-16)** : les valeurs restent des placeholders pour l'instant, l'entité n'étant
pas encore arrêtée. `isPublisherComplete()` dit si tous les champs obligatoires sont remplis. Tant
que ce n'est pas le cas, la bannière « Brouillon » **reste affichée automatiquement** ; dès que
c'est rempli, elle disparaît sans qu'on ait à y penser. Un test Vitest vérifie que la logique de
complétude fait bien la différence entre un placeholder et une vraie valeur.

L'hébergeur peut rester vide un peu plus longtemps que les autres (l'infra n'est pas choisie) : il
est traité comme « à préciser » sans bloquer le reste, mais `isPublisherComplete()` le compte.

### 2.2 CGU : ajouter le volet vente

Les CGU existantes couvrent l'usage. Il manque ce qu'un abonnement payant exige en France. On
n'écrit pas un second document « CGV » : les CGU deviennent « Conditions Générales d'Utilisation
et de Vente », ce qui reste un seul lien, une seule case à cocher à l'inscription.

Sections ajoutées ou réécrites :

- **Objet** : mis à jour avec le produit réel (matière écrite, sujets connectés, assistant, post
  visuel). La phrase « CreaFlow ne publie rien à votre place » reste, elle est vraie.
- **Offres et prix** : essai gratuit sans carte (5 scripts, 30 micro-retouches, à vie), puis
  Starter et Pro, prix affichés sur la page de tarifs en euros TTC, TVA selon la situation du
  client, facturation mensuelle par Stripe, renouvellement tacite chaque mois.
- **Résiliation** : à tout moment depuis le portail Stripe, effet à la fin de la période payée,
  pas de prorata. Suppression du compte possible séparément (renvoi vers la confidentialité).
- **Droit de rétractation** : 14 jours pour un consommateur ; l'accès étant immédiat, l'utilisateur
  demande expressément l'exécution dès la souscription et reconnaît perdre ce droit une fois le
  service commencé (code de la consommation, art. L221-28 13°, contenu numérique sans support
  matériel). Un professionnel n'en bénéficie
  pas. Cette case est cochée **dans le texte**, pas par une nouvelle case à l'écran : le Checkout
  Stripe est déjà un acte positif.
- **Modification des prix** : préavis d'un mois par email, le client peut résilier avant.
- **Quotas** : ce qu'un dépassement provoque (refus de génération, pas de facturation à l'usage).
- **Suppression du compte** : effet immédiat sur les données de l'app, factures conservées par
  Stripe pour la durée légale.
- **Modification des CGU** : information par email, un mois avant, pour les changements qui
  comptent.

Les clauses de responsabilité et de droit applicable existantes restent, débarrassées de leurs
crochets. La bannière « à faire relire par un professionnel du droit » disparaît avec le reste de
la bannière brouillon ; la mention reste dans un commentaire du code, pour toi.

### 2.3 Confidentialité : coller au réel

Le tableau des sous-traitants dit « Google (Gemini), Anthropic, Groq ». Le vrai est : **OpenAI**
pour tout le texte, les embeddings et l'assistant ; **Google** pour la description des photos ;
**Photoroom** pour le détourage (arrivé avec `docs/SPEC_COMPOSITION_VISUELLE.md`, qui a retiré la
génération d'images). Anthropic et Groq ne tournent pas et sortent de la liste. On ajoute **Brevo**
(emails, société française, données en Union européenne), **Sentry** (erreurs : IP, navigateur,
identifiant interne, jamais le contenu des scripts), **GitHub, Notion, Linear** (identité et
matière, si connectés), et l'hébergeur depuis `publisher.ts`.

Autres mises à jour : les données collectées listent la matière écrite et les messages de
l'assistant ; la durée de conservation détaille ce qui part immédiatement à la suppression, ce
que Stripe garde, et le délai de purge des sauvegardes de l'hébergeur ; la note « suppression
manuelle » saute, remplacée par la description du libre-service ; une section « Emails » précise
qu'on n'envoie que des emails de service, jamais de prospection.

### 2.4 Mentions légales

Entièrement alimentées par `publisher.ts`. Plus aucun texte en dur à modifier.

## 3. Emails transactionnels

### 3.1 La brique

`src/lib/email/` sur le modèle de `src/lib/storage/` : une interface `sendEmail({ to, subject,
html, text })`, deux implémentations.

- **`brevo`** : `POST https://api.brevo.com/v3/smtp/email`, en-tête `api-key`, corps JSON
  `sender { name, email }`, `to [{ email }]`, `subject`, `htmlContent`, `textContent`, réponse
  `201 { messageId }`. Appel `fetch` direct, pas de SDK, comme Linear et Notion. Vérifié sur la
  doc Brevo le 2026-10-16. Offre gratuite : 300 emails par jour, transactionnel inclus. Largement
  assez pour des emails de service. Choisi plutôt que Resend parce que c'est le prestataire
  pressenti par le projet et qu'il héberge en Europe.
- **`console`** : écrit l'email complet dans les logs. C'est le mode dev : le lien de
  réinitialisation s'affiche dans le terminal.

Sélection par `EMAIL_PROVIDER=brevo|console`. Même philosophie que Stripe et GitHub : sans
`BREVO_API_KEY`, l'app démarre, en mode console — **sauf en production**, où une clé oubliée
ferait finir chaque lien de réinitialisation dans les logs : là, il faut une clé ou un
`EMAIL_PROVIDER=console` explicite, et le corps de l'email n'est alors pas logué. Variables : `BREVO_API_KEY`, `EMAIL_FROM`
(`CreaFlow <no-reply@domaine>`, domaine à vérifier chez Brevo une fois choisi), et `APP_URL` déjà
présent pour les liens. L'interface ne connaît pas Brevo : changer de prestataire demain coûte un
fichier.

Les emails sont en texte simple avec une version HTML minimale (un titre, un paragraphe, un
bouton). Pas de template externe, pas de tracking d'ouverture.

### 3.2 Les trois emails de ce chantier

| Email | Déclencheur | Contenu |
|---|---|---|
| Réinitialiser le mot de passe | « Mot de passe oublié » | lien valable 1 heure, usage unique |
| Mot de passe modifié | après un reset ou un changement depuis Compte | avertissement de sécurité, « si ce n'est pas vous, écrivez-nous » |
| Compte supprimé | après la suppression | confirmation, aucune donnée personnelle dedans |

### 3.3 Mot de passe oublié, en détail

1. Lien « Mot de passe oublié ? » sur `/login`, en mode connexion.
2. `POST /api/auth/password/forgot { email }` répond **toujours** « si un compte existe, un email
   part », pour ne pas révéler qui est inscrit. Limites : 5 par heure par IP, 3 par heure par email.
3. Jeton : 32 octets aléatoires, stocké **haché** (SHA-256) dans une nouvelle table
   `password_reset_tokens` (`user_id`, `token_hash`, `expires_at`, `used_at`). Une demande
   invalide les jetons précédents du même compte.
4. Page `/reinitialiser-mot-de-passe?token=…` : nouveau mot de passe, 8 caractères minimum.
5. `POST /api/auth/password/reset { token, password }` : vérifie, remplace le hash, marque le jeton
   utilisé, connecte l'utilisateur, envoie « mot de passe modifié ».

Un compte GitHub/Notion/Linear sans mot de passe **peut** passer par là : ça lui crée un mot de
passe et lui ouvre la connexion par email. L'adresse a déjà été vérifiée par le fournisseur
d'identité, c'est sûr. Le message du login « Ce compte se connecte avec GitHub » est reformulé pour
le dire. Ce message révèle qu'un compte tiers existe pour cette adresse : compromis assumé depuis
l'arrivée de GitHub (ne pas laisser l'utilisateur dans une impasse), borné par la limite par email.
Le `forgot`, lui, reste neutre : réponse identique et envoi non attendu, pour que ni le message ni
le temps de réponse ne disent qui est inscrit.

Le jeton est consommé par un `UPDATE … WHERE used_at IS NULL … RETURNING` : deux requêtes
simultanées avec le même lien ne peuvent pas gagner toutes les deux. Un échec après la consommation
n'est pas rattrapable, c'est voulu : on préfère un lien grillé à un lien réutilisable.

### 3.4 Fermer les sessions ouvertes après un reset

Aujourd'hui une session est un JWT de 7 jours, invérifiable côté serveur. Quelqu'un qui change son
mot de passe parce qu'il se croit piraté laisserait l'intrus connecté une semaine. On ajoute
`users.sessions_invalidated_before` : un reset ou un changement de mot de passe y écrit l'heure, et
`getCurrentUserId` refuse tout jeton émis avant. Coût : une lecture par clé primaire sur chaque
requête authentifiée. C'est le prix d'un reset qui sert à quelque chose ; on l'assume.

## 4. Compte, suppression et export

### 4.1 L'onglet Compte

Quatrième onglet de `/settings`, « Compte », avec quatre blocs :

- **Email** : affiché, non modifiable en v1.
- **Mot de passe** : changer (ancien + nouveau), ou « définir un mot de passe » pour un compte
  sans mot de passe. `POST /api/account/password`. Envoie « mot de passe modifié ».
- **Vos données** : bouton « Télécharger mes données » → `GET /api/account/export`.
- **Zone rouge** : « Supprimer mon compte », avec la liste de ce qui part et de ce qui reste.

### 4.2 Supprimer son compte

Confirmation par le mot de passe. Pour un compte sans mot de passe, l'utilisateur recopie son
adresse email. `DELETE /api/account { password | emailConfirmation }`, limite 3 par heure.

Ordre des opérations, dans `accountDeletionService.ts` :

1. **Stripe** : résiliation immédiate de l'abonnement s'il y en a un. Le client Stripe et ses
   factures sont **conservés** : obligation comptable de 10 ans, et Stripe les porte déjà. On
   note sur le client Stripe que le compte CreaFlow est supprimé.
2. **Base** : les clés R2 sont lues, puis `DELETE FROM users WHERE id = …`. Toutes les tables
   utilisateur sont déjà en `onDelete: cascade` (vérifié dans `schema.ts`), les tables filles de
   `scripts` aussi. Rien à ajouter au schéma pour ça.
3. **R2** : suppression des objets des `brandAssets` (original, vignette) et des
   `generatedImages`, **après** la base : si la suppression en base échoue, le compte reste entier
   avec ses images ; des objets orphelins valent mieux qu'un compte vivant amputé. Un échec R2 est
   logué, il ne bloque rien.
4. **Session** : cookie effacé.
5. **Email** « compte supprimé » envoyé à l'adresse, qui n'existe plus chez nous à ce moment-là.

Un event Stripe encore en vol après la suppression (abonnement mis à jour, checkout en cours) ne
trouve plus de compte : le webhook l'ignore en répondant 200, plutôt que de violer la clé étrangère
et de se faire rejouer pendant des jours.

Les jetons OAuth (réseaux sociaux, Drive, GitHub, Notion, Linear) sont effacés de notre côté. On
ne les révoque pas chez chaque fournisseur : chacun a son propre endpoint, certains n'en ont pas,
et les CGU disent déjà à l'utilisateur comment retirer l'accès depuis la plateforme. L'écran de
confirmation le rappelle.

Ce qui reste après suppression : les factures chez Stripe, les erreurs déjà remontées à Sentry
(purgées à leur échéance de rétention), les sauvegardes de l'hébergeur jusqu'à leur rotation.
C'est exactement ce que dit la politique de confidentialité.

### 4.3 Exporter ses données

`GET /api/account/export` renvoie un fichier `creaflow-export-<date>.json` : compte (email, date
de création), profil, sujets, matière, séries et catégories, scripts avec leurs versions, calendrier,
objectifs, connexions (plateforme et date, **jamais les jetons**), abonnement (plan, statut). Les
images sont listées par URL publique, pas embarquées : le droit à la portabilité porte sur les
données, et un zip d'images changerait l'échelle du chantier. Limite 3 par heure.

## 5. Ce qu'on ne fait pas ici

- **Vérification de l'email à l'inscription.** Friction en plus au moment où on veut des
  inscriptions. Le reset prouve de toute façon la propriété de l'adresse. À reconsidérer si on
  voit des adresses bidon.
- **Changer d'email.** Demande une vérification de la nouvelle adresse : même raison.
- **Emails de facturation** (facture, échec de paiement, fin d'essai). Stripe les envoie déjà si
  on l'active dans son Dashboard, c'est un réglage, pas du code.
- **Révocation des jetons chez les fournisseurs** (§4.2).
- **Bandeau cookies** : toujours un seul cookie de session, rien à consentir.

## 6. Modèle de données

Une migration `0035` (générée en `0033` avant le merge de la composition visuelle, renumérotée ensuite) :

- table `password_reset_tokens` (`id`, `user_id` cascade, `token_hash` unique, `expires_at`,
  `used_at`, `created_at`) ;
- colonne `users.sessions_invalidated_before` (timestamp, nullable).

Aucune table liée à une verticale, `schemaInvariants.test.ts` reste vert.

## 7. Découpage

| Lot | Contenu | Livrable vérifiable |
|---|---|---|
| 0 | `publisher.ts`, bannière conditionnelle, test de complétude, trois pages réécrites | les pages n'ont plus de crochets si l'identité est remplie |
| 1 | `src/lib/email/` (brevo + console), `.env.example`, tests avec `fetch` mocké | un email part en mode console |
| 2 | migration `0035`, forgot/reset, page de réinitialisation, invalidation des sessions | un reset complet en local, l'ancienne session est refusée |
| 3 | onglet Compte : changement de mot de passe, export JSON | fichier téléchargé, mot de passe changé |
| 4 | suppression de compte (Stripe, R2, base, email) | compte supprimé de bout en bout, Stripe résilié |
| 5 | `docs/TECH.md`, `docs/PRODUCT.md`, `CLAUDE.md`, `README.md` | docs à jour |

## 8. Arbitrages validés le 2026-10-16

- Identité de l'éditeur : placeholders pour l'instant, bannière brouillon maintenue par le code.
- Prestataire d'emails : Brevo plutôt que Resend. Domaine d'envoi pas encore choisi, mode console
  en attendant.
- CGU et CGV dans un seul document ; pas de vérification d'email à l'inscription ; export en JSON
  sans les images.
