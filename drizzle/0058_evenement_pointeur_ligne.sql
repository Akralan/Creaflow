ALTER TABLE "material_events" ADD COLUMN "line" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "scripts" ADD COLUMN "event_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;