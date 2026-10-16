-- Ordre revu à la main : les contraintes qui pointent vers generated_images sont retirées AVANT la
-- table (un DROP TABLE ... CASCADE les supprimerait déjà, et le DROP CONSTRAINT suivant échouerait).
ALTER TABLE "scripts" DROP CONSTRAINT IF EXISTS "scripts_generated_image_id_generated_images_id_fk";--> statement-breakpoint
ALTER TABLE "visual_designs" DROP CONSTRAINT IF EXISTS "visual_designs_base_generated_image_id_generated_images_id_fk";--> statement-breakpoint
ALTER TABLE "visual_designs" DROP CONSTRAINT IF EXISTS "visual_designs_base_asset_id_brand_assets_id_fk";--> statement-breakpoint
DROP TABLE "generated_images" CASCADE;--> statement-breakpoint
ALTER TABLE "scripts" DROP COLUMN "generated_image_id";--> statement-breakpoint
ALTER TABLE "visual_designs" DROP COLUMN "base_kind";--> statement-breakpoint
ALTER TABLE "visual_designs" DROP COLUMN "base_generated_image_id";--> statement-breakpoint
ALTER TABLE "visual_designs" DROP COLUMN "base_asset_id";--> statement-breakpoint
ALTER TABLE "visual_designs" DROP COLUMN "contains_ai_imagery";--> statement-breakpoint
DROP TYPE "public"."generated_image_status";--> statement-breakpoint
DROP TYPE "public"."visual_design_base_kind";
