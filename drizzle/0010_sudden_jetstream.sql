CREATE TYPE "public"."script_origin" AS ENUM('generated', 'imported', 'manual');--> statement-breakpoint
CREATE TYPE "public"."source_material_kind" AS ENUM('paste', 'file', 'interview');--> statement-breakpoint
CREATE TYPE "public"."source_material_status" AS ENUM('pending', 'ready');--> statement-breakpoint
CREATE TABLE "source_materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"product_id" uuid,
	"kind" "source_material_kind" NOT NULL,
	"title" text,
	"raw_text" text NOT NULL,
	"status" "source_material_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scripts" ADD COLUMN "origin" "script_origin" DEFAULT 'generated' NOT NULL;--> statement-breakpoint
ALTER TABLE "source_materials" ADD CONSTRAINT "source_materials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_materials" ADD CONSTRAINT "source_materials_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;