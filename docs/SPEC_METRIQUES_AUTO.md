# CADRAGE — RÉCUPÉRATION AUTOMATIQUE DES MÉTRIQUES

> **Statut : implémenté** (TikTok, YouTube, Instagram, LinkedIn, X — voir détail plateforme par plateforme ci-dessous). Fusionné dans `PRODUCT.md` (§2.2, §3 Module D/E, §4) et `TECH.md` (§2, §3, §4, §5.7). Conservé comme archive de cadrage — ne plus mettre à jour, c'est `TECH.md` §5.7 qui reflète le code actuel.
>
> Décisions prises pour la livraison (§7 ci-dessous, détail dans `TECH.md` §5.7) : rattachement post↔script par heuristique + confirmation utilisateur unique (§4, piste 1+2) ; re-pondération appliquée uniquement via `AssistantProposal` (§7.4), jamais automatique ; portée limitée à `ContentCategory.weight` (§7.3), angles/séries non concernés pour cette itération ; rafraîchissement lazy à l'ouverture de l'écran `/performance`, pas de cron (§7.5). LinkedIn et X sont codés mais non activables en pratique (blocages externes, §2.4/§2.5) — voir `TECH.md` §2.

---

## 1. Pourquoi c'est le chantier prioritaire

Le positionnement affiché est **Directeur Marketing Virtuel**. Un directeur marketing n'exécute pas seulement, il **arbitre** : cette catégorie sous-performe, on baisse son poids ; cet angle marche, on l'utilise plus ; cette série ne prend pas, on l'archive.

Aujourd'hui, les métriques n'alimentent qu'un « résumé de performance récente » réinjecté dans le prompt de génération (`TECH.md` §5.1). Concrètement :

- rien ne remonte vers `ContentCategory.weight` ;
- rien ne biaise `selectLeastRecentlyUsedAngle` (`angleService.ts`) ;
- rien n'influence `POST /api/calendar/generate` pour le mois suivant.

**La boucle est ouverte.** La fermer est la seule chose qu'un concurrent ne peut pas copier : il faudrait posséder simultanément une direction éditoriale explicite (catégories, angles, séries) **et** l'historique de performance rattaché à chacune. Les deux structures existent déjà en base. Il manque l'arbitrage entre les deux.

### Le problème de données

La boucle repose aujourd'hui sur une **saisie manuelle** (`PUT /api/scripts/:id/metrics`). C'est du travail sans récompense immédiate, et donc le premier comportement à disparaître après deux semaines d'usage.

L'automatisation n'est pas un confort : c'est la **condition de possibilité** de la fonctionnalité d'arbitrage.

---

## 2. État plateforme par plateforme

| Plateforme | Compte perso suffit | Accès dev | Effort | Priorité |
| :--- | :--- | :--- | :--- | :--- |
| **TikTok** | Oui | Self-serve | OAuth déjà en place | **1** |
| **YouTube** | Oui | Gratuit, self-serve | Nouvelle intégration, simple | **2** |
| **Instagram** | Non → bascule Creator | App Review Meta | OAuth en place + friction UX | 3 |
| **LinkedIn** | Oui (depuis 2025) | Validation LinkedIn requise | Dépend d'un tiers | 4 |
| **X** | Oui | Compte pay-per-use | Faible, budget à ouvrir | 5 |
| Newsletter, Blog, Slack, Autre | — | — | — | Manuel définitivement |

### 2.1 TikTok — meilleur cas

- `POST /v2/video/list/` → vues, likes, commentaires, partages, timestamp de création par vidéo.
- `GET /v2/user/info/` → statistiques de compte.
- **Aucun compte Business requis.**
- ⚠️ Les tokens d'accès expirent **toutes les 24 h** → job de refresh obligatoire.

### 2.2 YouTube — deuxième meilleur cas, actuellement sous-évalué

- **Data API v3** : gratuit en 2026, pas d'abonnement ni de facturation à l'appel.
- **Analytics API** : métriques privées de YouTube Studio — vues, temps de visionnage, durée moyenne de visionnage, sources de trafic — via OAuth 2.0, le propriétaire de chaîne accordant explicitement l'accès.
- N'importe quel compte Google disposant d'une chaîne suffit. Aucune notion de compte business.
- ⚠️ Quota de **10 000 unités / jour / projet** — largement suffisant pour un rafraîchissement quotidien par utilisateur.

