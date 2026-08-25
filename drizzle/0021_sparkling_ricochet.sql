CREATE TYPE "public"."content_series_mode" AS ENUM('feuilleton', 'rendez_vous');--> statement-breakpoint
CREATE TABLE "narrative_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"product_id" uuid,
	"series_id" uuid,
	"arc_summary" text,
	"beats" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"open_promises" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"callbacks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"format_contract" text,
	"is_stale" boolean DEFAULT false NOT NULL,
	"last_planned_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "narrative_state_user_id_product_id_series_id_unique" UNIQUE("user_id","product_id","series_id")
);
--> statement-breakpoint
ALTER TABLE "content_series" ADD COLUMN "mode" "content_series_mode" DEFAULT 'rendez_vous' NOT NULL;--> statement-breakpoint
ALTER TABLE "scripts" ADD COLUMN "beat_id" text;--> statement-breakpoint
ALTER TABLE "scripts" ADD COLUMN "promises_made" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "narrative_state" ADD CONSTRAINT "narrative_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "narrative_state" ADD CONSTRAINT "narrative_state_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "narrative_state" ADD CONSTRAINT "narrative_state_series_id_content_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."content_series"("id") ON DELETE cascade ON UPDATE no action;