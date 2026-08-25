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
  vector,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

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
  // Rééquilibrage batch de ContentCategory.weight à partir des métriques auto (docs/SPEC_METRIQUES_AUTO.md
  // §6/§7.4) — généré par un calcul déterministe (categoryReweightService.ts), pas par le LLM. targetId
  // reste null comme posting_goal_update : le payload porte la liste des catégories touchées.
  "category_reweight",
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
export const scriptMicroEditKindEnum = pgEnum("script_micro_edit_kind", ["selection_instruction", "block_regenerate"]);
export const sourceMaterialKindEnum = pgEnum("source_material_kind", ["paste", "file", "interview"]);
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
  passwordHash: text("password_hash").notNull(),
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

// Corpus de matière première par sujet (docs/SPEC_MATIERE_EDITEUR.md §3) — dépôt brut dont la
// génération de script se nourrit, injecté tel quel (pas de structuration intermédiaire — testé,
// une passe de découpage en unités typées perdait la richesse narrative du texte et produisait une
// sélection sans rapport avec le thème du post). productId nullable : une partie du corpus peut être
// de niveau marque (pas rattachée à un sujet précis), même pattern que brandAssets.productId. Un
// dépôt est immédiatement utilisable, pas de traitement asynchrone.
export const sourceMaterials = pgTable("source_materials", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  kind: sourceMaterialKindEnum("kind").notNull(),
  title: text("title"),
  rawText: text("raw_text").notNull(),
  // Résumé orienté potentiel narratif (docs/SPEC_REDACTEUR_EN_CHEF.md §2/§3.1) — null = pas encore
  // résumé (backfill paresseux en cours ou à venir) ; généré une fois à l'ingestion, jamais
  // regénéré automatiquement après une édition manuelle (l'édition devient la source de vérité).
  summary: text("summary"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

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
  sourceMaterialId: uuid("source_material_id").references(() => sourceMaterials.id, { onDelete: "cascade" }),
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
  // (détour assumé). Écrit à la génération, pas encore câblé avant le Lot B3.
  beatId: text("beat_id"),
  // Promesses explicites faites par ce script à l'audience (Annexe B.6) — consolidées dans
  // NarrativeState.openPromises au passage en "published" (§5, Lot B4). Pas encore câblé avant B3.
  promisesMade: jsonb("promises_made").notNull().default([]),
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
  // ensuite. V1 : stockage seul, pas d'exploitation (comparaison avec la version finale au moment
  // d'une passe d'apprentissage `style_profile`, hors scope ici).
  firstDraftSnapshot: jsonb("first_draft_snapshot"),
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

export const contentSeriesRelations = relations(contentSeries, ({ many }) => ({
  scripts: many(scripts),
  calendarEntries: many(calendarEntries),
  contentSeriesCategories: many(contentSeriesCategories),
  contentSeriesPlatforms: many(contentSeriesPlatforms),
  narrativeStates: many(narrativeState),
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
  calendarEntries: many(calendarEntries),
  metrics: one(postMetrics, { fields: [scripts.id], references: [postMetrics.scriptId] }),
  metricsSnapshots: many(postMetricsSnapshots),
  matchCandidates: many(postMatchCandidates),
  citations: many(sourceMaterialCitations),
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
