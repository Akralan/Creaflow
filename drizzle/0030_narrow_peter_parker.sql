CREATE TYPE "public"."visual_design_base_kind" AS ENUM('generated', 'asset', 'none');--> statement-breakpoint
CREATE TYPE "public"."visual_design_status" AS ENUM('draft', 'stale', 'exported');--> statement-breakpoint
ALTER TYPE "public"."script_micro_edit_kind" ADD VALUE 'design_instruction';--> statement-breakpoint
CREATE TABLE "visual_designs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"script_id" uuid NOT NULL,
	"base_kind" "visual_design_base_kind" NOT NULL,
	"base_generated_image_id" uuid,
	"base_asset_id" uuid,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"theme" jsonb NOT NULL,
	"slides" jsonb NOT NULL,
	"status" "visual_design_status" DEFAULT 'draft' NOT NULL,
	"last_instruction" text,
	"contains_ai_imagery" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "visual_designs_script_id_unique" UNIQUE("script_id")
);
--> statement-breakpoint
ALTER TABLE "creator_profiles" ADD COLUMN "brand_kit" jsonb;--> statement-breakpoint
ALTER TABLE "visual_designs" ADD CONSTRAINT "visual_designs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visual_designs" ADD CONSTRAINT "visual_designs_script_id_scripts_id_fk" FOREIGN KEY ("script_id") REFERENCES "public"."scripts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visual_designs" ADD CONSTRAINT "visual_designs_base_generated_image_id_generated_images_id_fk" FOREIGN KEY ("base_generated_image_id") REFERENCES "public"."generated_images"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visual_designs" ADD CONSTRAINT "visual_designs_base_asset_id_brand_assets_id_fk" FOREIGN KEY ("base_asset_id") REFERENCES "public"."brand_assets"("id") ON DELETE set null ON UPDATE no action;