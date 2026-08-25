CREATE TYPE "public"."material_unit_type" AS ENUM('anecdote', 'bug', 'chiffre', 'decision', 'learning', 'autre');--> statement-breakpoint
CREATE TABLE "material_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source_material_id" uuid NOT NULL,
	"product_id" uuid,
	"unit_type" "material_unit_type" NOT NULL,
	"label" text NOT NULL,
	"content" text NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"excluded" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "script_material_usages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"script_id" uuid NOT NULL,
	"material_unit_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "script_material_usages_script_id_material_unit_id_unique" UNIQUE("script_id","material_unit_id")
);
--> statement-breakpoint
ALTER TABLE "material_units" ADD CONSTRAINT "material_units_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_units" ADD CONSTRAINT "material_units_source_material_id_source_materials_id_fk" FOREIGN KEY ("source_material_id") REFERENCES "public"."source_materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_units" ADD CONSTRAINT "material_units_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "script_material_usages" ADD CONSTRAINT "script_material_usages_script_id_scripts_id_fk" FOREIGN KEY ("script_id") REFERENCES "public"."scripts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "script_material_usages" ADD CONSTRAINT "script_material_usages_material_unit_id_material_units_id_fk" FOREIGN KEY ("material_unit_id") REFERENCES "public"."material_units"("id") ON DELETE cascade ON UPDATE no action;