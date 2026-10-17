CREATE TYPE "public"."inspiration_status" AS ENUM('active', 'dismissed');--> statement-breakpoint
CREATE TABLE "inspirations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"insight" text NOT NULL,
	"kind" text NOT NULL,
	"reader_label" text,
	"platform" text,
	"status" "inspiration_status" DEFAULT 'active' NOT NULL,
	"dismissed_by" text,
	"dismiss_reason" text,
	"shown_count" integer DEFAULT 0 NOT NULL,
	"used_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "inspiration_refreshed_at" timestamp;--> statement-breakpoint
ALTER TABLE "inspirations" ADD CONSTRAINT "inspirations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspirations" ADD CONSTRAINT "inspirations_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;