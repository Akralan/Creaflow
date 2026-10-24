DROP TABLE "inspirations" CASCADE;--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "inspiration_refreshed_at";--> statement-breakpoint
DROP TYPE "public"."inspiration_status";