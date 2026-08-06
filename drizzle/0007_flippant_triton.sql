CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TYPE "public"."brand_asset_orientation" AS ENUM('portrait', 'landscape', 'square');--> statement-breakpoint
CREATE TYPE "public"."brand_asset_source" AS ENUM('upload', 'google_drive');--> statement-breakpoint
CREATE TYPE "public"."brand_asset_status" AS ENUM('pending', 'ready', 'unreachable');--> statement-breakpoint
CREATE TYPE "public"."generated_image_status" AS ENUM('ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."google_drive_connection_status" AS ENUM('ok', 'needs_reconnect');--> statement-breakpoint
CREATE TABLE "brand_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source_type" "brand_asset_source" NOT NULL,
	"external_id" text,
	"source_checked_at" timestamp,
	"checksum" text NOT NULL,
	"mime_type" text NOT NULL,
	"width" integer,
	"height" integer,
	"original_key" text,
	"thumbnail_key" text,
	"product_id" uuid,
	"ai_description" text,
	"tags" text[],
	"orientation" "brand_asset_orientation",
	"has_embedded_text" boolean,
	"embedding" vector(768),
	"status" "brand_asset_status" DEFAULT 'pending' NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generated_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"script_id" uuid,
	"source_asset_ids" uuid[] NOT NULL,
	"mode" text DEFAULT 'staging' NOT NULL,
	"instruction" text,
	"storage_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"width" integer,
	"height" integer,
	"status" "generated_image_status" DEFAULT 'ready' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "google_drive_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"access_token_expires_at" timestamp NOT NULL,
	"drive_account_email" text,
	"status" "google_drive_connection_status" DEFAULT 'ok' NOT NULL,
	"last_checked_at" timestamp,
	"connected_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "google_drive_connections_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "scripts" ADD COLUMN "brand_asset_id" uuid;--> statement-breakpoint
ALTER TABLE "scripts" ADD COLUMN "generated_image_id" uuid;--> statement-breakpoint
ALTER TABLE "brand_assets" ADD CONSTRAINT "brand_assets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_assets" ADD CONSTRAINT "brand_assets_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_images" ADD CONSTRAINT "generated_images_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_images" ADD CONSTRAINT "generated_images_script_id_scripts_id_fk" FOREIGN KEY ("script_id") REFERENCES "public"."scripts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_drive_connections" ADD CONSTRAINT "google_drive_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scripts" ADD CONSTRAINT "scripts_brand_asset_id_brand_assets_id_fk" FOREIGN KEY ("brand_asset_id") REFERENCES "public"."brand_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scripts" ADD CONSTRAINT "scripts_generated_image_id_generated_images_id_fk" FOREIGN KEY ("generated_image_id") REFERENCES "public"."generated_images"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "brand_assets_embedding_hnsw_idx" ON "brand_assets" USING hnsw ("embedding" vector_cosine_ops);