**Action documentaire :** YouTube est aujourd'hui classée « suivie sans OAuth » dans `PRODUCT.md` §2.2 et absente de `hasOAuth` dans `src/lib/social/types.ts`. Ce classement sous-estime largement son apport et devrait être corrigé.

### 2.3 Instagram — friction assumée

- Un compte **personnel n'a aucun accès API**, quel que soit le chemin.
- Le compte **Creator** suffit (Business non requis), il est **gratuit et réversible**, et ne demande pas de Page Facebook via le chemin Instagram Login.
- C'est trois taps dans les réglages du téléphone — pas un mur, mais une **étape d'onboarding à assumer avec un message explicite**.
- ⚠️ Aucun contournement côté code : un compte personnel n'émettra simplement pas de token utilisable.

### 2.4 LinkedIn — le blocage a changé de nature

- `memberCreatorPostAnalytics` (lancée en juillet 2025) expose impressions, membres touchés, réactions, commentaires, repartages, sauvegardes et clics sur liens, pour le **membre authentifié** — donc un profil personnel, sans page entreprise.
- Scope : `r_member_postAnalytics`.
- ⚠️ Fait partie du produit **Community Management API**, dont l'accès est soumis à validation LinkedIn et **n'est pas self-serve**.

Le problème n'est plus le type de compte de l'utilisateur, c'est le statut développeur de CreaFlow.

### 2.5 X — possible mais payant

- Plus de tier gratuit depuis **février 2026** : pay-per-use à **$0,005 / lecture de post**, $0,010 / lecture d'utilisateur. Anciens tiers Basic et Pro fermés aux nouveaux inscrits.
- Aucune exigence de compte business côté utilisateur.
- À l'échelle CreaFlow : 30 posts relus par utilisateur et par mois ≈ **15 centimes**. Déduplication sur 24 h (redemander le même post dans la journée n'est facturé qu'une fois).
- Le coût réel est l'ouverture d'un compte de facturation, pas la consommation.

---

## 3. Ordre d'attaque

**Étape 1 — TikTok seul suffit à valider la boucle.** L'OAuth est déjà en place (`TECH.md` §2), il ne manque que la lecture des compteurs et le rattachement au `Script`. Ne pas attendre la couverture multi-plateformes pour tester si l'arbitrage automatique produit des résultats sensés.

**Étape 2 — YouTube**, avant Instagram côté priorité technique : seule plateforme offrant des métriques riches, gratuites, avec un compte ordinaire et sans validation d'accès.

**Étape 3 — Instagram**, une fois la friction Creator formulée correctement en onboarding.

**Étapes 4 et 5 — LinkedIn et X**, chacune dépendant d'un déblocage externe (validation LinkedIn, ouverture d'un compte payant X).

---

## 4. Problème non résolu — rattachement post ↔ script

CreaFlow ne publie pas depuis l'app. **Rien ne relie donc un post récupéré via API au `Script` qui l'a produit.** C'est le point le plus dur du chantier.

Trois pistes, par fiabilité décroissante :

1. **Confirmation utilisateur unique** — au premier scan, l'app propose « est-ce bien ce post ? » et l'association est mémorisée définitivement. Fiable, mais ajoute une action.
2. **Appariement heuristique** — plateforme + date de publication proche de `CalendarEntry.scheduledDate` + similarité de légende avec `Script.caption`. Automatique, mais faillible : un créateur qui publie deux posts le même jour sur la même plateforme casse l'heuristique.
3. **Rattachement manuel** — reproduit le problème de la saisie manuelle qu'on cherche justement à supprimer.

Piste recommandée : **1 avec 2 en pré-remplissage** — l'heuristique propose, l'utilisateur confirme d'un tap. Non tranché.

---

## 5. `PostMetrics` n'est pas dimensionné pour l'automatique

Structure actuelle (`TECH.md` §3) : une ligne unique et mutable, 1:1 avec `Script`, avec un simple `updatedAt`.

