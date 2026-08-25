DROP TABLE "material_units" CASCADE;--> statement-breakpoint
DROP TABLE "script_material_usages" CASCADE;--> statement-breakpoint
ALTER TABLE "source_materials" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "source_materials" DROP COLUMN "chunk_total";--> statement-breakpoint
ALTER TABLE "source_materials" DROP COLUMN "chunk_processed";--> statement-breakpoint
DROP TYPE "public"."material_unit_type";--> statement-breakpoint
DROP TYPE "public"."source_material_status";