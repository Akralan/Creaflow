CREATE TYPE "public"."material_source_status" AS ENUM('ok', 'error', 'needs_reconnect');--> statement-breakpoint
CREATE TYPE "public"."material_source_type" AS ENUM('github_repo');--> statement-breakpoint
CREATE TYPE "public"."onboarding_track" AS ENUM('creator', 'dev');--> statement-breakpoint
ALTER TYPE "public"."source_material_kind" ADD VALUE 'connector';--> statement-breakpoint
CREATE TABLE "github_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"github_user_id" text NOT NULL,
	"login" text NOT NULL,
	"name" text,
	"bio" text,
	"avatar_url" text,
	"access_token" text NOT NULL,
	"scope" text NOT NULL,
	"connected_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "github_accounts_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "github_accounts_github_user_id_unique" UNIQUE("github_user_id")
);
--> statement-breakpoint
CREATE TABLE "material_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"type" "material_source_type" NOT NULL,
	"external_id" text NOT NULL,
	"label" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sync_cursor" text,
	"last_synced_at" timestamp,
	"status" "material_source_status" DEFAULT 'ok' NOT NULL,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "material_sources_user_id_type_external_id_unique" UNIQUE("user_id","type","external_id")
);
--> statement-breakpoint
ALTER TABLE "source_material_citations" DROP CONSTRAINT "source_material_citations_source_material_id_source_materials_id_fk";
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "source_materials" ADD COLUMN "source_id" uuid;--> statement-breakpoint
ALTER TABLE "source_materials" ADD COLUMN "external_ref" text;--> statement-breakpoint
ALTER TABLE "source_materials" ADD COLUMN "external_checksum" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "onboarding_track" "onboarding_track" DEFAULT 'creator' NOT NULL;--> statement-breakpoint
ALTER TABLE "github_accounts" ADD CONSTRAINT "github_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_sources" ADD CONSTRAINT "material_sources_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_sources" ADD CONSTRAINT "material_sources_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_material_citations" ADD CONSTRAINT "source_material_citations_source_material_id_source_materials_id_fk" FOREIGN KEY ("source_material_id") REFERENCES "public"."source_materials"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_materials" ADD CONSTRAINT "source_materials_source_id_material_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."material_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "source_materials_source_id_external_ref_index" ON "source_materials" USING btree ("source_id","external_ref") WHERE "source_materials"."source_id" is not null;