Deux manques bloquants :

| Manque | Conséquence |
| :--- | :--- |
| **Pas d'historique** | Un post à J+7 et le même à J+30 sont deux informations différentes. L'écrasement les perd, et interdit toute analyse de vitesse de croissance. |
| **Pas de provenance** | Impossible de distinguer une valeur saisie à la main d'une valeur remontée par API, ni de savoir de quand elle date. |

Direction : conserver `PostMetrics` comme vue courante, ajouter une table de **snapshots datés**.

```
PostMetrics (inchangé dans son rôle, enrichi)
- id, scriptId (unique, FK ON DELETE CASCADE)
- views, likes, comments, shares
- source (manual / api)
- platformPostId (nullable — clé de rattachement, cf. §4)
- fetchedAt, updatedAt

PostMetricsSnapshot (nouveau)
- id, scriptId (FK ON DELETE CASCADE)
- views, likes, comments, shares
- source (manual / api)
- capturedAt
```

La saisie manuelle reste possible et cohabite avec l'automatique — nécessaire pour Newsletter, Blog, Slack et les plateformes non couvertes.

---

## 6. Question ouverte majeure — la mécanique de re-pondération

**Comment la performance re-pondère `ContentCategory.weight` sans rendre le calendrier instable.**

C'est le sujet de fond de la fonctionnalité. Tout le reste — OAuth, quotas, refresh de tokens — est de la plomberie en comparaison.

Deux risques identifiés :

### 6.1 Sur-réaction

Un créateur débutant n'a pas de volume statistique. Trois posts ne disent rien, et re-pondérer sur cette base produit du bruit présenté comme une décision éditoriale.

Pistes : seuil minimal de posts par catégorie avant toute re-pondération ; amplitude de correction plafonnée par cycle ; normalisation par plateforme (les ordres de grandeur de vues n'ont rien de comparable entre TikTok et LinkedIn).

### 6.2 Emballement

Une catégorie légèrement favorisée reçoit plus de créneaux → produit plus de données → se renforce → jusqu'à l'assèchement du mix éditorial, que le produit vend précisément comme équilibré (`PRODUCT.md` §3, Module D).

Pistes : plancher de poids par catégorie active ; part fixe du calendrier réservée à l'exploration hors optimisation ; correction amortie plutôt que proportionnelle.

### 6.3 Portée

À décider également : la re-pondération touche-t-elle uniquement `ContentCategory.weight`, ou aussi le biais de `selectLeastRecentlyUsedAngle` et le poids des `ContentSeries` ? Les trois axes n'ont pas la même sensibilité au bruit — l'angle étant le plus fin, il est aussi le plus exposé.

---

## 7. Décisions ouvertes

1. **Rattachement post ↔ script** — piste retenue et modalité UI. (§4)
2. **Mécanique de re-pondération** — seuils, amplitude, amortissement, plancher. (§6)
3. **Portée de l'arbitrage** — catégories seules, ou catégories + angles + séries. (§6.3)
4. **Automatique ou proposé ?** — la re-pondération s'applique-t-elle seule, ou passe-t-elle par le mécanisme d'`AssistantProposal` déjà en place (`TECH.md` §3), que l'utilisateur accepte ou rejette ? Cette seconde option est cohérente avec le principe existant « l'IA ne modifie jamais rien directement » (`PRODUCT.md` §3, Module E) et neutralise en grande partie les risques du §6.
5. **Fréquence de rafraîchissement** — quotidien par utilisateur, ou déclenché à l'ouverture du calendrier ?

---

## 8. Impact documentaire attendu

- `PRODUCT.md` §2.2 et §4 — reclasser YouTube en plateforme à connexion OAuth.
- `PRODUCT.md` §4, ligne *Analytics* — « suivi déclaratif manuel » devient partiellement automatique.
- `PRODUCT.md` §4, ligne *Direction éditoriale* — « suggestions proactives basées sur les performances réelles » quitte la colonne *Prochaine étape*.
- `TECH.md` §3 — schéma `PostMetrics` + nouvelle table `PostMetricsSnapshot`.
- `TECH.md` §2 — registre de plateformes, ajout de YouTube en `hasOAuth: true`.
