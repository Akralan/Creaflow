# 07 — État réel et reste à faire

> Photographie au **2026-10-19**, branche `main` (dernier merge : écran Performance). C'est le document à mettre à jour en premier quand quelque chose change.

## Ce qui est validé en conditions réelles

La plupart des chantiers anciens (séries et rôles, rédacteur en chef — depuis retiré —, assistant agentique, connecteurs Notion/Linear, onboarding GitHub, légal/email/RGPD en curl) ont été validés par l'utilisateur. Dernier jugement sur la génération : les posts de l'**événement-pointeur** sont « **bien mieux** » (2026-10-24, quinze runs du banc sur MyKiné, MyTwin Leaderboard et tellovo lui-même, relevés dans `docs/tests/pointeurs/`). Ce chantier est **sur la branche `worktree-evenements-pointeurs`, pas sur `main`** : ses deux migrations (`0057`, `0058`) sont écrites mais **non appliquées**, et il n'a **jamais tourné dans l'application** — seulement au banc.

## Ce qui est implémenté mais **jamais essayé pour de vrai**

À considérer comme **non fiable** tant que ce n'est pas essayé :

| Chantier | Ce qui reste à vérifier en premier |
| :--- | :--- |
| **Performance** (`SPEC_PERFORMANCE`) | Tout : jamais essayé avec un vrai compte. Lecture X par Apify réelle, accès LinkedIn non obtenu. Données de démo : `scripts/seed-performance-demo.ts` (`--remove` pour retirer) |
| **Composition visuelle** (photos, détourage, montage) | Pas testé en réel |
| **Animation HTML libre** | Export MP4 à vérifier (Chrome/Edge, WebCodecs), qualité des animations |
| **Design HTML sur image** | Export PNG dans un navigateur réel |
| **Apprentissage du style** | Jamais essayé avec une vraie clé LLM |
| **Rythme des séries** | Écrans pas cliqués (recalcul vérifié en base) |
| **Écran Plan / Contexte, Prepare next week** | Essayés en dev ; pas en production |

## Ce qui n'est **pas branché** ou **pas fini**

- **Paiement** : la modale « Unlock weekly plans » (19 €/mois, plan « Founder ») ne fait rien. Stripe existe pour `starter`/`pro` (quotas en scripts) mais n'est pas aligné sur le quota en **semaines** — conversion à décider (`SPEC_APP_DESIGN_TELLOVO` §8).
- **Identité de l'éditeur** : `src/lib/legal/publisher.ts` en placeholders → les pages légales affichent la bannière « en cours de finalisation ». Rédactions internes, à faire relire par un juriste avant l'ouverture commerciale.
- **Statut Posted** : posé seulement par le rattachement de Performance (donc dépendant d'elle).
- **Rappels et notifications** : non implémentés. **Auto-publication** : non.
- **Assistant** : caché du menu.
- **Etsy et Shopify** : non codés (validations externes).
- **Dépôts privés** : exigent l'OAuth GitHub (parcours `/onboarding`, pas `/start`).
- **Responsive** : l'écran « This week » est pensé mobile ; `Direction`, `Settings`, `Performance` et `Assistant` gardent leur contenu d'avant dans la nouvelle coque, **non restylé**.

## Déploiement

VPS OVH unique `https://vps-a004fa72.vps.ovh.ca` (alias `ssh creaflow`), déployé le 2026-10-16 depuis `main`, **sans clé d'API** (landing, inscription, connexion marchent ; génération, photos, paiement, emails non). Les chantiers du 2026-10-17 → 19 (rédacteur par événements, entrée par le repo, design Tellovo, animation, Performance) sont **mergés sur `main` et poussés mais pas déployés**. Pas de nom de domaine acheté. Sauvegarde `backup.sh` non planifiée (R2 pas configuré). Redémarrage du noyau en attente.

## Sécurité à régler avant d'ouvrir au public

1. **`URGENT.md`** : retirer `EMAIL_LOG_LINKS` (le lien de connexion de chaque email est écrit dans les logs) **avant** de brancher Brevo en production.
2. `GITHUB_TOKEN` côté serveur, **requis**, sinon le quota GitHub tombe dès le deuxième visiteur.
3. Création de compte pour un tiers via `/start` : accepté (D10), limité par IP et email, plafond global.
4. Pas de vérification d'email à l'inscription (écartée pour l'instant).
5. Pas de Session Replay Sentry (volontaire : la politique de confidentialité ne le couvre pas).
6. Angle mort connu : si `STRIPE_WEBHOOK_SECRET` se désynchronise, 100 % des webhooks échouent **sans alerte**.
7. Routes `/api/billing/*` sans rate limit.

## Dette et limites connues

- **Limites d'un post** : `/start` a mesuré ≈ 1 min 20 de l'email au mail avec 3 documents ; plus long sur un gros dépôt.
- Si la génération de `/start` échoue en route, le compte existe sans séries et la personne retombe sur l'ancien `/onboarding` : pas de reprise automatique depuis le lien.
- Un événement existant avec date vague n'est pas remplacé par la version mieux datée d'un autre document (dédoublonnage trop large).
- Un rappel d'épisode voisin revient parfois avec ses chiffres malgré la consigne.
- Check de quota et écriture de l'événement non atomiques : deux requêtes concurrentes peuvent dépasser la limite de quelques unités.
- Pas de CI/CD, source maps Sentry non envoyées (stack traces minifiées).
- Les premiers lots du produit supposaient « desktop seulement » : `TECH.md` §2 le dit encore, c'est périmé pour l'écran de la semaine.

## Prochaines étapes (ordre suggéré)

1. **Déployer** les chantiers récents sur le VPS (migrations `0036` → `0053`, clé OpenAI, `GITHUB_TOKEN`) et rejouer `/start` de bout en bout.
2. **Brancher Brevo** (et retirer `EMAIL_LOG_LINKS`).
3. **Valider la cible prioritaire** avec quelques vrais utilisateurs ayant déjà de la matière : remplissent-ils le corpus sans aide, publient-ils le post tel quel ou le réécrivent-ils ?
4. **Essayer Performance** avec un vrai compte X (Apify) ; lancer la demande d'accès LinkedIn.
5. **Brancher le paiement** sur le quota en semaines.
6. Renseigner `publisher.ts` et faire relire les pages légales.
7. Ensuite : proposition de changement de rythme à partir des performances, interview de matière qui écrit directement des événements, sources connectées au-delà de git (dossier de notes, Obsidian), son sur les animations, carrousel PDF LinkedIn.
