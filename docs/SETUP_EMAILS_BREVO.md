# CONFIGURATION EXTERNE — EMAILS DE SERVICE (BREVO) ET PAGES LÉGALES

Guide pratique de ce qu'il reste à faire côté vous pour que les emails de service partent vraiment
(`docs/SPEC_LEGAL_EMAIL_RGPD.md` §3) et pour que les pages légales soient complètes (§2). Le code
est prêt ; il n'attend que trois variables d'environnement et un fichier à remplir.

Les emails concernés sont uniquement des emails de service : lien de connexion (il n'y a plus de
mot de passe depuis le 2026-10-25), premier post du parcours `/start`, confirmation de suppression
de compte. Aucune
newsletter, aucun suivi d'ouverture.

---

## 0. Ce qui marche sans rien configurer

Sans `BREVO_API_KEY`, l'app démarre en mode **console** : chaque email est écrit dans les logs du
serveur (terminal de `npm run dev`) au lieu d'être envoyé. C'est le mode de développement normal :
pour se connecter, le lien envoyé par `/login` se lit directement dans le terminal, sur une ligne
JSON `"message":"Email (mode console, non envoyé)"`.

```
EMAIL_PROVIDER=console
BREVO_API_KEY=
EMAIL_FROM=CreaFlow <no-reply@localhost>
```

Deux garde-fous :

