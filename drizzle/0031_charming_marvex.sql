CREATE TYPE "public"."visual_format" AS ENUM('single', 'carousel', 'animation');--> statement-breakpoint
ALTER TABLE "scripts" ADD COLUMN "visual_format" "visual_format" DEFAULT 'single' NOT NULL;--> statement-breakpoint
ALTER TABLE "scripts" ADD COLUMN "slide_count" integer;--> statement-breakpoint
ALTER TABLE "scripts" ADD COLUMN "duration_ms" integer;--> statement-breakpoint
-- Scripts visuels antérieurs au chantier (docs/SPEC_FORMAT_VISUEL_ET_ANIMATION.md §4) : image unique si le storyboard a au plus une entrée, carrousel sinon.
UPDATE "scripts" SET "visual_format" = 'carousel', "slide_count" = jsonb_array_length("storyboard") WHERE "content_type" = 'visual' AND jsonb_typeof("storyboard") = 'array' AND jsonb_array_length("storyboard") > 1;
