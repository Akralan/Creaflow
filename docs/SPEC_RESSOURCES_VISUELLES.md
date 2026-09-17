# CADRAGE — RESSOURCES VISUELLES & GÉNÉRATION D'IMAGES

> Cadrage de la fonctionnalité. Complète `PRODUCT.md` (positionnement) et `TECH.md` (état du code).
>
> **Statut :** implémenté (schéma, ingestion, captioning, recherche sémantique, génération d'image, garde-fous) et validé en conditions réelles. Prérequis d'environnement : un bucket Cloudflare R2, un projet Google Cloud (Picker + OAuth) et l'extension `pgvector` sur le Postgres cible — voir `docs/SETUP_RESSOURCES_VISUELLES.md` (configuration pas à pas) et `drizzle/README_PGVECTOR.md` (détail pgvector). Prolongé par `docs/SPEC_DESIGN_HTML_SUR_IMAGE.md` (composition typographique par-dessus l'image).

---

## 1. Problème résolu

Pour `contentType: "visual"`, le moteur produit aujourd'hui une **description** de l'image — titre, accroche visuelle, découpage en slides, légende, hashtags — mais pas l'image. L'utilisateur, un artisan sans temps ni compétence marketing selon le positionnement de `PRODUCT.md` §1.1, doit encore ouvrir Canva et fabriquer le visuel lui-même.

C'est le plus grand écart entre promesse et livrable du produit actuel :

- pour la **vidéo**, un storyboard est un livrable complet — le créateur filme, c'est son métier ;
- pour le **visuel statique**, un découpage en slides ne l'est pas — tout le travail reste à faire.

## 2. Principe

Une bibliothèque d'images de marque par utilisateur, alimentée depuis son Google Drive, dont le moteur se sert comme base pour produire les visuels via **Nano Banana** (Gemini image).

Choix du modèle justifié par sa force réelle : l'**édition conditionnée par images de référence** avec conservation du sujet entre générations — et non le texte-vers-image de zéro, où il n'apporterait rien de décisif face aux alternatives. Le cas d'usage (retravailler les vraies photos de la marque) correspond exactement à son point fort.

Note : la génération d'images et le captioning vision utilisent `GEMINI_API_KEY` indépendamment de `LLM_PROVIDER` (qui, lui, pointe sur OpenAI, seul provider texte opérationnel).

---

## 3. Ingestion — Google Picker (v1)

### 3.1 Décision

**Google Picker en multi-sélection, scope `drive.file` uniquement, vue `DOCS_IMAGES`.**

Paramétrage : `multiselect` activé, `drive.file` en scope unique (jamais combiné), `files.get?alt=media` pour récupérer les octets au moment du captioning et de la génération.

### 3.2 Justification du scope

| Scope | Classification Google | Conséquence |
| :--- | :--- | :--- |
| `drive.file` | Non-sensitive | Vérification basique uniquement |
| `drive.readonly` | **Restricted** | Vérification renforcée + évaluation de sécurité CASA (payante, annuelle, plusieurs semaines) |

Google recommande explicitement `drive.file` + Picker pour éviter la vérification de scope restreint. Pour un produit non lancé, CASA est disqualifiant.

### 3.3 Ce que le choix enlève

Tout le sous-système de synchronisation : pas de scan périodique, pas de détection d'ajouts ou de suppressions, pas de webhook Drive. L'utilisateur désigne, on ingère, c'est terminé. **Gain estimé : une semaine de développement.**

### 3.4 Ce que le choix coûte

L'utilisateur devra revenir sélectionner ses nouvelles images. `drive.file` est un modèle de consentement **par fichier** ; « un dossier et tout ce qu'il contiendra demain » relève sémantiquement de `drive.readonly`.

Acceptable au rythme d'un artisan (quelques photos par semaine). À adoucir avec un bouton *Ajouter des images* qui rouvre le Picker.

### 3.5 Upload direct — maintenu en parallèle

Pas comme repli technique, mais parce qu'une photo prise à l'instant sur mobile ne doit pas transiter par Drive.

