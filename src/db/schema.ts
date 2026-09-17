import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  jsonb,
  integer,
  real,
  pgEnum,
  unique,
  uniqueIndex,
  vector,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

export const scriptStatusEnum = pgEnum("script_status", ["draft", "planned", "shot", "published"]);
export const contentTypeEnum = pgEnum("content_type", ["video", "visual", "text"]);
export const calendarStatusEnum = pgEnum("calendar_status", ["planned", "shot", "published"]);
export const onboardingStatusEnum = pgEnum("onboarding_status", ["in_progress", "complete"]);
export const assistantProposalKindEnum = pgEnum("assistant_proposal_kind", [
  "product_create",
  "product_update",
  "series_create",
  "series_update",
  "category_create",
  "category_update",
  "angle_create",
  "angle_update",
  "posting_goal_update",
  // Mise à jour de l'audience de marque (docs/SPEC_PROMPT_GENERATION_TECH.md §5) — payload
  // { targetAudience }, targetId toujours null (une seule cible : CreatorProfile de l'utilisateur,
  // pas d'id à référencer). L'override par sujet, lui, réutilise "product_update" (le champ vit sur
  // Product) — pas de kind dédié pour ce cas.
  "profile_update",
  // Passe d'apprentissage du style (docs/SPEC_APPRENTISSAGE_STYLE.md §2) — payload
  // { styleProfile, changeNotes }, targetId toujours null (une seule cible : le CreatorProfile).
  // Une seule proposition de ce kind en attente à la fois : la suivante remplace la précédente.
  "style_profile_update",
  // Rééquilibrage batch de ContentCategory.weight à partir des métriques auto (docs/SPEC_METRIQUES_AUTO.md
  // §6/§7.4) — généré par un calcul déterministe (categoryReweightService.ts), pas par le LLM. targetId
  // reste null comme posting_goal_update : le payload porte la liste des catégories touchées.
  "category_reweight",
  // Matière première proposée depuis le chat (docs/SPEC_ASSISTANT_AGENTIQUE.md §5) — deux portes :
  // extraction conversationnelle (le payload porte le texte) et fichier déposé dans la conversation
  // (le payload porte un attachmentId, le texte vit dans assistant_attachments). Le SourceMaterial
  // n'existe qu'à l'acceptation : l'assistant ne crée jamais de matière lui-même.
  "material_create",
  "material_update",
  "material_delete",
  // Archivage (jamais de suppression) des objets éditoriaux — l'assistant en était totalement privé
  // avant ce chantier (docs/SPEC_ASSISTANT_AGENTIQUE.md §4.1).
  "series_archive",
  "category_archive",
  "angle_archive",
]);
export const assistantProposalStatusEnum = pgEnum("assistant_proposal_status", ["pending", "accepted", "rejected"]);
export const brandAssetSourceEnum = pgEnum("brand_asset_source", ["upload", "google_drive"]);
export const brandAssetStatusEnum = pgEnum("brand_asset_status", ["pending", "ready", "unreachable"]);
export const brandAssetOrientationEnum = pgEnum("brand_asset_orientation", ["portrait", "landscape", "square"]);
export const googleDriveConnectionStatusEnum = pgEnum("google_drive_connection_status", ["ok", "needs_reconnect"]);
export const generatedImageStatusEnum = pgEnum("generated_image_status", ["ready", "failed"]);
export const socialConnectionStatusEnum = pgEnum("social_connection_status", ["ok", "needs_reconnect"]);
export const postMetricsSourceEnum = pgEnum("post_metrics_source", ["manual", "api"]);
export const postMatchCandidateStatusEnum = pgEnum("post_match_candidate_status", ["pending", "confirmed", "dismissed"]);
export const scriptOriginEnum = pgEnum("script_origin", ["generated", "imported", "manual"]);
// "design_instruction" = instruction à l'agent sur la maquette d'un post visuel
// (docs/SPEC_DESIGN_HTML_SUR_IMAGE.md §2 « Quota ») — même pool que les retouches de texte.
export const scriptMicroEditKindEnum = pgEnum("script_micro_edit_kind", ["selection_instruction", "block_regenerate", "design_instruction"]);
// Format d'un post visuel (docs/SPEC_FORMAT_VISUEL_ET_ANIMATION.md §1) — propriété du script, pas
// un type de contenu de plus.
export const visualFormatEnum = pgEnum("visual_format", ["single", "carousel", "animation"]);
export const visualDesignBaseKindEnum = pgEnum("visual_design_base_kind", ["generated", "asset", "none"]);
export const visualDesignStatusEnum = pgEnum("visual_design_status", ["draft", "stale", "exported"]);
// "connector" = document miroir d'une source externe branchée (dépôt GitHub aujourd'hui), par
// opposition aux trois portes manuelles. Voir docs/superpowers/specs/2026-08-31-onboarding-dev-github-design.md §3.3.
export const sourceMaterialKindEnum = pgEnum("source_material_kind", ["paste", "file", "interview", "connector"]);
// Verticale métier de l'utilisateur (docs/ARCHITECTURE_VERTICALES.md) : elle choisit le parcours
// d'onboarding, le prompt du chat, et demain le connecteur de matière proposé. Posée au signup,
// jamais recalculée. "creator" = chat généraliste puis saisie des sujets ; les autres valeurs
// désignent un compte né d'un fournisseur d'identité tiers et qui suit le parcours « source
// d'abord » (choix des sujets, chat court, réseaux) : "dev" pour GitHub et Linear, "artisan" pour
// Etsy et Shopify, "entrepreneur" pour Notion.
//
// La verticale ne dit PAS quel sélecteur afficher : "dev" couvre GitHub comme Linear. L'écran lit
// le fournisseur réellement connecté (oauthAccounts.provider) — docs/SPEC_CONNECTEURS_ET_SUJETS.md §7.2.
//
// N'apparaît QUE sur users. Une verticale ne partitionne pas le modèle de données : une deuxième
// colonne `vertical` ailleurs voudrait dire des lignes, des index puis des tables qui divergent par
// verticale — le point de non-retour du chantier 4 (docs/ARCHITECTURE_VERTICALES.md). Garde-fou
// exécutable : src/db/schemaInvariants.test.ts.
export const verticalEnum = pgEnum("vertical", ["creator", "dev", "artisan", "entrepreneur"]);
export const materialSourceTypeEnum = pgEnum("material_source_type", [
  "github_repo",
  "notion_page",
  "linear_project",
]);
export const materialSourceStatusEnum = pgEnum("material_source_status", ["ok", "error", "needs_reconnect"]);
// Mode d'une série (docs/SPEC_REDACTEUR_EN_CHEF.md §1/§2) : "feuilleton" = épisodes ordonnés, arc +
// beats maintenus par le rédacteur en chef (devlog, coulisses d'un projet) ; "rendez_vous" = épisodes
// autonomes partageant un format (news de la semaine) — pas de beats, planification désactivée pour
// ce mode. Défaut "rendez_vous" en cas de doute (inférence LLM à la création, Lot B3).
export const contentSeriesModeEnum = pgEnum("content_series_mode", ["feuilleton", "rendez_vous"]);
export const subscriptionPlanEnum = pgEnum("subscription_plan", ["starter", "pro"]);
// Sous-ensemble des statuts Stripe (Subscription.status) réellement distingués côté produit —
// "paused" n'est pas utilisé (pas de fonctionnalité de pause self-service en v1). Le webhook
// (src/app/api/billing/webhook/route.ts) rejette explicitement toute valeur hors de cette liste
// plutôt que de la stocker telle quelle.
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "incomplete",
  "incomplete_expired",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  // Nullable depuis l'arrivée de l'identité GitHub : un compte créé par OAuth n'a pas de mot de
  // passe. POST /api/auth/login doit donc refuser explicitement un compte sans hash plutôt que de
  // comparer contre null, ce qui afficherait "mot de passe incorrect" à quelqu'un qui n'en a jamais eu.
  passwordHash: text("password_hash"),
  vertical: verticalEnum("vertical").notNull().default("creator"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const onboardingSessions = pgTable("onboarding_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  messages: jsonb("messages").notNull(),
  extractedProfile: jsonb("extracted_profile"),
  status: onboardingStatusEnum("status").notNull().default("in_progress"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const assistantSessions = pgTable("assistant_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  messages: jsonb("messages").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Deuxième porte d'alimentation du corpus (docs/SPEC_MATIERE_EDITEUR.md §3.7/§8.8) : une session par
// sujet (productId nullable = niveau marque), pattern jsonb messages identique à onboardingSessions/
// assistantSessions. Limite connue et acceptée : Postgres ne déduplique pas les NULL dans une
// contrainte unique — deux sessions "niveau marque" pourraient coexister en cas de double création
// concurrente (même ordre de tolérance que le check-then-write non atomique d'enforceScriptQuota).
export const subjectInterviewSessions = pgTable(
  "subject_interview_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    messages: jsonb("messages").notNull().default([]),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.userId, t.productId)]
);

/**
 * Fichier déposé dans la conversation de l'assistant, en attente d'être rangé en matière
 * (docs/SPEC_ASSISTANT_AGENTIQUE.md §5.1).
 *
 * Le texte vit ici et NON dans le prompt : l'assistant ne reçoit que `filename`, jamais `rawText` —
 * un journal de bord de plusieurs centaines de Ko ne coûte donc rien au contexte, et le modèle ne
 * peut pas prétendre savoir ce que le fichier contient. Le SourceMaterial n'est créé qu'à
 * l'acceptation de la proposition correspondante, comme toute écriture de l'assistant.
 *
 * `consumedAt` marque le rangement : une pièce non consommée reste proposée au modèle tour après
 * tour, ce qui permet de la ranger plusieurs messages plus tard ("je te dirai après pour quel sujet").
 */
export const assistantAttachments = pgTable("assistant_attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  rawText: text("raw_text").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  consumedAt: timestamp("consumed_at"),
});

export const assistantProposals = pgTable("assistant_proposals", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: assistantProposalKindEnum("kind").notNull(),
  // Pas de FK : référence conditionnellement products.id / contentSeries.id / contentCategories.id /
  // contentAngles.id selon `kind`. Toujours null pour category_create, angle_create et posting_goal_update
  // (la fréquence par plateforme n'a pas de notion de ligne cible : le payload contient le platform).
  targetId: uuid("target_id"),
  payload: jsonb("payload").notNull(),
  status: assistantProposalStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

export const creatorProfiles = pgTable("creator_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  brandName: text("brand_name").notNull(),
  activityType: text("activity_type").notNull(),
  tone: text("tone"),
  values: text("values"),
  equipment: text("equipment").array(),
  weeklyTimeAvailable: text("weekly_time_available"),
  // Audience de marque (docs/SPEC_PROMPT_GENERATION_TECH.md §2/§5) — qui lit/achète, ce qui
  // l'intéresse, ce qu'il doit retenir ou faire ; texte libre, extrait de l'onboarding ou édité en
  // paramètres. Fallback pour Product.targetAudience quand ce dernier est null.
  targetAudience: text("target_audience"),
  styleProfile: jsonb("style_profile"),
  styleProfileUpdatedAt: timestamp("style_profile_updated_at"),
  // Identité de marque pour les maquettes (docs/SPEC_DESIGN_HTML_SUR_IMAGE.md §2) :
  // { primaryColor, secondaryColor, accentColor, fontHeading, fontBody, logoAssetId }. Optionnel —
  // sans elle, l'agent compose une palette à partir de la description de l'image de base.
  brandKit: jsonb("brand_kit"),
});

export const contentCategories = pgTable("content_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  description: text("description").notNull(),
  weight: integer("weight").notNull(),
  archived: boolean("archived").notNull().default(false),
  // Aiguillage matière×catégorie (docs/SPEC_MATIERE_EDITEUR.md §5.3) : catégorie qui tourne mal sans
  // matière documentée (storytelling/coulisses) par opposition à une catégorie qui tourne sans
  // journal (expertise/pédagogie). Curatable manuellement ; le générateur de calendrier réduit le
  // poids de ces catégories quand le corpus est sec, un jour J le re-typage reste manuel.
  materialHungry: boolean("material_hungry").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const contentAngles = pgTable("content_angles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  description: text("description").notNull(),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const contentSeries = pgTable("content_series", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  description: text("description").notNull(),
  // Pourcentage cible ABSOLU de créneaux, PAS normalisé à 100 comme contentCategories.weight —
  // la couverture série n'est jamais forcée à 100%.
  weight: integer("weight").notNull(),
  archived: boolean("archived").notNull().default(false),
  // Lot B2 : colonne + toggle manuel. L'inférence LLM à la création (Annexe B.8) arrive au Lot B3.
  mode: contentSeriesModeEnum("mode").notNull().default("rendez_vous"),
  // Sujet dont la série tire sa matière (docs/SPEC_REDACTEUR_EN_CHEF.md, sélecteur de sujet ajouté
  // après le Lot B3) — nullable : une série peut n'être rattachée à aucun sujet précis, auquel cas
  // le rédacteur en chef retombe sur la matière de niveau marque. SET NULL à la suppression du sujet
  // (la série survit, perd juste son lien matière, même pattern que sourceMaterials.productId).
  productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const contentSeriesCategories = pgTable(
  "content_series_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    seriesId: uuid("series_id").notNull().references(() => contentSeries.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").notNull().references(() => contentCategories.id, { onDelete: "cascade" }),
  },
  (t) => [unique().on(t.seriesId, t.categoryId)]
);

// Aucune ligne pour une catégorie = visible sur tous les réseaux (comportement historique,
// rétrocompatible sans backfill).
export const contentCategoriesPlatforms = pgTable(
  "content_categories_platforms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    categoryId: uuid("category_id").notNull().references(() => contentCategories.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
  },
  (t) => [unique().on(t.categoryId, t.platform)]
);

// Aucune ligne pour une série = visible sur tous les réseaux (comportement historique,
// rétrocompatible sans backfill).
export const contentSeriesPlatforms = pgTable(
  "content_series_platforms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    seriesId: uuid("series_id").notNull().references(() => contentSeries.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
  },
  (t) => [unique().on(t.seriesId, t.platform)]
);

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  valueProposition: text("value_proposition"),
  photoUrl: text("photo_url"),
  // Override d'audience par sujet (docs/SPEC_PROMPT_GENERATION_TECH.md §2/§5) — null = fallback sur
  // CreatorProfile.targetAudience à l'injection (buildScriptUserMessage). Couvre le cas personal
  // branding multi-sujets : l'audience d'un projet ML ≠ celle d'un produit en dev.
  targetAudience: text("target_audience"),
});

