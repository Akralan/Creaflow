CREATE TYPE "public"."material_event_date_precision" AS ENUM('day', 'month', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."material_event_kind" AS ENUM('failure', 'decision', 'result', 'feedback', 'milestone');--> statement-breakpoint
CREATE TYPE "public"."material_event_origin" AS ENUM('reader', 'user');--> statement-breakpoint
CREATE TABLE "material_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"date" text,
	"date_precision" "material_event_date_precision" DEFAULT 'unknown' NOT NULL,
	"title" text NOT NULL,
	"what_happened" text NOT NULL,
	"what_changed" text,
	"kind" "material_event_kind" NOT NULL,
	"audiences" text[] DEFAULT '{}'::text[] NOT NULL,
	"source_material_id" uuid,
	"excerpt" text,
	"origin" "material_event_origin" DEFAULT 'reader' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "source_materials" ADD COLUMN "events_read_at" timestamp;--> statement-breakpoint
ALTER TABLE "material_events" ADD CONSTRAINT "material_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_events" ADD CONSTRAINT "material_events_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_events" ADD CONSTRAINT "material_events_source_material_id_source_materials_id_fk" FOREIGN KEY ("source_material_id") REFERENCES "public"."source_materials"("id") ON DELETE set null ON UPDATE no action;