- en **production** (`NODE_ENV=production`), l'app refuse de retomber silencieusement sur la
  console : sans `BREVO_API_KEY`, le premier envoi lève une erreur explicite. Il faut soit une clé,
  soit `EMAIL_PROVIDER=console` écrit noir sur blanc (et dans ce cas le corps de l'email, donc le
  lien de réinitialisation, n'est pas logué) ;
- `EMAIL_PROVIDER=brevo` sans clé est refusé pareil : on ne veut jamais croire qu'un email part
  alors qu'il finit dans les logs.

---

## 1. Compte Brevo et clé API

1. Créer un compte sur [brevo.com](https://www.brevo.com) (l'offre gratuite suffit : environ
   300 emails par jour, transactionnel inclus — largement assez pour des emails de service).
2. Menu du compte (en haut à droite) → **SMTP & API** → onglet **API Keys** → *Generate a new API
   key*. Nommer la clé (ex. `creaflow-prod`) et la copier tout de suite, elle n'est affichée qu'une
   fois. C'est `BREVO_API_KEY` (commence par `xkeysib-`).
3. Ne pas confondre avec la clé **SMTP** du même écran : l'app n'utilise pas SMTP, elle appelle
   l'API HTTP transactionnelle (`POST https://api.brevo.com/v3/smtp/email`).

---

## 2. Domaine d'envoi

Brevo n'envoie que depuis une adresse dont il a vérifié le domaine. Tant que le domaine de prod
n'est pas choisi, rester en mode console ; une fois choisi :

1. **Senders, Domains & Dedicated IPs** (menu du compte) → onglet **Domains** → *Add a domain* →
   saisir le domaine (ex. `creaflow.fr`, ou un sous-domaine dédié comme `mail.creaflow.fr`, ce qui
   isole la réputation d'envoi du reste du domaine).
2. Brevo propose une configuration **automatique** (il se connecte à votre hébergeur DNS) ou
   **manuelle**. En manuel, trois enregistrements à copier **exactement** tels que la page les
   affiche (les noms d'hôtes exacts dépendent du compte, ne pas les recopier d'un tutoriel) :
   - un enregistrement **TXT « Brevo code »** — sert uniquement à prouver que le domaine est à vous ;
   - les enregistrements **DKIM** (signature des emails, c'est ce qui compte pour la délivrabilité) ;
   - un enregistrement **TXT DMARC** sur `_dmarc.<domaine>` — un domaine ne doit en avoir qu'un :
     s'il en existe déjà un, le garder et ne pas laisser Brevo le remplacer.
3. Cliquer sur *Authenticate* / *Verify*. La propagation DNS peut prendre jusqu'à 48 heures ; un
   échec le jour même n'est pas forcément un problème.
4. Onglet **Senders** → *Add a sender* : l'adresse d'expédition, ex. `no-reply@creaflow.fr`, avec
   un nom d'affichage. Sur un domaine authentifié, Brevo ne demande pas de validation par email de
   l'adresse elle-même.

SPF : pour un envoi classique en IP partagée, Brevo gère lui-même le domaine de retour, et
l'enregistrement SPF de votre domaine n'a pas à être modifié. Suivre ce que la page Domains de votre
compte affiche, pas un tutoriel tiers.

```
EMAIL_PROVIDER=brevo
BREVO_API_KEY=xkeysib-...
EMAIL_FROM=CreaFlow <no-reply@creaflow.fr>
```

`EMAIL_FROM` accepte « Nom <adresse> » ou une adresse nue. L'adresse doit être celle déclarée à
l'étape 4, sur le domaine authentifié à l'étape 2, sinon Brevo refuse l'envoi (HTTP 400, visible
dans les logs et dans Sentry).

---

## 3. `APP_URL` — l'adresse dans les liens

Le lien de réinitialisation est construit à partir de `APP_URL` :
`${APP_URL}/reinitialiser-mot-de-passe?token=…`. En prod, `APP_URL` doit être l'URL publique
exacte, avec `https://` et sans slash final. En local, il vaut `http://localhost:3000` : si le
serveur tourne sur un autre port, le lien lu dans le terminal pointe vers 3000, à corriger à la main.

---

## 4. Tester l'envoi réel

1. Renseigner les trois variables, redémarrer le serveur.
2. Sur `/login` → votre propre adresse → « Email me a link ».
3. L'email doit arriver en moins d'une minute. Sinon : onglet **Transactional → Logs** dans Brevo
   montre chaque tentative et la raison d'un refus ; côté app, un échec d'envoi est logué en
   `error` (et remonté à Sentry si configuré) sans faire échouer la requête, donc l'écran affiche
   quand même « si un compte existe, un email vient de partir ».

---

## 5. Pages légales — identité de l'éditeur

Rien à faire dans `.env` : l'identité vit dans **`src/lib/legal/publisher.ts`**. Remplacer chaque
valeur entre `[crochets]` par la vraie (nom ou raison sociale, statut, adresse, SIRET, TVA ou
mention de franchise, email de contact, directeur de la publication, hébergeur de l'application,
hébergeur de la base, médiateur de la consommation). Tant qu'il reste un crochet, les trois pages
affichent d'elles-mêmes une bannière « document en cours de finalisation » ; elle disparaît sans
autre action quand tout est rempli. Le test `src/lib/legal/publisher.test.ts` doit alors être mis
à jour (il constate aujourd'hui que l'identité est incomplète).

L'email de contact renseigné apparaît aussi dans le footer de la landing et dans l'email « mot de
passe modifié » (« si ce n'est pas vous, écrivez-nous à … »).

---

## 5 bis. Avant de brancher Brevo : retirer le lien journalisé

Le parcours `/start` (docs/SPEC_ENTREE_PAR_LE_REPO.md) envoie un email avec un lien de connexion. En attendant
Brevo, `EMAIL_LOG_LINKS=1` écrit ce lien dans les logs du serveur pour pouvoir essayer le parcours.
**À retirer avant la clé** : voir `URGENT.md` à la racine du dépôt.

---

## 6. Emails de facturation — côté Stripe, pas côté code

Les factures, échecs de paiement et rappels de renouvellement ne sont pas envoyés par l'app. Stripe
sait le faire : **Dashboard Stripe → Settings → Billing → Emails** (envoi des reçus et factures) et
**Settings → Billing → Subscriptions and emails** (échecs de paiement, relances). À activer une fois
le compte Stripe en mode live.