// Source connectée alimentant le corpus d'un sujet (docs/superpowers/specs/2026-08-31-onboarding-dev-github-design.md
// §3.2). Table séparée plutôt que des colonnes GitHub sur products : un sujet est un objet
// éditorial, un dépôt une de ses sources — des colonnes de connecteur sur products figeraient
// "un sujet = un dépôt" et pollueraient une table référencée partout.
export const materialSources = pgTable(
  "material_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    // CASCADE, contrairement à sourceMaterials.productId qui est SET NULL : une source sans sujet
    // n'a pas de sens, on ne saurait plus quoi resynchroniser ni vers où.
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    type: materialSourceTypeEnum("type").notNull(),
    externalId: text("external_id").notNull(), // id numérique du dépôt GitHub
    label: text("label").notNull(), // "owner/repo", affiché tel quel
    // POINT D'EXTENSION des connecteurs : tout ce qu'un fournisseur a de spécifique passe par ce
    // jsonb ({ defaultBranch } pour GitHub), jamais par des colonnes dédiées ni par une table à
    // lui. C'est ce qui garde un seul jeu de migrations quand les verticales se multiplient
    // (docs/ARCHITECTURE_VERTICALES.md, chantier 4).
    config: jsonb("config").notNull().default({}),
    syncCursor: text("sync_cursor"), // SHA du commit le plus récent vu
    lastSyncedAt: timestamp("last_synced_at"),
    status: materialSourceStatusEnum("status").notNull().default("ok"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  // Porte sur externalId et non productId : le même dépôt ne peut pas être branché deux fois par le
  // même utilisateur, mais deux utilisateurs peuvent suivre le même dépôt public.
  (t) => [unique().on(t.userId, t.type, t.externalId)]
);

// Corpus de matière première par sujet (docs/SPEC_MATIERE_EDITEUR.md §3) — dépôt brut dont la
// génération de script se nourrit, injecté tel quel (pas de structuration intermédiaire — testé,
// une passe de découpage en unités typées perdait la richesse narrative du texte et produisait une
// sélection sans rapport avec le thème du post). productId nullable : une partie du corpus peut être
// de niveau marque (pas rattachée à un sujet précis), même pattern que brandAssets.productId. Un
// dépôt est immédiatement utilisable, pas de traitement asynchrone.
export const sourceMaterials = pgTable(
  "source_materials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    kind: sourceMaterialKindEnum("kind").notNull(),
    title: text("title"),
    rawText: text("raw_text").notNull(),
    // Résumé orienté potentiel narratif (docs/SPEC_REDACTEUR_EN_CHEF.md §2/§3.1) — null = pas encore
    // résumé (backfill paresseux en cours ou à venir) ; généré une fois à l'ingestion, jamais
    // regénéré automatiquement après une édition manuelle (l'édition devient la source de vérité).
    // EXCEPTION pour kind="connector" : le re-sync remet summary à null quand le fichier a changé
    // dans le dépôt, parce que c'est le dépôt qui fait foi, pas une édition locale.
    summary: text("summary"),
    // CASCADE, et c'est une déviation assumée de la convention du repo (products.id est en SET NULL
    // depuis sourceMaterials, scripts, brandAssets, contentSeries). Un document connecté est le
    // MIROIR d'une source, pas de la matière rédigée : l'orpheliner à la suppression du sujet le
    // ferait basculer en matière de niveau marque (productId null), donc injectée à CHAQUE
    // génération sans sujet via getMaterialForSubject(userId, null). Cinquante .md d'un projet
    // supprimé empoisonneraient toutes les générations suivantes. Le contenu ne se perd pas pour
    // autant : il est dans le dépôt.
    sourceId: uuid("source_id").references(() => materialSources.id, { onDelete: "cascade" }),
    // Identifiant du document DANS sa source : chemin du fichier ("docs/SPEC.md"), ou la valeur
    // réservée "__commits__" pour le journal. Null pour toute matière non connectée.
    externalRef: text("external_ref"),
    // Blob SHA GitHub pour un fichier, SHA du commit le plus récent pour le journal. C'est la
    // comparaison de cette valeur qui rend le re-sync idempotent sans relire le contenu.
    externalChecksum: text("external_checksum"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  // Un document par chemin et par source. Partiel : la matière collée à la main a sourceId null et
  // n'est pas concernée. Deux dépôts branchés sur le même sujet peuvent chacun avoir leur README.md.
  (t) => [uniqueIndex().on(t.sourceId, t.externalRef).where(sql`${t.sourceId} is not null`)]
);

// Citation post-génération (docs/SPEC_MATIERE_EDITEUR.md §3 — remplace le découpage en unités) : le
// LLM rapporte lui-même, dans sa réponse de génération (GeneratedScript.usedExcerpts), les passages
// du corpus qu'il a utilisés comme base factuelle. On les retrouve dans le texte source par
// recherche approximative (citationMatching.ts) et on les enregistre ici — sert à la fois de
// traçabilité (UI "matière utilisée pour ce script") et de repère pour annoter, dans les prochaines
// générations, les passages déjà exploités (inciter à la variété sans jamais les exclure).
export const sourceMaterialCitations = pgTable("source_material_citations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  scriptId: uuid("script_id").notNull().references(() => scripts.id, { onDelete: "cascade" }),
  // Nullable : aucun document n'a matché avec une confiance suffisante — la citation est quand même
  // conservée (signal de debug : "le modèle a cru citer de la matière, on n'a pas su la localiser").
  // SET NULL et non CASCADE : sans ça, la suppression d'un sujet connecté — qui cascade jusqu'aux
  // documents miroir, cf. sourceMaterials.sourceId — effacerait la traçabilité de scripts déjà
  // publiés. Null est déjà un état de première classe ici (citationService l'écrit,
  // narrativeDirector le filtre) : l'extrait cité reste lisible, il n'est simplement plus
  // rattachable à un document.
  sourceMaterialId: uuid("source_material_id").references(() => sourceMaterials.id, { onDelete: "set null" }),
  excerpt: text("excerpt").notNull(),
  matchStart: integer("match_start"),
  matchLength: integer("match_length"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// État narratif du rédacteur en chef (docs/SPEC_REDACTEUR_EN_CHEF.md §2) — un par sujet, priorité
// série > produit > marque (productId et seriesId ne sont jamais renseignés ensemble). Stocke
// uniquement l'indérivable (arc, beats, promesses, callbacks, contrat de format) ; le publié et la
// matière consommée se dérivent de l'existant (Script.concept publiés, marquage [déjà utilisé]).
// Contrainte unique tolérante aux NULL, même pattern que subjectInterviewSessions (commentaire plus
// haut) : deux états "niveau marque" pourraient coexister en cas de double création concurrente,
// même ordre de tolérance qu'ailleurs dans ce repo.
export const narrativeState = pgTable(
  "narrative_state",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "cascade" }),
    seriesId: uuid("series_id").references(() => contentSeries.id, { onDelete: "cascade" }),
    arcSummary: text("arc_summary"),
    // Forme d'un élément (Annexe B.5) : { id, title, kind: "material"|"pedagogical"|"personal",
    // angleHint, focusDocIds: string[], status: "planned"|"drafted"|"published"|"skipped", scriptId,
    // rationale }. Vide en mode rendez_vous. Plafond 20 à l'écriture (§5, Lot B4).
    beats: jsonb("beats").notNull().default([]),
    // { text, scriptId, madeAt }[] — jamais modifié par la planification (§3.2), alimenté à la
    // publication d'un script (§5, Lot B4). Plafond 10.
    openPromises: jsonb("open_promises").notNull().default([]),
    // string[] — détails récurrents devenus familiers pour l'audience. Plafond 8.
    callbacks: jsonb("callbacks").notNull().default([]),
    // Mode rendez_vous uniquement, ex. "3 news + 1 hot take".
    formatContract: text("format_contract"),
    // Posé à true à l'ingestion de nouvelle matière sur le sujet (§5, Lot B4) — déclenche une
    // replanification paresseuse avant le prochain choix du jour (mode feuilleton, Lot B3).
    isStale: boolean("is_stale").notNull().default(false),
    lastPlannedAt: timestamp("last_planned_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.userId, t.productId, t.seriesId)]
);

// Bibliothèque de ressources visuelles (docs/SPEC_RESSOURCES_VISUELLES.md). Les images sources ne
// sont stockées que pour sourceType="upload" (originalKey) ; pour "google_drive", elles restent dans
// le Drive de l'utilisateur et sont relues à la demande via l'API Drive (fileId = externalId).
export const brandAssets = pgTable("brand_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sourceType: brandAssetSourceEnum("source_type").notNull(),
  externalId: text("external_id"), // Drive fileId ; null pour un upload direct
  sourceCheckedAt: timestamp("source_checked_at"),
  checksum: text("checksum").notNull(), // md5Checksum Drive, ou sha256 calculé à l'upload
  mimeType: text("mime_type").notNull(),
  width: integer("width"),
  height: integer("height"),
  originalKey: text("original_key"), // clé objet R2 de l'original — rempli seulement pour sourceType="upload"
  thumbnailKey: text("thumbnail_key"), // null tant que status="pending"
  productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  aiDescription: text("ai_description"),
  tags: text("tags").array(),
  orientation: brandAssetOrientationEnum("orientation"),
  hasEmbeddedText: boolean("has_embedded_text"),
  embedding: vector("embedding", { dimensions: 768 }),
  status: brandAssetStatusEnum("status").notNull().default("pending"),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Connexion Google Drive (scope drive.file, via Google Picker) — distincte de socialConnections
// qui ne couvre que tiktok/instagram/linkedin. Un seul refresh token par utilisateur, conservé pour
// l'usage différé (files.get au captioning et à la génération d'image).
export const googleDriveConnections = pgTable("google_drive_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  accessTokenExpiresAt: timestamp("access_token_expires_at").notNull(),
  driveAccountEmail: text("drive_account_email"),
  status: googleDriveConnectionStatusEnum("status").notNull().default("ok"),
  lastCheckedAt: timestamp("last_checked_at"),
  connectedAt: timestamp("connected_at").notNull().defaultNow(),
});

// Identité tierce d'un compte (docs/SPEC_CONNECTEURS_ET_SUJETS.md §7). Distincte de
// socialConnections : ces fournisseurs ne publient rien, ils authentifient et alimentent le corpus.
// Une seule table pour tous, ex-github_accounts — un fournisseur de plus ne doit coûter ni une
// table, ni une valeur d'enum (d'où provider en text).
export const oauthAccounts = pgTable(
  "oauth_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    // La liste des fournisseurs fait foi dans src/lib/oauth/registry.ts, pas ici.
    provider: text("provider").notNull(),
    providerUserId: text("provider_user_id").notNull(),
    login: text("login").notNull(),
    name: text("name"),
    bio: text("bio"),
    avatarUrl: text("avatar_url"),
    accessToken: text("access_token").notNull(),
    // Nuls pour GitHub, dont le token d'OAuth App classique ne périme pas. Renseignés pour Notion
    // et Linear, dont les tokens expirent (Linear : 24 h) — sans eux tout casserait le lendemain.
    // Aucun appel ne lit accessToken directement : tout passe par getValidProviderAccessToken.
    refreshToken: text("refresh_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    scope: text("scope").notNull(),
    // Spécifique fournisseur : workspaceId Notion, domaine de boutique Shopify demain. Même rôle
    // que materialSources.config, et même raison — le cœur ne connaît aucun fournisseur.
    config: jsonb("config").notNull().default({}),
    connectedAt: timestamp("connected_at").notNull().defaultNow(),
  },
  // L'unicité portait sur user_id seul du temps de github_accounts. Un compte peut désormais
  // cumuler plusieurs identités, mais une seule par fournisseur.
  (t) => [unique().on(t.provider, t.providerUserId), unique().on(t.userId, t.provider)]
);

export const socialConnections = pgTable("social_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  // Nullable : certains providers (ex. Instagram long-lived token) n'exposent pas d'expiration
  // exploitable au même format que les autres — dans ce cas pas de refresh proactif possible,
  // l'appel API échoue explicitement le cas échéant (cf. socialConnectionService.ts).
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  status: socialConnectionStatusEnum("status").notNull().default("ok"),
  // Sert de repère pour la cadence de fetch (dédup 24h sur X, docs/SPEC_METRIQUES_AUTO.md §2.5).
  lastMetricsFetchAt: timestamp("last_metrics_fetch_at"),
  platformUserId: text("platform_user_id").notNull(),
  connectedAt: timestamp("connected_at").notNull().defaultNow(),
});

export const inspirationVideos = pgTable("inspiration_videos", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(),
  externalUrl: text("external_url").notNull(),
  captionText: text("caption_text"),
  metadata: jsonb("metadata"),
  fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
});

export const scripts = pgTable("scripts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  platform: text("platform").notNull(),
  // Nullable : naissance paresseuse (docs/SPEC_MATIERE_EDITEUR.md §4.5) — la ligne peut naître avec
  // un seul bloc rempli, avant qu'un titre n'existe. L'UI affiche un fallback "(sans titre)".
  title: text("title"),
  // Intention de génération (docs/SPEC_PROMPT_GENERATION_TECH.md §2/§6.4) — la TRACE de l'intention,
  // pas une description vivante, même philosophie que firstDraftSnapshot. Écrite par le LLM en
  // premier champ du tool à la génération, puis figée : micro-retouches, éditions manuelles et
  // régénérations de bloc n'y touchent jamais. Remplacée uniquement par le geste "autre idée, même
  // brief" (§6, pas encore implémenté ici). Null pour origin="manual"/"imported" et pour les scripts
  // antérieurs à cette migration.
  concept: text("concept"),
  // Concepts écartés via "autre idée, même brief" (§6, pas encore implémenté ici — colonne posée par
  // anticipation avec le champ concept, migration unique pour les deux). Appendés dans l'ordre ;
  // réinjectés en contexte des générations suivantes du même script, plafonnés aux N plus récents à
  // l'injection (§6.3).
  rejectedConcepts: jsonb("rejected_concepts").notNull().default([]),
  // Traçabilité vers le plan du rédacteur en chef (docs/SPEC_REDACTEUR_EN_CHEF.md §2/§4.1.6) — id
  // d'un beat dans NarrativeState.beats (jsonb, pas de FK possible). Null hors chef ou hors plan
  // (détour assumé). Écrit à la génération (Lot B3), passe le beat en "drafted" puis "published"
  // selon le statut de ce script (Lot B4).
  beatId: text("beat_id"),
  // Promesses explicites faites par ce script à l'audience (Annexe B.6) — consolidées dans
  // NarrativeState.openPromises au passage en "published" (§5, Lot B4).
  promisesMade: jsonb("promises_made").notNull().default([]),
  // Texte EXACT de la promesse ouverte que ce post honore, choisi par le chef au choix du jour
  // (direction.promiseToHonor, §3.3) — absent du modèle §2 de la spec, mais nécessaire pour retirer
  // la promesse d'openPromises au passage en "published" (§5) : ce lien doit survivre entre la
  // génération et une publication ultérieure, potentiellement dans une tout autre session. Null si
  // ce post n'honore aucune promesse.
  promiseHonored: text("promise_honored"),
  hookVisual: text("hook_visual"),
  hookText: text("hook_text"),
  hookAudio: text("hook_audio"),
  storyboard: jsonb("storyboard"),
  caption: text("caption"),
  hashtags: text("hashtags").array(),
  soundRecommendation: text("sound_recommendation"),
  contentCategoryId: uuid("content_category_id").notNull().references(() => contentCategories.id),
  angleId: uuid("angle_id").references(() => contentAngles.id, { onDelete: "set null" }),
  seriesId: uuid("series_id").references(() => contentSeries.id, { onDelete: "set null" }),
  contentType: contentTypeEnum("content_type").notNull().default("video"),
  // Format du post visuel (docs/SPEC_FORMAT_VISUEL_ET_ANIMATION.md §4) : choisi à la génération,
  // contraint le nombre d'entrées du storyboard et la forme de la maquette. Sans objet hors
  // contentType="visual" (reste "single"). slideCount : carrousel ; durationMs : animation.
  visualFormat: visualFormatEnum("visual_format").notNull().default("single"),
  slideCount: integer("slide_count"),
  durationMs: integer("duration_ms"),
  status: scriptStatusEnum("status").notNull().default("draft"),
  // Image de marque sélectionnée par recherche sémantique comme référence pour ce script (contentType
  // "visual"), et image effectivement générée à partir d'elle le cas échéant.
  brandAssetId: uuid("brand_asset_id").references(() => brandAssets.id, { onDelete: "set null" }),
  // Référence circulaire scripts <-> generatedImages : annotation de retour explicite requise pour
  // que TypeScript casse le cycle d'inférence (pattern documenté de drizzle-orm).
  generatedImageId: uuid("generated_image_id").references((): AnyPgColumn => generatedImages.id, { onDelete: "set null" }),
  // "generated" = passé par le LLM (génération ou régénération) ; "imported" = collé via
  // POST /api/scripts/import (écrit ailleurs) ; "manual" = né dans l'éditeur (naissance paresseuse,
  // docs/SPEC_MATIERE_EDITEUR.md §4.5). N'affecte ni le quota ni l'anti-répétition.
  origin: scriptOriginEnum("origin").notNull().default("generated"),
  // Gisement de la donnée de voix (docs/SPEC_MATIERE_EDITEUR.md §4.7) : les colonnes de blocs telles
  // que générées, capturées une seule fois à la création si origin="generated" — jamais réécrit
  // ensuite. Exploité par la passe d'apprentissage du style (docs/SPEC_APPRENTISSAGE_STYLE.md),
  // qui le compare à la version finale une fois le script finalisé.
  firstDraftSnapshot: jsonb("first_draft_snapshot"),
  // Null tant qu'aucune passe d'apprentissage du style n'a lu ce script. Posé par la passe qui l'a
  // lu, que la proposition qui en résulte soit acceptée ou non (refuser des règles n'est pas une
  // raison de reproposer les mêmes scripts). Le compteur « scripts corrigés depuis la dernière
  // analyse » est une requête sur cette colonne, pas une colonne de plus.
  styleLearnedAt: timestamp("style_learned_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  // Pas de trigger onUpdate dans ce repo — mis à jour explicitement à chaque écriture de contenu
  // (patchScriptContent), même pattern que subscriptions.updatedAt.
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Image produite par édition conditionnée (Nano Banana) à partir d'une ou plusieurs BrandAsset.
// Un seul mode existe en v1 : "staging" (mise en scène — fond/lumière/cadrage autour du produit réel).
// Le mode "transformation du produit" (couleur/matière/forme) n'existe pas dans le code, cf.
// docs/SPEC_RESSOURCES_VISUELLES.md §6.1 — ce n'est pas une option masquée, c'est une absence.
export const generatedImages = pgTable("generated_images", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  scriptId: uuid("script_id").references((): AnyPgColumn => scripts.id, { onDelete: "set null" }),
  sourceAssetIds: uuid("source_asset_ids").array().notNull(), // pas de FK sur array Postgres
  mode: text("mode").notNull().default("staging"),
  instruction: text("instruction"),
  storageKey: text("storage_key").notNull(),
  mimeType: text("mime_type").notNull(),
  width: integer("width"),
  height: integer("height"),
  status: generatedImageStatusEnum("status").notNull().default("ready"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Maquette d'un post visuel (docs/SPEC_DESIGN_HTML_SUR_IMAGE.md §4) : une slide HTML par entrée du
// storyboard, thème commun, rendue en PNG dans le navigateur. Une seule version courante par
// script (script_id UNIQUE) ; la jointure part d'ici, pas de FK depuis scripts (évite une seconde
// référence circulaire du type generatedImageId). Objet du cœur, pas d'une verticale.
export const visualDesigns = pgTable("visual_designs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  scriptId: uuid("script_id").notNull().unique().references(() => scripts.id, { onDelete: "cascade" }),
  baseKind: visualDesignBaseKindEnum("base_kind").notNull(),
  baseGeneratedImageId: uuid("base_generated_image_id").references(() => generatedImages.id, { onDelete: "set null" }),
  baseAssetId: uuid("base_asset_id").references(() => brandAssets.id, { onDelete: "set null" }),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  // { palette: string[], fontHeading, fontBody, mood }
  theme: jsonb("theme").notNull(),
  // [{ planNumber, html, exportKey: string | null }] — html déjà passé par la liste blanche.
  slides: jsonb("slides").notNull(),
  status: visualDesignStatusEnum("status").notNull().default("draft"),
  lastInstruction: text("last_instruction"),
  // AI Act art. 50 (docs/SPEC_RESSOURCES_VISUELLES.md §6.2) : vrai si la base est une image
  // générée — le PNG composé dans le navigateur ne conserve pas le marquage du fournisseur.
  containsAiImagery: boolean("contains_ai_imagery").notNull().default(false),
  // Animation (docs/SPEC_FORMAT_VISUEL_ET_ANIMATION.md §4) : durée totale et ligne de temps
  // [{ layerId, enter, startMs, enterMs, exit, exitAtMs }]. Null pour une maquette statique.
  durationMs: integer("duration_ms"),
  timeline: jsonb("timeline"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Vue courante des métriques d'un post (1:1 avec Script). L'historique daté vit dans
// postMetricsSnapshots ci-dessous — cette table reste la valeur "actuelle" utilisée partout
// ailleurs dans le code (buildPerformanceSummary, categoryReweightService, etc.).
export const postMetrics = pgTable("post_metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  scriptId: uuid("script_id").notNull().unique().references(() => scripts.id, { onDelete: "cascade" }),
  views: integer("views").notNull().default(0),
  likes: integer("likes").notNull().default(0),
  comments: integer("comments").notNull().default(0),
  shares: integer("shares").notNull().default(0),
  // "manual" = saisie via PUT /api/scripts/:id/metrics, "api" = récupéré automatiquement et
  // rattaché (confirmé) via le flow de matching post↔script (docs/SPEC_METRIQUES_AUTO.md §4).
  // La re-pondération automatique des catégories ne considère jamais source="manual" — non vérifié.
  source: postMetricsSourceEnum("source").notNull().default("manual"),
  platformPostId: text("platform_post_id"),
  fetchedAt: timestamp("fetched_at"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Historique daté, jamais écrasé — résout l'absence d'historique de PostMetrics identifiée en
// docs/SPEC_METRIQUES_AUTO.md §5 (un post à J+7 et à J+30 sont deux informations différentes).
export const postMetricsSnapshots = pgTable("post_metrics_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  scriptId: uuid("script_id").notNull().references(() => scripts.id, { onDelete: "cascade" }),
  views: integer("views").notNull().default(0),
  likes: integer("likes").notNull().default(0),
  comments: integer("comments").notNull().default(0),
  shares: integer("shares").notNull().default(0),
  source: postMetricsSourceEnum("source").notNull(),
  capturedAt: timestamp("captured_at").notNull().defaultNow(),
});

// Candidats de rattachement post↔script en attente de confirmation utilisateur
// (docs/SPEC_METRIQUES_AUTO.md §4, piste heuristique + confirmation unique). Un candidat
// "confirmed" ou "dismissed" n'est plus jamais reproposé pour ce (platform, platformPostId).
export const postMatchCandidates = pgTable(
  "post_match_candidates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    scriptId: uuid("script_id").notNull().references(() => scripts.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
    platformPostId: text("platform_post_id").notNull(),
    externalUrl: text("external_url").notNull(),
    captionText: text("caption_text"),
    publishedAt: timestamp("published_at"),
    score: real("score").notNull(),
    // Métriques du post au moment du scan — évite un second appel API à la confirmation.
    metrics: jsonb("metrics").notNull(),
    status: postMatchCandidateStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at"),
  },
  (t) => [unique().on(t.platform, t.platformPostId)]
);

// Un événement par génération OU régénération de script — distinct de `scripts.createdAt`, qui ne
// bouge jamais sur une régénération (updateScriptRecord fait un UPDATE en place sur la même ligne).
// C'est cette table, pas `scripts`, que billingService.ts compte pour le quota mensuel : le coût
// LLM (donc le quota) est déclenché à chaque génération, régénération comprise.
export const scriptGenerationEvents = pgTable("script_generation_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  scriptId: uuid("script_id").notNull().references(() => scripts.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Micro-retouches dans l'éditeur (docs/SPEC_MATIERE_EDITEUR.md §4.6) — comptées à part du quota de
// génération complète (scriptGenerationEvents) : un pool distinct, plus généreux, sans quoi le
// comptage plein tarif tuerait l'itération qui est tout le but de l'éditeur.
export const scriptMicroEditEvents = pgTable("script_micro_edit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  scriptId: uuid("script_id").notNull().references(() => scripts.id, { onDelete: "cascade" }),
  kind: scriptMicroEditKindEnum("kind").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Facturation self-service (Stripe). Une seule ligne par utilisateur — un utilisateur qui n'a
// jamais payé n'a pas de ligne du tout (essai gratuit géré par comptage dans billingService.ts,
// pas par une ligne "free" ici). stripeSubscriptionId reste null tant que checkout.session.completed
// n'est pas arrivé ; currentPeriodStart/End reflètent la période Stripe en cours, utilisée pour
// borner le comptage des scripts générés dans le quota du mois.
export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  stripeCustomerId: text("stripe_customer_id").notNull().unique(),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  plan: subscriptionPlanEnum("plan").notNull(),
  status: subscriptionStatusEnum("status").notNull(),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Rate limiting fenêtre fixe, backé Postgres (pas de Redis dans l'infra actuelle — cf.
// docs/TECH.md §7 sécurité). `key` = `${scope}:${identifier}:${windowStart epoch}`, ex.
// "login:203.0.113.4:1799990400". Une ligne = un compteur pour une fenêtre passée ; les fenêtres
// expirées sont supprimées paresseusement à chaque appel de checkRateLimit (pas de cron dans ce
// repo, même philosophie que le reste de l'app).
export const rateLimitBuckets = pgTable("rate_limit_buckets", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(1),
  windowStart: timestamp("window_start").notNull(),
});

export const postingGoals = pgTable("posting_goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(),
  targetCountPerWeek: real("target_count_per_week").notNull(),
});

export const calendarEntries = pgTable("calendar_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  scriptId: uuid("script_id").references(() => scripts.id, { onDelete: "set null" }),
  platform: text("platform").notNull(),
  scheduledDate: timestamp("scheduled_date").notNull(),
  contentCategoryId: uuid("content_category_id").notNull().references(() => contentCategories.id),
  seriesId: uuid("series_id").references(() => contentSeries.id, { onDelete: "set null" }),
  status: calendarStatusEnum("status").notNull().default("planned"),
  reminderSent: boolean("reminder_sent").notNull().default(false),
});

export const productsRelations = relations(products, ({ many }) => ({
  scripts: many(scripts),
  brandAssets: many(brandAssets),
  sourceMaterials: many(sourceMaterials),
  narrativeStates: many(narrativeState),
  series: many(contentSeries),
  materialSources: many(materialSources),
}));

export const materialSourcesRelations = relations(materialSources, ({ one, many }) => ({
  product: one(products, { fields: [materialSources.productId], references: [products.id] }),
  documents: many(sourceMaterials),
}));

export const oauthAccountsRelations = relations(oauthAccounts, ({ one }) => ({
  user: one(users, { fields: [oauthAccounts.userId], references: [users.id] }),
}));

export const narrativeStateRelations = relations(narrativeState, ({ one }) => ({
  product: one(products, { fields: [narrativeState.productId], references: [products.id] }),
  series: one(contentSeries, { fields: [narrativeState.seriesId], references: [contentSeries.id] }),
}));

export const brandAssetsRelations = relations(brandAssets, ({ one }) => ({
  product: one(products, { fields: [brandAssets.productId], references: [products.id] }),
}));

export const sourceMaterialsRelations = relations(sourceMaterials, ({ one, many }) => ({
  product: one(products, { fields: [sourceMaterials.productId], references: [products.id] }),
  source: one(materialSources, { fields: [sourceMaterials.sourceId], references: [materialSources.id] }),
  citations: many(sourceMaterialCitations),
}));

export const sourceMaterialCitationsRelations = relations(sourceMaterialCitations, ({ one }) => ({
  script: one(scripts, { fields: [sourceMaterialCitations.scriptId], references: [scripts.id] }),
  sourceMaterial: one(sourceMaterials, { fields: [sourceMaterialCitations.sourceMaterialId], references: [sourceMaterials.id] }),
}));

export const generatedImagesRelations = relations(generatedImages, ({ one }) => ({
  script: one(scripts, { fields: [generatedImages.scriptId], references: [scripts.id] }),
}));

export const contentCategoriesRelations = relations(contentCategories, ({ many }) => ({
  scripts: many(scripts),
  calendarEntries: many(calendarEntries),
  contentSeriesCategories: many(contentSeriesCategories),
  contentCategoriesPlatforms: many(contentCategoriesPlatforms),
}));

export const contentAnglesRelations = relations(contentAngles, ({ many }) => ({
  scripts: many(scripts),
}));

export const contentSeriesRelations = relations(contentSeries, ({ one, many }) => ({
  scripts: many(scripts),
  calendarEntries: many(calendarEntries),
  contentSeriesCategories: many(contentSeriesCategories),
  contentSeriesPlatforms: many(contentSeriesPlatforms),
  narrativeStates: many(narrativeState),
  product: one(products, { fields: [contentSeries.productId], references: [products.id] }),
}));

export const contentSeriesCategoriesRelations = relations(contentSeriesCategories, ({ one }) => ({
  series: one(contentSeries, { fields: [contentSeriesCategories.seriesId], references: [contentSeries.id] }),
  category: one(contentCategories, { fields: [contentSeriesCategories.categoryId], references: [contentCategories.id] }),
}));

export const contentCategoriesPlatformsRelations = relations(contentCategoriesPlatforms, ({ one }) => ({
  category: one(contentCategories, {
    fields: [contentCategoriesPlatforms.categoryId],
    references: [contentCategories.id],
  }),
}));

export const contentSeriesPlatformsRelations = relations(contentSeriesPlatforms, ({ one }) => ({
  series: one(contentSeries, { fields: [contentSeriesPlatforms.seriesId], references: [contentSeries.id] }),
}));

export const scriptsRelations = relations(scripts, ({ one, many }) => ({
  product: one(products, { fields: [scripts.productId], references: [products.id] }),
  contentCategory: one(contentCategories, {
    fields: [scripts.contentCategoryId],
    references: [contentCategories.id],
  }),
  angle: one(contentAngles, { fields: [scripts.angleId], references: [contentAngles.id] }),
  series: one(contentSeries, { fields: [scripts.seriesId], references: [contentSeries.id] }),
  brandAsset: one(brandAssets, { fields: [scripts.brandAssetId], references: [brandAssets.id] }),
  generatedImage: one(generatedImages, { fields: [scripts.generatedImageId], references: [generatedImages.id] }),
  visualDesign: one(visualDesigns, { fields: [scripts.id], references: [visualDesigns.scriptId] }),
  calendarEntries: many(calendarEntries),
  metrics: one(postMetrics, { fields: [scripts.id], references: [postMetrics.scriptId] }),
  metricsSnapshots: many(postMetricsSnapshots),
  matchCandidates: many(postMatchCandidates),
  citations: many(sourceMaterialCitations),
}));

export const visualDesignsRelations = relations(visualDesigns, ({ one }) => ({
  script: one(scripts, { fields: [visualDesigns.scriptId], references: [scripts.id] }),
  baseGeneratedImage: one(generatedImages, { fields: [visualDesigns.baseGeneratedImageId], references: [generatedImages.id] }),
  baseAsset: one(brandAssets, { fields: [visualDesigns.baseAssetId], references: [brandAssets.id] }),
}));

export const postMetricsRelations = relations(postMetrics, ({ one }) => ({
  script: one(scripts, { fields: [postMetrics.scriptId], references: [scripts.id] }),
}));

export const postMetricsSnapshotsRelations = relations(postMetricsSnapshots, ({ one }) => ({
  script: one(scripts, { fields: [postMetricsSnapshots.scriptId], references: [scripts.id] }),
}));

export const postMatchCandidatesRelations = relations(postMatchCandidates, ({ one }) => ({
  script: one(scripts, { fields: [postMatchCandidates.scriptId], references: [scripts.id] }),
}));

export const calendarEntriesRelations = relations(calendarEntries, ({ one }) => ({
  script: one(scripts, { fields: [calendarEntries.scriptId], references: [scripts.id] }),
  contentCategory: one(contentCategories, {
    fields: [calendarEntries.contentCategoryId],
    references: [contentCategories.id],
  }),
  series: one(contentSeries, { fields: [calendarEntries.seriesId], references: [contentSeries.id] }),
}));
