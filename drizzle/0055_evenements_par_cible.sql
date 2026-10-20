ALTER TABLE "material_events" ADD COLUMN "audience_angles" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "material_events" ADD COLUMN "qualified_at" timestamp;