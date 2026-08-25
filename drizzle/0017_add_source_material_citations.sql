CREATE TABLE "source_material_citations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"script_id" uuid NOT NULL,
	"source_material_id" uuid,
	"excerpt" text NOT NULL,
	"match_start" integer,
	"match_length" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "source_material_citations" ADD CONSTRAINT "source_material_citations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_material_citations" ADD CONSTRAINT "source_material_citations_script_id_scripts_id_fk" FOREIGN KEY ("script_id") REFERENCES "public"."scripts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_material_citations" ADD CONSTRAINT "source_material_citations_source_material_id_source_materials_id_fk" FOREIGN KEY ("source_material_id") REFERENCES "public"."source_materials"("id") ON DELETE cascade ON UPDATE no action;