CREATE TYPE "public"."post_match_candidate_status" AS ENUM('pending', 'confirmed', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."post_metrics_source" AS ENUM('manual', 'api');--> statement-breakpoint
CREATE TYPE "public"."social_connection_status" AS ENUM('ok', 'needs_reconnect');--> statement-breakpoint
ALTER TYPE "public"."assistant_proposal_kind" ADD VALUE 'category_reweight';--> statement-breakpoint
CREATE TABLE "post_match_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"script_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"platform_post_id" text NOT NULL,
	"external_url" text NOT NULL,
	"caption_text" text,
	"published_at" timestamp,
	"score" real NOT NULL,
	"metrics" jsonb NOT NULL,
	"status" "post_match_candidate_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	CONSTRAINT "post_match_candidates_platform_platform_post_id_unique" UNIQUE("platform","platform_post_id")
);
--> statement-breakpoint
CREATE TABLE "post_metrics_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"script_id" uuid NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"likes" integer DEFAULT 0 NOT NULL,
	"comments" integer DEFAULT 0 NOT NULL,
	"shares" integer DEFAULT 0 NOT NULL,
	"source" "post_metrics_source" NOT NULL,
	"captured_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "post_metrics" ADD COLUMN "source" "post_metrics_source" DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "post_metrics" ADD COLUMN "platform_post_id" text;--> statement-breakpoint
ALTER TABLE "post_metrics" ADD COLUMN "fetched_at" timestamp;--> statement-breakpoint
ALTER TABLE "social_connections" ADD COLUMN "access_token_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "social_connections" ADD COLUMN "status" "social_connection_status" DEFAULT 'ok' NOT NULL;--> statement-breakpoint
ALTER TABLE "social_connections" ADD COLUMN "last_metrics_fetch_at" timestamp;--> statement-breakpoint
ALTER TABLE "post_match_candidates" ADD CONSTRAINT "post_match_candidates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_match_candidates" ADD CONSTRAINT "post_match_candidates_script_id_scripts_id_fk" FOREIGN KEY ("script_id") REFERENCES "public"."scripts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_metrics_snapshots" ADD CONSTRAINT "post_metrics_snapshots_script_id_scripts_id_fk" FOREIGN KEY ("script_id") REFERENCES "public"."scripts"("id") ON DELETE cascade ON UPDATE no action;