### 3.6 Évolution possible sans migration

Un **compte de service** (`assets@…iam.gserviceaccount.com`) que l'utilisateur ajoute en lecteur sur son dossier depuis Drive donnerait la sémantique « dossier vivant » — sous-dossiers et ajouts futurs compris — sans aucun scope restreint. Ce n'est pas un contournement : c'est du partage Drive ordinaire.

Coût : cosmétique (coller une adresse e-mail est moins joli qu'un bouton *Connecter Google Drive*), compensable par un bouton copier et un GIF de trois secondes.

Comme `BrandAsset` stocke un `externalId` dans tous les cas, ce sera un **adapter supplémentaire, pas une refonte**.

Troisième palier envisageable à maturité : `drive.readonly` + CASA, quand il y a du revenu et un an d'existence.

---

## 4. Stockage

### 4.1 Ce qui n'est PAS stocké

**Les images sources.** Elles restent dans le Drive de l'utilisateur. Elles ne sont qu'une **entrée** du pipeline : si la source disparaît six mois plus tard, les posts déjà générés sont intacts.

### 4.2 Ce qui est stocké

| Élément | Volume | Justification |
| :--- | :--- | :--- |
| Métadonnées (fileId, checksum, description, embedding, tags) | Quelques Ko / image | Indexation et recherche |
| **Vignettes en cache** (~30 Ko) | ~10 Mo / utilisateur (300 images) | Le `thumbnailLink` de Drive est éphémère et authentifié, inutilisable pour peupler une grille |
| **Images générées** (~1,5 Mo) | ~360 Mo / utilisateur / an | Irréductible : elles n'existent nulle part ailleurs |

Ordre de grandeur : 1 000 utilisateurs actifs ≈ 360 Go ≈ **5 € / mois** sur du stockage objet standard.

### 4.3 Note sur l'argumentaire

L'économie de stockage **n'est pas** un argument valable en faveur de Drive — le calcul ci-dessus le montre. Le bon argument, qui se suffit à lui-même : les gens ont déjà leurs photos ailleurs, et le re-téléversement est un point d'abandon réel en onboarding.

### 4.4 Pas d'écriture dans le Drive de l'utilisateur

Décision ferme. Les images générées ne sont pas réécrites dans son Drive : cela supposerait un scope d'écriture et polluerait son espace avec des dizaines de variantes non demandées.

---

## 5. Indexation & recherche sémantique

### 5.1 Captioning à l'ingestion

Un appel structuré par image, **jamais rejoué** — invalidé uniquement si le `md5Checksum` renvoyé par l'API Drive change.

Champs extraits :
- description en une phrase
- sujet principal
- ambiance
- orientation
- présence de texte incrusté
- dominante colorimétrique
- **rattachement automatique à un `Product` du catalogue par nom** ← le champ à plus fort rendement

### 5.2 Description puis embedding, pas d'embedding multimodal direct

Trois raisons :

1. **La description sert deux fois** — pour la recherche vectorielle, et injectée en clair dans `buildScriptUserMessage` pour que le modèle sache ce qu'il manipule.
2. **C'est débogable** — quand une image remonte mal, on lit sa description et on comprend pourquoi.
3. **Les requêtes sont éditoriales, pas visuelles** — le calendrier cherche « une image pour un post catégorie *coulisses*, angle *avant/après*, série *Le mythe du mercredi* ». Un embedding purement visuel matche mal ce type d'intention ; une description contenant « atelier, mains au travail, lumière naturelle » matche très bien.

### 5.3 Infrastructure

`pgvector` sur le Postgres existant — pas de service externe. Index HNSW sur `embedding`. **Filtrage par `productId` / `orientation` en amont** de la recherche vectorielle, pas après. Sur quelques centaines d'images par utilisateur, la latence est négligeable.

### 5.4 Schéma

```
BrandAsset
- id, userId
- sourceType (upload / google_drive), externalId (nullable), sourceCheckedAt
- checksum, mimeType, width, height, thumbnailKey
- productId (nullable, FK ON DELETE SET NULL)
- aiDescription (texte), tags (array), orientation, hasEmbeddedText (bool)
- embedding (vector)
- status (pending / ready / unreachable)
- archived, createdAt
```

L'abstraction `AssetSource` (`upload` | `google_drive` | plus tard `dropbox`, `instagram`) évite de graver Drive dans le schéma — même pattern que `LLM_PROVIDER` dans `src/lib/llm/provider.ts`.

---

## 6. Garde-fous produit

### 6.1 Ligne rouge — à encoder structurellement, pas dans le prompt

Pour les cibles prioritaires (bijoux, décoration, bougies, textile personnalisé), **l'image est le produit**. Deux usages de nature différente :

| Usage | Statut |
| :--- | :--- |
| Fond, lumière, cadrage, format, mise en scène autour de l'objet | **Légitime** — c'est le travail d'un photographe produit |
| Couleur, matière, finition, proportions de l'objet lui-même | **Interdit par défaut** — représentation d'un produit inexistant, vendu par quelqu'un ayant un stock réel |

Le second cas constitue une pratique commerciale trompeuse au sens du code de la consommation. Elle serait commise par l'utilisateur mais **suggérée par l'outil**.

Implémentation : deux modes d'édition explicites côté API, le mode « transformation du produit » étant soit absent, soit derrière une confirmation qui nomme le risque. Cette distinction ne doit **pas** être laissée à l'appréciation du modèle via une consigne en langage naturel.

### 6.2 Conformité — AI Act article 50

- Les obligations de transparence de l'article 50 sont **applicables depuis le 2 août 2026**.
- La période transitoire jusqu'au 2 décembre 2026 ne vaut **que pour les systèmes déjà mis sur le marché avant le 2 août 2026**. CreaFlow n'étant pas lancé : **aucun sursis**.
- L'article 50(2) exige un marquage **technique** lisible par machine (filigrane, métadonnées, empreinte cryptographique), pas un avertissement visuel facultatif.

Ce qui vient du fournisseur : le filigrane SynthID embarqué dans les sorties image de Gemini — *à confirmer dans les conditions actuelles de l'API avant de s'en remettre à ce mécanisme*.

Ce qui reste à traiter côté CreaFlow :
- ne pas dépouiller les métadonnées lors du traitement (redimensionnement, recompression, conversion de format) ;
- clarifier la position **fournisseur vs déployeur** dans la chaîne.

À traiter maintenant, tant que ce sont trois décisions d'architecture, plutôt que dans six mois quand ce sera une migration.

---

## 7. UX & robustesse

### 7.1 Placement dans le parcours

**Ne pas demander les images pendant l'onboarding.** À ce moment-là, l'utilisateur ne sait pas à quoi elles serviront, et le parcours est déjà long (profil, catalogue produits, connexions sociales).

**Bon moment : la première génération d'un script `visual`.** « Pour produire le visuel, j'ai besoin de photos de ta marque » — la valeur est évidente, la demande est motivée, le taux d'acceptation sera sans commune mesure.

### 7.2 Ingestion non bloquante

Une sélection de 40 images déclenche 40 appels vision. L'écran ne doit jamais être bloqué :

1. insertion immédiate des `BrandAsset` en `status: pending` ;
2. grille affichée tout de suite avec les vignettes ;
3. descriptions et embeddings remplis au fil de l'eau.

Un asset non traité est simplement **invisible pour la recherche sémantique** — pas d'erreur, juste un délai.

### 7.3 Panne de token — principale fragilité

Puisque les octets ne sont pas détenus, la bibliothèque ne vaut que ce que vaut le refresh token. Une révocation rend toutes les images illisibles au moment précis où l'utilisateur lance une génération.

Deux mitigations peu coûteuses :
- **les vignettes en cache** font que l'UI ne se vide jamais — l'utilisateur voit ses images avec un bandeau *reconnexion nécessaire*, pas une grille grise ;
- **un `files.get` léger avant chaque génération** détecte la perte d'accès en amont plutôt qu'en plein milieu du pipeline.

---

## 8. Décisions ouvertes

1. ~~**Deux modes d'édition ou un seul ?**~~ **Tranché : un seul.** Le mode « transformation du produit » est absent du code (pas seulement de l'UI) — `generateStagedImage` (`src/lib/llm/providers/geminiImage.ts`) n'a aucun paramètre de mode, `generatedImages.mode` est fixé en dur à `"staging"` côté service. (§6.1)
2. **Vérification SynthID — reste à faire manuellement.** Confirmer que les sorties Nano Banana embarquent bien un marquage lisible par machine, et qu'il survit au pipeline de traitement (`exiftool` avant/après upload sur R2). Le code garantit seulement l'absence de retraitement destructeur (`src/lib/storage/r2.ts`, `src/lib/services/generatedImageService.ts` : aucun appel `sharp` sur une image générée). (§6.2)
3. **Position réglementaire — reste à trancher (juridique, hors code).** Fournisseur ou déployeur au sens de l'AI Act ? Détermine qui porte l'obligation de marquage. (§6.2)
4. ~~**Modèle d'embedding**~~ **Re-tranché le 2026-08-26 : `text-embedding-3-small` chez OpenAI, dimension 768** (`OPENAI_EMBEDDING_MODEL`, `src/lib/llm/embeddings.ts`), cohérent avec `brandAssets.embedding` (`vector(768)`, `src/db/schema.ts`). Le paramètre `dimensions` est passé explicitement : le défaut du modèle est 1536, qui ne rentrerait pas dans la colonne. Appel câblé sur OpenAI **indépendamment de `LLM_PROVIDER`**, comme la boucle agentique de l'assistant (`SPEC_ASSISTANT_AGENTIQUE.md` §2.2) ; le captioning vision et la génération d'images restent chez Gemini.

   **Historique du bug (constaté le 2026-08-25, corrigé le 2026-08-26).** Le choix initial était `text-embedding-004` chez Gemini ; le modèle a été retiré côté Google et `embedText()` échouait systématiquement avec `404 models/text-embedding-004 is not found for API version v1beta, or is not supported for embedContent`. Découvert en rejouant la baseline (`docs/baseline/lot{0,1,2}-openai/`, brief `03-sparse-visual-serie`).

   **La portée réelle était plus large que ce qui avait été noté ici.** La version précédente de ce point disait « dès qu'un `BrandAsset` existe » : c'était faux. `findBestBrandAssetForScript` appelait `embedText()` **avant** toute requête sur les assets, sans rien attraper — donc toute génération `visual` tombait en 500 **même pour un utilisateur sans aucune image**. Deux gardes ont été posées avec le correctif : sortie anticipée s'il n'existe aucun asset `ready` (inutile de payer un embedding pour chercher dans un ensemble vide), et échec d'embedding traité comme « pas d'image trouvée » avec un `logger.warn` — une image de référence est un bonus, jamais une condition pour écrire un script.

   **Migration des données :** `POST /api/assets/reembed` recalcule les embeddings des ressources `ready` à partir de leur `aiDescription` déjà stockée (aucun appel vision, donc quasi gratuit). **À lancer une fois** après ce changement, et après tout changement futur de modèle : deux modèles d'embedding ne produisent pas des vecteurs comparables, et les mélanger dans le même index donne des résultats de recherche faux sans qu'aucune erreur ne le signale.

---

## 9. Hors périmètre de ce cadrage

Le **corpus factuel pour les posts texte** (tarifs, délais, matériaux, FAQ, anciens posts) est un objet distinct, avec sa propre mécanique. Il répond à une faiblesse réelle de l'assistant éditorial, dont la contrainte « ne jamais inventer d'info non fournie » (`TECH.md` §5.4) ne repose aujourd'hui que sur 3 URLs collées à la main.

À cadrer séparément, et **à ne pas fusionner avec `BrandAsset`** sous prétexte que l'UI dira « Ressources » dans les deux cas.
